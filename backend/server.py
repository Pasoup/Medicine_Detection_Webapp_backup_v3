# =============================================================================
#  backend/server.py — FastAPI bridge between the web frontend and pipeline
#
#  Run with:  uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload
# =============================================================================

import sys
import os
import base64
import tempfile
import uuid
from datetime import datetime
from typing import Optional
import time

import cv2
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ── Add project root so pipeline imports work ─────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import BOX_CLASS_ID, QR_CLASS_ID, LOG_DIR
from utils.medicine_db import load_medicine_db, db_match, normalize_ocr, db_confidence_tier
from pipeline.layer1_detect import load_layer1_model, layer1_detect
from pipeline.layer2_qr import layer2_read_qr
from pipeline.layer3_ocr import layer3_read_label
from pipeline.layer4_vision import layer4_scan_full_frame, layer4_match_to_box, LAYER4_CLASS_NAMES
from pipeline.consensus import consensus_check

os.makedirs(LOG_DIR, exist_ok=True)

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="MedVerify API", version="2.0")

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    print("\n" + "═" * 50)
    print("  422 — REQUEST BODY REJECTED")
    for err in exc.errors():
        print(f"  field : {err.get('loc')}")
        print(f"  error : {err.get('msg')}")
        print(f"  type  : {err.get('type')}")
    try:
        body = await request.body()
        preview = body[:300].decode("utf-8", errors="replace")
        print(f"  body  : {preview}…")
    except Exception:
        pass
    print("═" * 50 + "\n")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve medicine reference images as static files ───────────────────────────
MEDICINE_IMAGES_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "data", "medicine_images"
)
os.makedirs(MEDICINE_IMAGES_DIR, exist_ok=True)
app.mount("/medicine-images", StaticFiles(directory=MEDICINE_IMAGES_DIR),
          name="medicine-images")


def find_medicine_image(name: str) -> str | None:
    """
    Find a reference image for a medicine by fuzzy-matching the filename
    against the medicine name.  Returns the URL path if found, else None.

    Normalisation: lowercase, strip spaces/hyphens so
    "IMPURIN 50" matches "Impurin50.jpg" and "impurin-50.png".
    """
    if not name or not os.path.exists(MEDICINE_IMAGES_DIR):
        return None

    def norm(s: str) -> str:
        return s.lower().replace(" ", "").replace("-", "").replace("_", "")

    name_norm = norm(name)
    extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

    for fname in os.listdir(MEDICINE_IMAGES_DIR):
        stem, ext = os.path.splitext(fname)
        if ext.lower() not in extensions:
            continue
        if norm(stem) == name_norm:
            return f"/medicine-images/{fname}"

    return None

# ── Load models once at startup ───────────────────────────────────────────────
print("═" * 50)
print("  MEDVERIFY API — INITIALISING")
print("═" * 50)

layer1_model = load_layer1_model()
medicine_db  = load_medicine_db(yolo_class_names=LAYER4_CLASS_NAMES)

print(f"  Medicine DB: {len(medicine_db)} entries loaded.")
print("  Ready.")

# ── In-memory state (replace with a real DB in production) ───────────────────
expected_list: list[dict] = []   # [{"name": str, "quantity": int}]
scan_history:  list[dict] = []   # list of past scan result summaries


# ── Request / Response models ─────────────────────────────────────────────────

class ScanRequest(BaseModel):
    frame_b64:  str  = ""    # single stitched frame (correct)
    frames_b64: list = []    # array of frames (fallback if frontend sends this)
    expected:   list = []

class MedicineItem(BaseModel):
    name:     str
    quantity: int = 1

class ExpectedListPayload(BaseModel):
    medicines: list[MedicineItem]


# ── Helpers ───────────────────────────────────────────────────────────────────

def b64_to_frame(b64: str) -> np.ndarray:
    """Decode a base64 JPEG string to a BGR numpy array."""
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    img_bytes = base64.b64decode(b64)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image from base64")
    return frame


def stitch_frames(frames: list) -> np.ndarray:
    """
    Rotate each camera frame to match the display orientation, then stitch
    side-by-side into a single wide image.

    Camera mounting orientation (matches CSS in CameraSection.jsx):
      cam0 → rotate -90° (CCW)  — CSS: rotate(-90deg)
      cam1 → rotate +90° (CW)   — CSS: rotate(90deg)

    Two 1920×1080 raw frames each become 1080×1920 after rotation,
    producing a final 2160×1920 stitched frame that matches what the
    pharmacist sees on screen.
    """
    if len(frames) == 1:
        return frames[0]

    # Rotate to match display orientation
    f0 = cv2.rotate(frames[0], cv2.ROTATE_90_COUNTERCLOCKWISE)
    f1 = cv2.rotate(frames[1], cv2.ROTATE_90_CLOCKWISE)

    # Normalise heights in case they differ
    h0 = f0.shape[0]
    if f1.shape[0] != h0:
        scale = h0 / f1.shape[0]
        f1 = cv2.resize(f1, (int(f1.shape[1] * scale), h0))

    return cv2.hconcat([f0, f1])


def best_ocr_label(ocr_texts: list, threshold: float = 85.0) -> str:
    if not ocr_texts:
        return ""
    if len(ocr_texts) == 1:
        return ocr_texts[0]
    best_text, best_score = ocr_texts[0], 0.0
    for text in ocr_texts:
        if not text or not text.strip():
            continue
        _, score = db_match(normalize_ocr(text.lower()), medicine_db, threshold=threshold)
        if score > best_score:
            best_score, best_text = score, text
    return best_text


def frame_to_b64(frame: np.ndarray) -> str:
    """Encode a BGR numpy frame to base64 JPEG for sending back to the browser."""
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "db_entries": len(medicine_db)}


# ── /medicines ────────────────────────────────────────────────────────────────

@app.get("/medicines")
def get_medicines():
    return {"medicines": expected_list}


@app.post("/medicines")
def set_medicines(payload: ExpectedListPayload):
    global expected_list
    expected_list = [{"name": m.name.upper(), "quantity": m.quantity}
                     for m in payload.medicines]
    return {"medicines": expected_list}


@app.delete("/medicines")
def clear_medicines():
    global expected_list
    expected_list = []
    return {"medicines": []}


# ── /scan ─────────────────────────────────────────────────────────────────────

@app.post("/scan")
def scan(req: ScanRequest):
    """
    Main scan endpoint.
    Receives one or two base64 PNG frames from the browser.
    If two frames are provided they are stitched into a single 3840×1080
    image before being passed to Layer 1 (imgsz=3840 preserves per-camera
    resolution).  All downstream layers work on the stitched frame and its
    coordinates — no per-camera x-offset bookkeeping needed.
    """

    t_start = time.time()
    try:
        if req.frame_b64:
            # Already stitched by the frontend — use as-is
            stitched = b64_to_frame(req.frame_b64)
            original_frames = [stitched]

        elif req.frames_b64:
            frames = [b64_to_frame(f) for f in req.frames_b64 if f]
            if len(frames) == 0:
                raise HTTPException(status_code=400, detail="No valid frames provided")
            # Stitch here — two 1920×1080 → one 3840×1080
            stitched = stitch_frames(frames)
            original_frames = frames   # kept only for L4 debug image logging

        else:
            raise HTTPException(status_code=400, detail="No frame provided")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    t_frames = time.time()
    print(f"[TIMER] Frame decode:     {t_frames - t_start:.2f}s")

    # ── Layer 1 — shape detection on the stitched frame ───────────────────────
    # Single YOLO call at imgsz=3840 so each camera half stays at full
    # 1920×1080 resolution.  All bbox coordinates are already in stitched space
    # so no x-offset adjustment is needed.
    boxes, contents = [], []

    annotated, dets = layer1_detect(stitched, layer1_model, medicine_db)

    for d in dets:
        if d["cls"] == BOX_CLASS_ID:
            boxes.append({
                "box_id": len(boxes) + 1,
                "bbox":   d["bbox"],
                "conf":   d["conf"],
                "qrs":    [],
                "labels": [],
            })
        else:
            contents.append(d)

    t_l1 = time.time()
    print(f"[TIMER] Layer 1:          {t_l1 - t_frames:.2f}s  ({len(boxes)} boxes, {len(contents)} labels/QRs)")

    # ── Layers 2 & 3 — QR and OCR (sequential) ────────────────────────────────
    for d in contents:
        if d["cls"] == QR_CLASS_ID:
            data_text    = layer2_read_qr(d["crop"]) or "[decode failed]"
            layer3_score = 0.0
        else:
            result = layer3_read_label(d["crop"], medicine_db)
            if result:
                data_text, layer3_score = result
            else:
                data_text    = "[no text found]"
                layer3_score = 0.0

        lx1, ly1, lx2, ly2 = d["bbox"]
        cx, cy = (lx1 + lx2) / 2, (ly1 + ly2) / 2

        best_box  = None
        best_dist = float("inf")
        for b in boxes:
            bx1, by1, bx2, by2 = b["bbox"]
            if bx1 <= cx <= bx2 and by1 <= cy <= by2:
                bcx  = (bx1 + bx2) / 2
                bcy  = (by1 + by2) / 2
                dist = ((cx - bcx) ** 2 + (cy - bcy) ** 2) ** 0.5
                if dist < best_dist:
                    best_dist = dist
                    best_box  = b

        if best_box:
            if d["cls"] == QR_CLASS_ID:
                best_box["qrs"].append(data_text)
            else:
                best_box["labels"].append((data_text, layer3_score))

    t_l23 = time.time()
    print(f"[TIMER] Layer 2/3 OCR:    {t_l23 - t_l1:.2f}s")

    # ── Layer 4 — deferred (only when OCR is weak) ────────────────────────────
    layer4_detections = None

    def get_layer4():
        nonlocal layer4_detections
        if layer4_detections is None:
            # Pass the stitched frame; original_frames kept for debug logging
            layer4_detections = layer4_scan_full_frame(stitched)
        return layer4_detections

    # Build expected quantity map — handles both formats:
    #   ["SEFLOC", "ATENOLOL"]               (plain strings, quantity defaults to 1)
    #   [{"name":"SEFLOC","quantity":2}, ...] (objects with quantity)
    expected_qty: dict = {}
    for item in req.expected:
        if isinstance(item, str):
            n, q = item.upper().strip(), 1
        else:
            n = item.get("name", "").upper().strip()
            q = int(item.get("quantity", 1))
        if n:
            expected_qty[n] = expected_qty.get(n, 0) + q

    # Track how many of each medicine were found during this scan
    found_counts: dict = {}
    results = []

    for b in boxes:
        # Labels stored as (texts, layer3_db_score) tuples.
        # Unpack texts for best_ocr_label, track highest layer3 score per box.
        all_ocr       = []
        best_l3_score = 0.0
        for lbl in b["labels"]:
            if isinstance(lbl, tuple):
                texts, l3_score = lbl
                try:
                    best_l3_score = max(best_l3_score, float(np.array(l3_score).flat[0]))
                except Exception:
                    pass
                items = texts if isinstance(texts, list) else [texts]
            elif isinstance(lbl, list):
                items = lbl
            else:
                items = [lbl]
            all_ocr.extend(items)

        all_qr = [qr for qr in b["qrs"] if qr and qr != "[decode failed]"]
        ocr_in = best_ocr_label(all_ocr)

        ocr_db_name, ocr_db_score = (None, 0.0)
        if ocr_in:
            ocr_db_name, ocr_db_score = db_match(
                normalize_ocr(ocr_in.lower()), medicine_db)

        # If layer3 internal score is higher than re-scoring raw text, use it.
        if best_l3_score > ocr_db_score:
            print(f"  [L3 score boost] layer3={best_l3_score:.2f} > rescore={ocr_db_score:.2f}")
            ocr_db_score = best_l3_score

        qr_present = len(all_qr) > 0
        ocr_high   = db_confidence_tier(ocr_db_score) == "HIGH"

        if not qr_present and not ocr_high:
            dets = get_layer4()
            vision_name, vision_conf = layer4_match_to_box(dets, b["bbox"])
        else:
            vision_name, vision_conf = "UNKNOWN", 0.0

        verdict = consensus_check(
            ocr_texts   = [ocr_in],
            qr_texts    = all_qr,
            vision_name = vision_name,
            vision_conf = vision_conf,
            medicine_db = medicine_db,
        )

        name = verdict["final_name"].upper()

        if verdict["final_name"] == "PENDING_REVIEW":
            scan_status = "PENDING_REVIEW"
        elif verdict["final_name"] == "UNKNOWN":
            scan_status = "UNKNOWN"
        elif name in expected_qty:
            found_counts[name] = found_counts.get(name, 0) + 1
            if found_counts[name] <= expected_qty[name]:
                scan_status = "MATCHED"     # within expected quantity
            else:
                scan_status = "EXTRA"       # found more than expected
        else:
            scan_status = "EXTRA"           # not in expected list

        results.append({
            "box_id":          b["box_id"],
            "bbox":            list(b["bbox"]),
            "final_name":      verdict["final_name"],
            "confidence":      verdict["confidence"],
            "layer4_note":     verdict["layer4_note"],
            "status":          verdict["status"],
            "scan_status":     scan_status,
            "ocr_raw":         verdict["ocr_raw"],
            "qr_name":         verdict["qr_name"],
            "reference_image": None,
        })

    # Draw UNKNOWN boxes on the annotated frame so the pharmacist can see
    # which physical box the system couldn't identify
    for r in results:
        if r["scan_status"] != "UNKNOWN" or not r["bbox"]:
            continue
        x1, y1, x2, y2 = r["bbox"]

        # Bright orange border — distinct from YOLO's default colours
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 140, 255), 3)

        # "? UNKNOWN" label with filled background for readability
        label      = "? UNKNOWN"
        font       = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.8
        thickness  = 2
        (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)

        # Clamp label above box — don't let it go off screen
        label_y = max(y1, th + baseline + 6)
        cv2.rectangle(annotated,
                      (x1, label_y - th - baseline - 6),
                      (x1 + tw + 6, label_y),
                      (0, 140, 255), -1)
        cv2.putText(annotated, label,
                    (x1 + 3, label_y - baseline - 3),
                    font, font_scale, (255, 255, 255), thickness)

    # Mark MISSING — one entry PER missing unit so the list count
    # matches the summary number (3 missing Sefloc = 3 list entries).
    for name, qty_needed in expected_qty.items():
        qty_found   = found_counts.get(name, 0)
        qty_missing = qty_needed - qty_found
        for i in range(qty_missing):
            results.append({
                "box_id":          None,
                "bbox":            None,
                "final_name":      name,
                "confidence":      "NONE",
                "layer4_note":     f"Expected {qty_needed}× — only {qty_found} found",
                "status":          "❌ Not detected",
                "scan_status":     "MISSING",
                "ocr_raw":         "",
                "qr_name":         None,
                "reference_image": find_medicine_image(name),
                "qty_expected":    qty_needed,
                "qty_found":       qty_found,
                "qty_missing":     qty_missing,
                "unit_index":      i + 1,
            })

    # Summary counts
    matched = sum(1 for r in results if r["scan_status"] == "MATCHED")
    missing = sum(1 for r in results if r["scan_status"] == "MISSING")
    extra   = sum(1 for r in results if r["scan_status"] == "EXTRA")
    review  = sum(1 for r in results if r["scan_status"] == "PENDING_REVIEW")

    # Save annotated frame (stitched, with all detections drawn)
    ts       = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = os.path.join(LOG_DIR, f"scan_result_{ts}.jpg")
    cv2.imwrite(out_path, annotated)

    # Save Layer 4 debug image
    l4_out_path      = None
    l4_annotated_b64 = None
    if layer4_detections is not None:
        from pipeline.layer4_vision import layer4_draw_annotated

        if len(original_frames) > 1:
            # Save one debug image per camera — un-offset bbox back to camera-local coords
            cam0_w = original_frames[0].shape[1]
            for cam_idx, cam_frame in enumerate(original_frames):
                x_off = cam_idx * cam0_w
                cam_dets = []
                for d in layer4_detections:
                    x1, y1, x2, y2 = d["bbox"]
                    cx = (x1 + x2) / 2
                    if x_off <= cx < (x_off + cam_frame.shape[1]):
                        cam_dets.append({**d, "bbox": (x1 - x_off, y1, x2 - x_off, y2)})

                l4_img      = layer4_draw_annotated(cam_frame, cam_dets)
                cam_path    = os.path.join(LOG_DIR, f"scan_layer4_{ts}_cam{cam_idx}.jpg")
                cv2.imwrite(cam_path, l4_img)
                print(f"[Scan] Saved L4 debug cam{cam_idx} → {cam_path}")
                if cam_idx == 0:
                    l4_out_path      = cam_path
                    l4_annotated_b64 = frame_to_b64(l4_img)
        else:
            l4_img       = layer4_draw_annotated(original_frames[0], layer4_detections)
            l4_out_path  = os.path.join(LOG_DIR, f"scan_layer4_{ts}.jpg")
            cv2.imwrite(l4_out_path, l4_img)
            l4_annotated_b64 = frame_to_b64(l4_img)
            print(f"[Scan] Saved L4 debug image → {l4_out_path}")

    # Add to scan history
    history_entry = {
        "id":        str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "matched":   matched,
        "missing":   missing,
        "extra":     extra,
        "review":    review,
        "medicines": [r["final_name"] for r in results
                      if r["scan_status"] == "MATCHED"],
        "summary":   results[0]["final_name"] if results else "No medicines",
    }
    scan_history.insert(0, history_entry)
    if len(scan_history) > 50:
        scan_history.pop()

    t_end = time.time()
    print(f"[TIMER] Layer 4+consensus:{t_end - t_l23:.2f}s")
    print(f"[TIMER] -- TOTAL -------- {t_end - t_start:.2f}s")

    return {
        "results":        results,
        "summary":        {"matched": matched, "missing": missing,
                           "extra": extra, "review": review},
        "annotated_b64":    frame_to_b64(annotated),
        "l4_annotated_b64": l4_annotated_b64,
        "saved_to":         out_path,
        "timestamp":      datetime.now().isoformat(),
    }


@app.get("/scan/history")
def get_history():
    return {"history": scan_history}


@app.delete("/scan/history")
def clear_history():
    scan_history.clear()
    return {"history": []}