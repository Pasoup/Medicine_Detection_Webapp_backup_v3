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
_running = False

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

    cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 1)  
    cap.set(cv2.CAP_PROP_EXPOSURE, -4)
    
    ae_actual = cap.get(cv2.CAP_PROP_AUTO_EXPOSURE)
    ex_actual = cap.get(cv2.CAP_PROP_EXPOSURE)

    gain       = cap.get(cv2.CAP_PROP_GAIN)
    brightness = cap.get(cv2.CAP_PROP_BRIGHTNESS)

    print(f"[Camera] Master (index {index}) — "
          f"{int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))}×{int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))}")
    print(f"[Camera] Master — auto_exposure set={6} actual={ae_actual} | "
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

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Do NOT force manual exposure — cam2's driver interprets explicit exposure
    # values as fully-manual and goes all-black.  Since auto_exposure is also
    # unresponsive on these cameras (returns -1.0), both cameras auto-expose
    # naturally; this is the safest state to leave the slave in.
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
def _wait_for_frames(cap: cv2.VideoCapture, label: str, max_attempts: int = 60) -> bool:
    """
    Drain the camera buffer until we get a valid, non-black frame.
    Logs a warning if frames arrive but are all-zero (exposure issue).
    """
    got_any = False
    for i in range(max_attempts):
        ret, frame = cap.read()
        if ret and frame is not None and frame.shape[0] > 0:
            got_any = True
            # Check pixels aren't all black — if so keep draining
            mean = frame.mean()
            if mean > 1.0:
                print(f"[Camera] {label} ready after {i + 1} read(s) — mean brightness={mean:.1f}")
                return True
        time.sleep(0.05)

    if got_any:
        print(f"[Camera] {label} WARNING: frames arriving but all-black "
              f"(mean≈0) — possible exposure/USB issue")
    else:
        print(f"[Camera] {label} did not produce valid frames after {max_attempts} attempts")
    return False


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

    if not _wait_for_frames(_cap0, "cam0 (master)"):
        print("[Camera] WARNING: cam0 never produced frames — continuing anyway")

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
        _wait_for_frames(_cap1, "cam1 (slave)")

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
