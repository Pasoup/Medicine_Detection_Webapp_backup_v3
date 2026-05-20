import cv2
import numpy as np
from ultralytics import YOLO
from functools import partial

from backend.config import (
    LAYER1_MODEL,
    BOX_CLASS_ID, LABEL_CLASS_ID, QR_CLASS_ID,
    L1_CONF_RUN, L1_CONF_QR, L1_CONF_OTHER,
    L1_PAD_QR, L1_PAD_OTHER,
)
from utils.image import get_perspective
from pipeline.layer3_ocr import correct_orientation   # injected for orientation
 
 
def load_layer1_model() -> YOLO:
    """Load and return the Layer 1 OBB detection model."""
    return YOLO(LAYER1_MODEL)
 
 
def layer1_detect(frame: np.ndarray, model: YOLO, medicine_db: list):
    """
    Run the OBB model on *frame* and return (annotated_frame, detections).

    frame may be a stitched 3840×1080 image (two cameras side-by-side).
    imgsz=3840 tells YOLO to keep the long side at 3840px so each camera
    half stays at full 1920×1080 resolution instead of being downscaled.

    Each detection dict contains:
        cls   : int   — class ID
        label : str   — human label ("box" | "qr_code" | "text_label")
        bbox  : tuple — (x1, y1, x2, y2) axis-aligned bounding box
        crop  : ndarray — perspective-corrected crop of the region
        conf  : float — detection confidence
    """
    results     = list(model(frame, conf=L1_CONF_RUN, task='obb', imgsz=1920))
    detections  = []
 
    for r in results:
        if r.obb is None:
            continue
 
        obb_points = r.obb.xyxyxyxy.cpu().numpy()
        classes    = r.obb.cls.cpu().numpy()
        scores     = r.obb.conf.cpu().numpy()
 
        print(f"  [L1] {len(obb_points)} raw OBB detection(s)")
 
        for i in range(len(obb_points)):
            pts   = obb_points[i]
            cls   = int(classes[i])
            score = float(scores[i])
            label = _cls_to_label(cls)
 
            print(f"  [L1 box {i}] {label} ({cls})  conf={score:.4f}")
 
            min_conf = L1_CONF_QR if cls == QR_CLASS_ID else L1_CONF_OTHER
            if score < min_conf:
                print(f"    → SKIPPED (below {min_conf:.2f} threshold)")
                continue
 
            pad    = L1_PAD_QR if cls == QR_CLASS_ID else L1_PAD_OTHER
            is_qr  = (cls == QR_CLASS_ID)
            is_box = (cls == BOX_CLASS_ID)
 
            try:
                correct_orientation_fn = partial(correct_orientation, medicine_db=medicine_db)
                crop = get_perspective(
                    frame, pts,
                    pad=pad,
                    debug_idx=i,
                    qr_code=is_qr,
                    box=is_box,
                    correct_orient_fn= correct_orientation_fn,
                )
            except Exception as exc:
                print(f"  [WARN] Perspective warp failed for box {i}: {exc}")
                continue
 
            if crop.size == 0:
                continue
 
            x_coords = pts[:, 0]
            y_coords = pts[:, 1]
            bbox = (
                int(min(x_coords)), int(min(y_coords)),
                int(max(x_coords)), int(max(y_coords)),
            )
 
            detections.append({
                "cls":   cls,
                "label": label,
                "bbox":  bbox,
                "crop":  crop,
                "conf":  score,
            })
 
    annotated = results[0].plot() if results else frame
    return annotated, detections
 
 
def _cls_to_label(cls: int) -> str:
    if cls == QR_CLASS_ID:
        return "qr_code"
    if cls == BOX_CLASS_ID:
        return "box"
    return "text_label"