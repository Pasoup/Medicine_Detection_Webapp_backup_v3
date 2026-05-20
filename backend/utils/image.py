import cv2
import numpy as np
import urllib.request
import os
from PIL import ImageFont, ImageDraw, Image

from backend.config import FONT_PATH, FONT_URL, LOG_DIR


# ── Font ──────────────────────────────────────────────────────────────────────

def ensure_font(size: int = 22) -> ImageFont.FreeTypeFont:
    """Download Sarabun (Thai-capable) font on first use, then cache locally."""
    if not os.path.exists(FONT_PATH):
        print("[INFO] Downloading Thai font (one-time)…")
        urllib.request.urlretrieve(FONT_URL, FONT_PATH)
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except Exception:
        return ImageFont.load_default()


def put_text(img: np.ndarray, text: str, position: tuple,
             font_size: int = 22, color: tuple = (0, 0, 0)) -> np.ndarray:
    """
    Drop-in replacement for cv2.putText that supports Thai and Unicode.
    color is BGR (same convention as OpenCV).
    """
    img_pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    draw    = ImageDraw.Draw(img_pil)
    font    = ensure_font(font_size)
    r, g, b = color[2], color[1], color[0]   # BGR → RGB
    draw.text(position, text, font=font, fill=(r, g, b))
    return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)


# ── Geometry ──────────────────────────────────────────────────────────────────

def order_points(pts: np.ndarray) -> np.ndarray:
    """
    Order 4 corner points as [TL, TR, BR, BL].
    Required before any perspective transform.
    """
    pts     = pts.astype("float32")
    ordered = np.zeros((4, 2), dtype="float32")

    s = pts.sum(axis=1)
    ordered[0] = pts[np.argmin(s)]   # TL — smallest x+y
    ordered[2] = pts[np.argmax(s)]   # BR — largest  x+y

    diff = np.diff(pts, axis=1)
    ordered[1] = pts[np.argmin(diff)]  # TR — smallest y-x
    ordered[3] = pts[np.argmax(diff)]  # BL — largest  y-x

    return ordered


def get_perspective(image: np.ndarray, points: np.ndarray,
                    pad: int = 10,
                    debug_idx: int = None,
                    qr_code: bool = False,
                    box: bool = False,
                    correct_orient_fn=None) -> np.ndarray:
    """
    Perspective-warp a detected region to a flat rectangle.

    Parameters
    ----------
    image             : full original frame
    points            : 4 OBB corner points (from YOLO)
    pad               : pixels to expand each side
    debug_idx         : if set, saves a debug image to disk
    qr_code / box     : skip orientation correction for these classes
    correct_orient_fn : callable(crop) → (crop, texts) or crop
                        Injected to avoid circular import. Handles both old
                        (returns crop) and new (returns tuple) signatures.
    """
    rect        = order_points(points)
    tl, tr, br, bl = rect

    tl = [tl[0] - pad, tl[1] - pad]
    tr = [tr[0] + pad, tr[1] - pad]
    br = [br[0] + pad, br[1] + pad]
    bl = [bl[0] - pad, bl[1] + pad]

    rect      = np.array([tl, tr, br, bl], dtype="float32")
    width_a   = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    width_b   = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    max_width = max(int(width_a), int(width_b))

    height_a   = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    height_b   = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    max_height = max(int(height_a), int(height_b))

    if max_width == 0 or max_height == 0:
        return np.zeros((10, 10, 3), dtype=np.uint8)

    dst = np.array([
        [0,             0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0,             max_height - 1],
    ], dtype="float32")

    M      = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (max_width, max_height))

    if not qr_code and not box and correct_orient_fn is not None:
        result = correct_orient_fn(warped)
        # correct_orient_fn may return (crop, texts) or just crop —
        # we only need the crop here; texts are handled by layer3_read_label
        warped = result[0] if isinstance(result, tuple) else result

    if debug_idx is not None:
        path = os.path.join(LOG_DIR, f"debug_crop_{debug_idx}.jpg")
        cv2.imwrite(path, warped)
        print(f"  [DEBUG] Saved {path}  shape={warped.shape}")

    return warped