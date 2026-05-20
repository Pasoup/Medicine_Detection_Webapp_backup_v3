import cv2
import numpy as np
import zxingcpp
import pandas as pd
import os
import logging

logger = logging.getLogger(__name__)

# ── Load DB once at import ────────────────────────────────────────────────────
_current_dir = os.path.dirname(os.path.abspath(__file__))
_db_path     = os.path.join(_current_dir, 'Medicine_name_db.xlsx')

try:
    _df = pd.read_excel(_db_path)
    _MEDICINE_LOOKUP: dict = dict(zip(_df['item'].astype(str).str.strip(),
                                      _df['ชื่อยา']))
    logger.info(f"Layer2 DB loaded: {len(_MEDICINE_LOOKUP)} entries")
    print(f"[L2] DB loaded: {len(_MEDICINE_LOOKUP)} entries")
except Exception as e:
    logger.error(f"Layer2 failed to load DB: {e}")
    print(f"[L2] DB load FAILED: {e}")
    _MEDICINE_LOOKUP = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _upscale(img: np.ndarray, target: int = 800) -> np.ndarray:
    """Upscale so the short side is at least `target` pixels."""
    h, w  = img.shape[:2]
    short = min(h, w)
    if short >= target:
        return img
    scale = target / short
    
    return cv2.resize(img, (int(w * scale), int(h * scale)),
                      interpolation=cv2.INTER_LANCZOS4)


def _lookup(raw_text: str, rot_name: str, var_name: str) -> str:
    """Parse QR text, look up in DB. Returns drug name or raw item ID."""
    item_id   = raw_text.split('@')[0].strip()
    drug_name = _MEDICINE_LOOKUP.get(item_id)
    if drug_name:
        logger.info(f"QR decoded ✓ rot={rot_name} var={var_name} → {drug_name}")
        print(f"  [L2] ✓ rot={rot_name} var={var_name} → {drug_name}")
        return drug_name
    else:
        logger.warning(f"QR decoded but '{item_id}' not in DB "
                       f"(rot={rot_name}, var={var_name})")
        print(f"  [L2] QR decoded but '{item_id}' NOT in DB — "
              f"check Medicine_name_db.xlsx")
        return item_id


def _decode_image(img: np.ndarray) -> str | None:
    """
    Try zxingcpp on a single image.
    Pass 1: all formats (fast).
    Pass 2: QR-only restriction (sometimes succeeds when broad scan fails).
    """
    try:
        results = zxingcpp.read_barcodes(img)
        if results:
            return results[0].text

        results = zxingcpp.read_barcodes(
            img,
            formats=zxingcpp.BarcodeFormat.QRCode,
        )
        if results:
            return results[0].text

    except Exception as e:
        logger.warning(f"zxingcpp error: {e}")
    return None


def _best_variants(gray: np.ndarray) -> list[tuple[str, np.ndarray]]:
    # Standard sharpening
    blurred   = cv2.GaussianBlur(gray, (0, 0), 3)
    sharpened = cv2.addWeighted(gray, 2.5, blurred, -1.5, 0)

    # Thresholds
    _, otsu_gray  = cv2.threshold(gray,      0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    _, otsu_sharp = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # CLAHE — local contrast enhancement
    clahe     = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    clahe_img = clahe.apply(gray)

    # Adaptive threshold — handles lighting gradients
    adaptive = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )


    kernel_agg  = np.array([[-1, -1, -1],
                             [-1,  9, -1],
                             [-1, -1, -1]])
    agg_sharp   = cv2.filter2D(gray, -1, kernel_agg)
    _, otsu_agg = cv2.threshold(agg_sharp, 0, 255,
                                cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Gamma darkening — recovers faint/faded modules
    lut_dark     = np.array([((i / 255.0) ** 0.5) * 255
                              for i in range(256)], dtype=np.uint8)
    darkened     = cv2.LUT(gray, lut_dark)

    # Inverted — light-on-dark QR codes
    inv_otsu = cv2.bitwise_not(otsu_gray)

    return [
        ("otsu_sharp", otsu_sharp),   # clean QRs — most common winner
        ("otsu_gray",  otsu_gray),    # standard threshold
        ("clahe",      clahe_img),    # low contrast / uneven lighting
        ("adaptive",   adaptive),     # lighting gradient
        ("otsu_agg",   otsu_agg),     # damaged / dirty modules
        ("darkened",   darkened),     # faint / faded QR codes
        ("inv_otsu",   inv_otsu),     # inverted QR codes
    ]


def _deskew(gray: np.ndarray) -> np.ndarray:
    """
    Detect and correct the skew angle of a tilted QR crop.
    Handles QR codes at non-right-angle tilts (5°, 15°, 22°, etc.)
    that the 3-rotation pass cannot correct.

    Uses Hough line detection on edges to find the dominant angle,
    then rotates the image to correct it.
    Only corrects angles > 2° — tiny angles don't affect decode.
    Returns deskewed image, or original if no significant skew found.
    """
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=80)

    if lines is None:
        return gray

    angles = []
    for line in lines:
        rho, theta = line[0]
        angle = np.degrees(theta) - 90
        if -45 <= angle <= 45:
            angles.append(angle)

    if not angles:
        return gray

    skew_angle = float(np.median(angles))

    if abs(skew_angle) < 2.0:
        return gray

    print(f"  [L2] Deskew: detected angle={skew_angle:.1f}°, correcting")

    h, w   = gray.shape[:2]
    centre = (w // 2, h // 2)
    M      = cv2.getRotationMatrix2D(centre, skew_angle, 1.0)
    return cv2.warpAffine(gray, M, (w, h),
                          flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_REPLICATE)


# ── Public API ────────────────────────────────────────────────────────────────

def layer2_read_qr(crop: np.ndarray) -> str | None:
    """
    Attempt to decode a QR code from a medicine box crop.

    Strategy:
      Pass 1 — 3 rotations (0°, 90°, 180°) × 7 variants = 21 attempts
               Covers the vast majority of real-world QR orientations
               270° omitted — almost never the correct orientation
      Pass 2 — Deskew to correct non-right-angle tilt + 7 variants = 7 attempts
               Handles QR codes at 5°, 15°, 22° etc.

    Total: 28 attempts — fast, targeted, covers all known failure modes.

    Returns Thai medicine name, raw item ID (if not in DB), or None.
    """
    if crop is None or crop.size == 0:
        return None

    # PNG round-trip — removes any JPEG block artifacts
    _, buf = cv2.imencode('.png', crop)
    crop   = cv2.imdecode(buf, cv2.IMREAD_COLOR)

    # Upscale to at least 800px on the short side (Lanczos for detail)
    crop = _upscale(crop, target=800)

    # Convert to gray once — all variants derived from this
    gray     = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    variants = _best_variants(gray)

    # 3 rotations — 270° omitted as it's almost never the correct orientation
    rotations      = [0, cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_180]
    rotation_names = ["0°", "90°", "180°"]

    # ── Pass 1: 3 rotations × 7 variants = 21 attempts ───────────────────────
    for rot_code, rot_name in zip(rotations, rotation_names):
        for var_name, var_img in variants:
            img_to_try = var_img if rot_code == 0 else cv2.rotate(var_img, rot_code)
            raw_text   = _decode_image(img_to_try)
            if raw_text:
                return _lookup(raw_text, rot_name, var_name)

    # ── Pass 2: deskew + 7 variants = 7 more attempts ────────────────────────
    # Only runs when Pass 1 fails — handles non-right-angle tilts
    print(f"  [L2] Pass 1 failed — attempting deskew")
    deskewed = _deskew(gray)

    # Only retry if deskew actually changed the image (skew was > 2°)
    if deskewed is not gray:
        deskewed_variants = _best_variants(deskewed)
        for var_name, var_img in deskewed_variants:
            raw_text = _decode_image(var_img)
            if raw_text:
                return _lookup(raw_text, "deskew", var_name)

    logger.info("QR: all 28 variants exhausted, no decode")
    print(f"  [L2] All 28 variants exhausted — QR may be physically too damaged")
    return None