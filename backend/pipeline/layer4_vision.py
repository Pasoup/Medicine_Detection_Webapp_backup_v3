# =============================================================================
#  pipeline/layer4_vision.py — Layer 4: full-frame medicine identification
#
#  med_box.pt was trained on FULL images, not crops.
#  This layer scans the entire frame once, then maps each detection back
#  to whichever Layer-1 box it belongs to.
# =============================================================================

import numpy as np
from ultralytics import YOLO

from config import MED_BOX_MODEL, L4_CONF_RUN, L4_CONF_MIN
from utils.medicine_db import load_medicine_db


# ── Model singleton ───────────────────────────────────────────────────────────
# Loaded once at import time — avoids re-loading on every call.
_model = YOLO(MED_BOX_MODEL)

# Expose class names so other modules (medicine_db) can seed the DB baseline.
LAYER4_CLASS_NAMES: list = list(_model.names.values())

# ── Medicine DB (shared reference — populated in main before first use) ───────
# Injected via set_medicine_db() so layer4 and consensus share the same list.
_medicine_db: list = []

def set_medicine_db(db: list) -> None:
    """Inject the loaded medicine DB. Call once from main after load_medicine_db()."""
    global _medicine_db
    _medicine_db = db


# ── Full-frame scan ───────────────────────────────────────────────────────────

def layer4_scan_full_frame(frame: np.ndarray, original_frames: list = None) -> list:
    """
    Run med_box.pt on the combined stitched frame and return detections.
    Scans the full stitched image in a single pass — no per-camera splitting.
    """
    if frame is None or frame.size == 0:
        return []

    dets = _scan_single_frame(frame)
    print(f"  [L4] {len(dets)} detection(s) — stitched frame")
    return dets


def _scan_single_frame(frame: np.ndarray) -> list:
    """Scan one frame with the model and return raw detections."""

    results    = _model(frame, conf=L4_CONF_RUN, verbose=False)
    detections = []

    for r in results:
        if r.obb is not None and len(r.obb):
            for idx in range(len(r.obb)):
                cls  = int(r.obb.cls[idx])
                conf = float(r.obb.conf[idx])
                name = _model.names[cls]
                pts  = r.obb.xyxyxyxy.cpu().numpy()[idx]
                x_coords, y_coords = pts[:, 0], pts[:, 1]
                bbox = (int(min(x_coords)), int(min(y_coords)),
                        int(max(x_coords)), int(max(y_coords)))
                detections.append({"name": name, "conf": conf, "bbox": bbox})

        elif r.boxes is not None and len(r.boxes):
            for idx in range(len(r.boxes)):
                cls  = int(r.boxes.cls[idx])
                conf = float(r.boxes.conf[idx])
                name = _model.names[cls]
                x1, y1, x2, y2 = map(int, r.boxes.xyxy[idx].cpu().numpy())
                detections.append({"name": name, "conf": conf,
                                   "bbox": (x1, y1, x2, y2)})

    return detections




def layer4_match_to_box(layer4_detections: list, box_bbox: tuple):
    """
    Find the highest-confidence Layer 4 detection whose centre point falls
    inside the Layer 1 bounding box, then return its name and confidence.

    Parameters
    ----------
    layer4_detections : output of layer4_scan_full_frame() — list of dicts
                        with keys "name", "conf", "bbox"
    box_bbox          : (x1, y1, x2, y2) of the Layer 1 medicine box

    Returns
    -------
    (name, conf)      — best match above L4_CONF_MIN threshold
    ("UNKNOWN", 0.0)  — if nothing landed inside the box
    """
    bx1, by1, bx2, by2 = box_bbox
    best_name = "UNKNOWN"
    best_conf = 0.0

    for d in layer4_detections:
        # Skip anything below the minimum confidence threshold
        if d["conf"] < L4_CONF_MIN:
            continue

        # Use the detection's centre point as its representative location
        dx1, dy1, dx2, dy2 = d["bbox"]
        cx = (dx1 + dx2) / 2
        cy = (dy1 + dy2) / 2

        # Check whether this centre falls inside the Layer 1 box
        if bx1 <= cx <= bx2 and by1 <= cy <= by2:
            if d["conf"] > best_conf:
                best_name = d["name"]
                best_conf = d["conf"]

    if best_name == "UNKNOWN":
        print(f"    [L4] No detection centre landed inside box → UNKNOWN")
        return "UNKNOWN", 0.0

    print(f"    [L4] Matched '{best_name}'  conf={best_conf:.2f}")
    return best_name, best_conf


def layer4_draw_annotated(frame: np.ndarray, detections: list) -> np.ndarray:

    import cv2
    out = frame.copy()

    for d in detections:
        x1, y1, x2, y2 = d["bbox"]
        conf  = d["conf"]
        name  = d["name"]

    
        if conf >= L4_CONF_MIN:
            color = (0, 200, 80)   
        elif conf >= 0.40:
            color = (0, 165, 255)   
        else:
            color = (60, 60, 220)  

        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)

        label = f"{name}  {conf:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
      
        cv2.rectangle(out,
                      (x1, max(0, y1 - th - 8)),
                      (x1 + tw + 8, y1),
                      color, -1)
        cv2.putText(out, label,
                    (x1 + 4, max(th, y1 - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2,
                    cv2.LINE_AA)

   
    cv2.putText(out, "Layer 4 — med_box.pt",
                (10, out.shape[0] - 14),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1,
                cv2.LINE_AA)

    return out