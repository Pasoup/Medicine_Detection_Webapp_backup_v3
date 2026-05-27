"""
camera.py — OpenCV dual-camera capture for the v3_webapp backend.

Opens both cameras at startup with fixed manual exposure so the browser's
WebRTC layer (and its unreliable driver constraints) is bypassed entirely.
Runs a background thread that continuously reads, stitches, and stores:
  _latest_jpeg  — MJPEG-ready bytes for the /video_feed stream
  _latest_raw   — (f0, f1) raw BGR frames for the /scan endpoint
"""

import cv2
import numpy as np
import threading
import time
import json
import os

# ── Calibration ───────────────────────────────────────────────────────────────
_CALIB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "frontend", "src", "utils", "calibration.json"
)
_CALIB_DEFAULTS = {
    "crop0_right": 0, "crop1_left": 0,
    "y_offset": 0,    "x_offset": 0,
    "cam_width": 960, "cam_height": 1080,
}

def load_calibration() -> dict:
    if os.path.exists(_CALIB_PATH):
        try:
            with open(_CALIB_PATH) as f:
                return {**_CALIB_DEFAULTS, **json.load(f)}
        except Exception as e:
            print(f"[Camera] Calibration read error: {e}")
    return _CALIB_DEFAULTS.copy()

# ── Shared state ──────────────────────────────────────────────────────────────
_lock        = threading.Lock()
_latest_jpeg: bytes | None         = None   # latest stitched JPEG for streaming
_latest_raw:  tuple | None         = None   # (f0, f1) raw frames for scan

_cap0: cv2.VideoCapture | None = None
_cap1: cv2.VideoCapture | None = None
_running  = False
_f0_beta: int = 0   # additive brightness offset applied to cam0 frames to match cam1

# ── Camera open ───────────────────────────────────────────────────────────────
def _open_master(index: int, width: int, height: int):
    """
    Open cam0 (master), apply fixed exposure, then read back the actual
    gain and brightness the driver settled on.  Returns (cap, master_vals)
    where master_vals = { gain, brightness } to be copied to the slave.
    """
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print(f"[Camera] Could not open master camera at index {index}")
        return None, {}

    # MJPG must be set before resolution — camera compresses on-chip so
    # 1920×1080 fits over USB 2.0 at 30 fps instead of ~1 fps with raw YUYV
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

    
    cap.set(cv2.CAP_PROP_EXPOSURE, -5)
    
    ae_actual = cap.get(cv2.CAP_PROP_AUTO_EXPOSURE)
    ex_actual = cap.get(cv2.CAP_PROP_EXPOSURE)

    gain       = cap.get(cv2.CAP_PROP_GAIN)
    brightness = cap.get(cv2.CAP_PROP_BRIGHTNESS)

    print(f"[Camera] Master (index {index}) — "
          f"{int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))}×{int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))}")
    print(f"[Camera] Master — auto_exposure set={-5} actual={ae_actual} | "
          f"exposure set={-4} actual={ex_actual} | "
          f"gain={gain} | brightness={brightness}")

    return cap, {"gain": gain, "brightness": brightness}


def _open_slave(index: int, width: int, height: int, master_vals: dict):
    """
    Open cam1 (slave), apply the same exposure + master's gain/brightness
    so both cameras produce the same output brightness.
    """
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print(f"[Camera] Could not open slave camera at index {index}")
        return None

    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)


    cap.set(cv2.CAP_PROP_EXPOSURE, -5)
    
    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Do NOT set CAP_PROP_AUTO_EXPOSURE — setting it alongside EXPOSURE caused
    # all-black frames on this driver previously.
    # Set EXPOSURE alone (no auto_exposure toggle) to override whatever value
    # the driver has persisted from a previous session (was -10.0 = near-black).
    # Match cam0's value of -4. If frames are still dark try -3 or -2;
    # if they go all-black try -5.
    

    ae_actual  = cap.get(cv2.CAP_PROP_AUTO_EXPOSURE)
    ex_actual  = cap.get(cv2.CAP_PROP_EXPOSURE)
    gain       = cap.get(cv2.CAP_PROP_GAIN)
    brightness = cap.get(cv2.CAP_PROP_BRIGHTNESS)
    print(f"[Camera] Slave  (index {index}) — {actual_w}×{actual_h}")
    print(f"[Camera] Slave  — auto_exposure={ae_actual} | "
          f"exposure={ex_actual} | gain={gain} | brightness={brightness}")
    return cap

# ── Stitch ────────────────────────────────────────────────────────────────────
def _stitch(f0: np.ndarray, f1: np.ndarray, calib: dict):
    """Rotate CCW/CW, seam-crop, y/x offset, hstack."""
    c0r  = calib.get("crop0_right", 0)
    c1l  = calib.get("crop1_left",  0)
    yOff = calib.get("y_offset",    0)
    xOff = calib.get("x_offset",    0)

    r0 = cv2.rotate(f0, cv2.ROTATE_90_COUNTERCLOCKWISE)
    r1 = cv2.rotate(f1, cv2.ROTATE_90_CLOCKWISE)

    if c0r > 0: r0 = r0[:, :r0.shape[1] - c0r]
    if c1l > 0: r1 = r1[:, c1l:]

    if yOff > 0:
        r1 = r1[yOff:, :]
        r0 = r0[:r0.shape[0] - yOff, :]
    elif yOff < 0:
        y  = -yOff
        r0 = r0[y:, :]
        r1 = r1[:r1.shape[0] - y, :]

    if xOff > 0:
        pad = np.zeros((r1.shape[0], xOff, 3), dtype=np.uint8)
        r1  = np.hstack([pad, r1])
    elif xOff < 0:
        r1  = r1[:, -xOff:]

    h = min(r0.shape[0], r1.shape[0])
    return cv2.hconcat([r0[:h], r1[:h]])

# ── Background capture loop ───────────────────────────────────────────────────
def _camera_loop():
    global _latest_jpeg, _latest_raw

    # Reload calibration at most once every 2 seconds
    calib           = load_calibration()
    last_calib_time = time.time()

    while _running:
        now = time.time()
        if now - last_calib_time > 2.0:
            calib           = load_calibration()
            last_calib_time = now

        ret0, f0 = (_cap0.read() if _cap0 else (False, None))
        ret1, f1 = (_cap1.read() if _cap1 else (False, None))

        if ret0 and ret1 and f0 is not None and f1 is not None:
            try:
                # Lift cam0 brightness to match cam1 (additive offset computed
                # at startup from the stable mean difference)
                if _f0_beta != 0:
                    f0 = cv2.convertScaleAbs(f0, alpha=1.0, beta=_f0_beta)
                stitched = _stitch(f0, f1, calib)
                # Downscale to 50% for the live stream — keeps encoding fast
                # without affecting scan quality (raw frames kept at full res)
                display  = cv2.resize(stitched, (0, 0), fx=0.5, fy=0.5,
                                      interpolation=cv2.INTER_AREA)
                _, jpeg   = cv2.imencode(".jpg", display,
                                         [cv2.IMWRITE_JPEG_QUALITY, 75])
                with _lock:
                    _latest_jpeg = jpeg.tobytes()
                    _latest_raw  = (f0.copy(), f1.copy())
            except Exception as e:
                print(f"[Camera] Stitch error: {e}")

        elif ret0 and f0 is not None:
            # Single-camera fallback
            try:
                rotated  = cv2.rotate(f0, cv2.ROTATE_90_COUNTERCLOCKWISE)
                display  = cv2.resize(rotated, (0, 0), fx=0.5, fy=0.5,
                                      interpolation=cv2.INTER_AREA)
                _, jpeg   = cv2.imencode(".jpg", display,
                                         [cv2.IMWRITE_JPEG_QUALITY, 75])
                with _lock:
                    _latest_jpeg = jpeg.tobytes()
                    _latest_raw  = (f0.copy(), None)
            except Exception as e:
                print(f"[Camera] Single-cam encode error: {e}")

# ── Camera discovery ─────────────────────────────────────────────────────────
def _find_camera_indices(max_index: int = 8) -> list[int]:
    """
    Probe indices 0..max_index-1 and return every index where a camera opens.
    Uses a quick open/release — does NOT set any properties.
    """
    found = []
    for i in range(max_index):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if cap.isOpened():
            found.append(i)
            print(f"[Camera] Detected camera at index {i}")
        cap.release()
        time.sleep(0.05)           # tiny pause so DirectShow can free the handle
    print(f"[Camera] Available indices: {found}")
    return found


# ── Public API ────────────────────────────────────────────────────────────────

def _wait_for_frames(cap: cv2.VideoCapture, label: str,
                     warmup: int = 25, stable_window: int = 8,
                     max_attempts: int = 120) -> tuple:
    """
    Two-phase startup:
      Phase 1 — drain `warmup` frames so the sensor and AGC can settle (~1 s).
      Phase 2 — collect `stable_window` consecutive valid frames and return
                 their average as a reliable brightness reading.
    Returns (success: bool, stable_mean: float).
    """
    # Phase 1: warmup drain — sensor/AGC not settled yet, don't measure
    for _ in range(warmup):
        cap.read()
        time.sleep(0.04)
    print(f"[Camera] {label} warmup done ({warmup} frames drained)")

    # Phase 2: collect stable window
    means = []
    for _ in range(max_attempts):
        ret, frame = cap.read()
        if ret and frame is not None and frame.shape[0] > 0:
            m = float(frame.mean())
            if m > 1.0:
                means.append(m)
                if len(means) >= stable_window:
                    avg = sum(means) / len(means)
                    print(f"[Camera] {label} stable mean={avg:.1f} "
                          f"(avg of {stable_window} frames)")
                    return True, avg
        time.sleep(0.04)

    if means:
        avg = sum(means) / len(means)
        print(f"[Camera] {label} WARNING: timed out — using mean={avg:.1f}")
        return True, avg

    print(f"[Camera] {label} ERROR: no valid frames after warmup")
    return False, 0.0


def _measure_mean(cap: cv2.VideoCapture, n: int = 10) -> float:
    """Read n frames and return their average pixel mean (post-warmup only)."""
    vals = []
    for _ in range(n):
        ret, frame = cap.read()
        if ret and frame is not None:
            vals.append(float(frame.mean()))
        time.sleep(0.04)
    return sum(vals) / len(vals) if vals else 0.0


def _equalize_exposure(cap: cv2.VideoCapture, label: str,
                       target: float, current_mean: float) -> float:
    """
    Probe a range of integer exposure values (driver rounds fractional steps,
    so 0.5 increments cause oscillation).  Pick the integer that brings the
    mean closest to `target`, then return that final mean so the caller can
    apply a software scale for any remaining gap.
    """
    base = round(cap.get(cv2.CAP_PROP_EXPOSURE))
    candidates = [base + d for d in (0, -1, +1, -2, +2)]
    print(f"[Camera] {label} probing integer exposures {candidates} "
          f"(current mean={current_mean:.1f}, target={target:.1f})")

    best_exp  = base
    best_mean = current_mean
    best_diff = abs(current_mean - target)

    for exp in candidates:
        cap.set(cv2.CAP_PROP_EXPOSURE, float(exp))
        # Settle — drain 10 frames before measuring
        for _ in range(10):
            cap.read()
            time.sleep(0.04)
        mean = _measure_mean(cap, n=8)
        diff = abs(mean - target)
        print(f"[Camera] {label}  exposure={exp:+d}  mean={mean:.1f}  diff={diff:.1f}")
        if diff < best_diff:
            best_diff, best_mean, best_exp = diff, mean, exp

    # Apply the winner
    cap.set(cv2.CAP_PROP_EXPOSURE, float(best_exp))
    for _ in range(10):
        cap.read()
        time.sleep(0.04)
    final_mean = _measure_mean(cap, n=8)
    print(f"[Camera] {label} best hardware: exposure={best_exp:+d}  "
          f"mean={final_mean:.1f}  target={target:.1f}")
    return final_mean


def start(cam0_index: int = 0, cam1_index: int = 2) -> bool:
    global _cap0, _cap1, _running

    calib  = load_calibration()
    width  = calib.get("cam_width",  960)
    height = calib.get("cam_height", 1080)

    # ── Open cam0 — probe only if direct open fails ───────────────────────────
    _cap0, master_vals = _open_master(cam0_index, width, height)
    if _cap0 is None:
        print(f"[Camera] Index {cam0_index} failed — scanning for cameras…")
        available = _find_camera_indices()
        if not available:
            print("[Camera] ERROR: No cameras found on this system")
            return False
        cam0_index = available[0]
        _cap0, master_vals = _open_master(cam0_index, width, height)
        if _cap0 is None:
            print("[Camera] ERROR: Could not open master camera")
            return False

    cam0_ok, cam0_mean = _wait_for_frames(_cap0, "cam0 (master)")
    if not cam0_ok:
        print("[Camera] WARNING: cam0 never produced frames — continuing anyway")
        cam0_mean = 0.0

    # ── Generous settle time so the USB bus is free before opening cam1 ───────
    print("[Camera] Waiting 2 s before opening cam1...")
    time.sleep(2.0)

    # ── Open cam1 — probe only if direct open fails ───────────────────────────
    _cap1 = _open_slave(cam1_index, width, height, master_vals)
    if _cap1 is None:
        print(f"[Camera] Index {cam1_index} failed — scanning for cameras…")
        available = _find_camera_indices()
        others = [i for i in available if i != cam0_index]
        if others:
            cam1_index = others[0]
            print(f"[Camera] cam1 fallback → index {cam1_index}")
            _cap1 = _open_slave(cam1_index, width, height, master_vals)
        else:
            print("[Camera] Only one camera found — running single-camera mode")

    if _cap1 is not None:
        cam1_ok, cam1_mean = _wait_for_frames(_cap1, "cam1 (slave)")
        # Compute additive offset to lift cam0 up to cam1's brightness level
        global _f0_beta
        if cam0_mean > 5.0 and cam1_mean > 5.0:
            _f0_beta = int(cam1_mean - cam0_mean)
            print(f"[Camera] cam0 brightness offset = +{_f0_beta}  "
                  f"(cam0={cam0_mean:.1f} → target={cam1_mean:.1f})")

    _running = True
    t = threading.Thread(target=_camera_loop, daemon=True)
    t.start()
    print("[Camera] Capture loop started")
    return True


def stop():
    global _running
    _running = False
    if _cap0: _cap0.release()
    if _cap1: _cap1.release()
    print("[Camera] Stopped")


def get_jpeg() -> bytes | None:
    """Latest stitched JPEG frame — used by the /video_feed MJPEG stream."""
    with _lock:
        return _latest_jpeg


def get_raw_frames() -> tuple | None:
    """Latest (f0, f1) raw BGR frames — used by /scan for pipeline processing."""
    with _lock:
        return _latest_raw
