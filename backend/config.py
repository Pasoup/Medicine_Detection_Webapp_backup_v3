# =============================================================================
#  config.py — single source of truth for all constants and thresholds
#  Edit this file to tune behaviour; never hardcode values elsewhere.
# =============================================================================

import os

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR         = os.path.dirname(os.path.abspath(__file__))
LAYER1_MODEL     = os.path.join(BASE_DIR, "models", "best.pt")
MED_BOX_MODEL    = os.path.join(BASE_DIR, "models", "med_box.pt")
MEDICINE_DB_PATH = os.path.join(BASE_DIR, "data",   "medicine_db.csv")
FONT_PATH        = os.path.join(BASE_DIR, "data",   "Sarabun-Regular.ttf")
FONT_URL         = "https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf"
LOG_DIR          = os.path.join(BASE_DIR, "logs")

# ── YOLO class IDs (must match your best.pt training labels) ──────────────────
BOX_CLASS_ID     = 0
LABEL_CLASS_ID   = 1
QR_CLASS_ID      = 2

# ── Layer 1 — shape detection confidence thresholds ───────────────────────────
L1_CONF_RUN      = 0.30   # minimum conf to even run inference
L1_CONF_QR       = 0.50   # minimum conf to keep a QR detection
L1_CONF_OTHER    = 0.4   # minimum conf to keep a box / label detection
L1_PAD_QR        = 40     # perspective-warp padding (px) for QR crops
L1_PAD_OTHER     = 10     # perspective-warp padding (px) for other crops

# ── Layer 3 — OCR ─────────────────────────────────────────────────────────────
OCR_LANGUAGES        = ['en', 'th']
OCR_TEXT_THRESHOLD   = 0.40
OCR_LOW_TEXT         = 0.25
OCR_WIDTH_THS        = 0.90
OCR_CONF_KEEP        = 0.20   # discard OCR tokens below this per-character conf
OCR_ORIENT_MIN_H     = 80     # minimum height (px) before upscaling for orientation


# ── Layer 4 — medicine ID model ───────────────────────────────────────────────
L4_CONF_RUN      = 0.25   # minimum conf passed to YOLO inference
L4_CONF_MIN      = 0.45   # below this → treat Layer 4 result as UNKNOWN
                           # Lowered from 0.75 — current model (7 classes, ~200 imgs/class)
                           # produces meaningful signals at 0.45+. Raise back to 0.65-0.75
                           # once model is retrained with more data.

# ── Medicine DB fuzzy-match thresholds (rapidfuzz token_sort_ratio, 0–100) ────
DB_HIGH_THRESHOLD = 92.0   # score ≥ this → HIGH confidence DB match
DB_LOW_THRESHOLD  = 88.0   # score ≥ this → MEDIUM confidence DB match
                            # score <  this → no match

# ── Camera ────────────────────────────────────────────────────────────────────
CAM_INDEX        = 0
CAM_WIDTH        = 1920
CAM_HEIGHT       = 1080