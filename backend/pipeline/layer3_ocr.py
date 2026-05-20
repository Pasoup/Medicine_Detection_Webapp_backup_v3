import cv2
import numpy as np
import re
import easyocr

from backend.config import (
    OCR_LANGUAGES,
    OCR_TEXT_THRESHOLD, OCR_LOW_TEXT,
    OCR_WIDTH_THS, OCR_CONF_KEEP,
    OCR_ORIENT_MIN_H,
)
from utils.medicine_db import db_match, normalize_ocr

_reader = easyocr.Reader(OCR_LANGUAGES)


def _to_float(x) -> float:
    """Safely convert anything (plain float, numpy scalar, 0-d array) to float."""
    try:
        return float(np.array(x).flat[0])
    except Exception:
        return 0.0


# ── Contrast variants ─────────────────────────────────────────────────────────

def get_high_contrast_variants(img: np.ndarray) -> list:

    variants = []
    h, w     = img.shape[:2]

    pad_y       = max(2, int(h * 0.05))
    pad_x       = max(2, int(w * 0.05))
    trimmed     = img[pad_y:h - pad_y, pad_x:w - pad_x]
    gray        = cv2.cvtColor(trimmed, cv2.COLOR_BGR2GRAY) \
                  if len(trimmed.shape) == 3 else trimmed

    clahe       = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(4, 4))
    lut         = np.array([((i / 255.0) ** 0.4) * 255
                             for i in range(256)], dtype=np.uint8)
    brightened  = cv2.LUT(gray, lut)
    _, otsu     = cv2.threshold(brightened, 0, 255,
                                cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    variants += [
        gray,                       # raw grayscale — most common winner
        clahe.apply(gray),          # low contrast labels
        otsu,                       # high contrast / clean labels
        brightened,                 # dark labels
        cv2.bitwise_not(gray),      # inverted — light text on dark background
        cv2.bitwise_not(otsu),      # inverted binary
        cv2.equalizeHist(gray),     # uneven lighting
        trimmed,                    # original colour — coloured text labels
    ]
    # Colour channel splits removed — rarely win and add 3 extra EasyOCR calls

    return variants


# ── Score OCR results against the medicine DB ─────────────────────────────────

def ocr_db_score(results: list, medicine_db: list) -> tuple[float, list[str]]:
    """
    Score EasyOCR results by how well they match the medicine DB.

    Primary signal: best db_match score across individual segments and joined.
    Fallback: raw confidence sum × 0.1 when nothing matches DB — guarantees
    any DB match always beats a non-DB match in variant/orientation selection.

    Returns (score: float, texts: list[str]).
    """
    if not results:
        return 0.0, []

    texts = [t for _, t, c in results if _to_float(c) > OCR_CONF_KEEP]
    if not texts:
        return 0.0, []

    best_db_score = 0.0

    # Score each segment individually
    for t in texts:
        _, score = db_match(normalize_ocr(t.lower()), medicine_db)
        score = _to_float(score)
        if score > best_db_score:
            best_db_score = score

    # Also score all segments joined — catches split medicine names
    # e.g. ["escitalopram", "sandoz"] → "escitalopram sandoz" → better match
    joined = " ".join(texts)
    _, joined_score = db_match(normalize_ocr(joined.lower()), medicine_db)
    joined_score = _to_float(joined_score)
    if joined_score > best_db_score:
        best_db_score = joined_score

    if best_db_score > 0.0:
        return best_db_score, texts

    # Nothing matched DB — fallback so we still pick the least-bad variant
    fallback = sum(_to_float(c) for _, _, c in results if _to_float(c) > OCR_CONF_KEEP) * 0.1
    return fallback, texts


# ── Best score across contrast variants ───────────────────────────────────────

def best_score_for(candidate: np.ndarray, medicine_db: list) -> tuple[float, list[str]]:
    """
    Run EasyOCR over all contrast variants of *candidate*.
    Picks the variant with the best DB match score.
    Returns (best_score: float, best_texts: list[str]).
    """
    best_score = 0.0
    best_texts = []

    for v in get_high_contrast_variants(candidate):
        try:
            results = _reader.readtext(
                v, detail=1, paragraph=False,
                width_ths=OCR_WIDTH_THS,
                text_threshold=OCR_TEXT_THRESHOLD,
                low_text=OCR_LOW_TEXT,
            )
            if not results:
                results = _reader.readtext(
                    v, detail=1, paragraph=False,
                    width_ths=1.0,
                    text_threshold=0.2,
                    low_text=0.1,
                    mag_ratio=2.0,
                )
            s, texts = ocr_db_score(results, medicine_db)
            s = _to_float(s)
            if s > best_score:
                best_score = s
                best_texts = texts
            if best_score >= 92.0:
                break
        except Exception:
            continue

    return best_score, best_texts


# ── Orientation correction ────────────────────────────────────────────────────

def correct_orientation(crop: np.ndarray, medicine_db: list) -> tuple[np.ndarray, list[str]]:
    """
    Try 0° and 180° rotations, pick the one with the better DB match score.
    Upscales the crop if it is too small for reliable OCR.

    Returns (best_crop, best_texts) — winning crop and its texts so the caller
    doesn't need to re-run OCR.
    """
    h, w = crop.shape[:2]

    # Ensure landscape orientation
    if h > w:
        crop = cv2.rotate(crop, cv2.ROTATE_90_CLOCKWISE)
        h, w = crop.shape[:2]

    # Upscale if too small — EasyOCR struggles below OCR_ORIENT_MIN_H
    if h < OCR_ORIENT_MIN_H:
        scale = OCR_ORIENT_MIN_H / h
        crop  = cv2.resize(crop,
                           (int(w * scale), int(h * scale)),
                           interpolation=cv2.INTER_CUBIC)
        h, w = crop.shape[:2]

    # Downscale if too large — EasyOCR gets slow on large crops,
    # and medicine label text doesn't need more than 800px height to read
    MAX_H = 800
    if h > MAX_H:
        scale = MAX_H / h
        crop  = cv2.resize(crop,
                           (int(w * scale), int(h * scale)),
                           interpolation=cv2.INTER_AREA)
        print(f"  [L3] Downscaled crop from {h}px to {MAX_H}px height")

    candidates = {0: crop, 180: cv2.rotate(crop, cv2.ROTATE_180)}
    best_crop  = crop
    best_score = -1.0
    best_texts: list[str] = []

    for angle, candidate in candidates.items():
        score, texts = best_score_for(candidate, medicine_db)
        score = _to_float(score)
        print(f"  [orient] {angle}°  db_score={score:.2f}  texts={texts}")
        if score > best_score:
            best_score = score
            best_crop  = candidate
            best_texts = texts
        if best_score >= 92.0: 
            break

    return best_crop, best_texts


# ── Public API ────────────────────────────────────────────────────────────────

def layer3_read_label(crop: np.ndarray, medicine_db: list) -> tuple[list, float] | None:
    """
    Read text from a label crop.

    Returns (texts, best_db_score: float) so server.py can use the score
    computed during variant/orientation selection directly — without re-scoring
    from raw text and losing the best variant's result.

    Returns None if crop is empty or no text found.
    """
    if crop is None or crop.size == 0:
        return None

    # Sharpen before OCR
    kernel = np.array([[0, -1, 0],
                       [-1,  5, -1],
                       [0, -1, 0]])
    crop = cv2.filter2D(crop, -1, kernel)

    best_score, texts = correct_orientation(crop, medicine_db)
    if not texts:
        return None

    return texts, _to_float(best_score)