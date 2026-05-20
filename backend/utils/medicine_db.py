import re
import os
import pandas as pd

from backend.config import (
    MEDICINE_DB_PATH,
    DB_HIGH_THRESHOLD,
    DB_LOW_THRESHOLD,
)

try:
    from rapidfuzz import fuzz, process as rfprocess
    _RAPIDFUZZ_AVAILABLE = True
except ImportError:
    _RAPIDFUZZ_AVAILABLE = False
    print("[WARN] rapidfuzz not installed — falling back to substring match.\n"
          "       Run: pip install rapidfuzz")


# ── Letter-level OCR substitution fixes ───────────────────────────────────────
# These are applied in normalize_ocr() BEFORE fuzzy matching.
# Format: (regex_pattern, replacement)
# Order matters — more specific patterns first.
_LETTER_FIXES = [
    # f → t when it appears as 'fa' after 'esci' (escifalopram → escitalopram)
    (r'(?i)\bescif([aeiou])', r'ESCIT\1'),

    # rn → m  (common EasyOCR split: "arnlodipine" → "amlodipine")
    (r'(?i)rn(?=[a-z])', 'M'),

    # ii → n  (e.g. "ateiiOlol" → "atenolol")
    (r'(?i)ii(?=[a-z])', 'N'),

    # vv → w  (rare but occurs on bold fonts)
    (r'(?i)vv', 'W'),

    # cl → d  (e.g. "amloclipine" → "amlodipine")
    (r'(?i)cl(?=[iou])', r'D'),
]


def load_medicine_db(yolo_class_names: list = None) -> list:

    names = set()

    if os.path.exists(MEDICINE_DB_PATH):
        try:
            df  = pd.read_csv(MEDICINE_DB_PATH)
            col = next(
                (c for c in df.columns if c.strip().lower() == "name"),
                df.columns[0],
            )
            names.update(
                str(v).strip().upper()
                for v in df[col].dropna()
                if str(v).strip()
            )
            print(f"[INFO] Loaded {len(names)} medicine names from '{MEDICINE_DB_PATH}'")
            print(f"INFO: {names}")
        except Exception as exc:
            print(f"[WARN] Could not read medicine DB: {exc}")
    else:
        print(f"[WARN] '{MEDICINE_DB_PATH}' not found — using YOLO class names as fallback.")

    if yolo_class_names:
        names.update(n.strip().upper() for n in yolo_class_names)

    return sorted(names)


def normalize_ocr(text: str) -> str:
    # ── Step 1: digit ↔ letter fixes (only when adjacent to a digit) ──────────
    # Fixes: o→0, O→0, l→1, I→1, S→5, B→8 but ONLY next to digits.
    # Avoids corrupting pure letter words like "Oil", "Sol", etc.
    ocr_fixes = {'o': '0', 'O': '0', 'l': '1', 'I': '1', 'S': '5', 'B': '8'}

    def _fix(m):
        left_digit  = m.group(1) or ''
        ambiguous   = m.group(2) or m.group(3) or ''
        right_digit = m.group(4) or ''
        fixed = ocr_fixes.get(ambiguous, ambiguous)
        return left_digit + fixed + right_digit

    text = re.sub(
        r'(\d)([oOlISB])|([oOlISB])(\d)',
        _fix,
        text,
    )

    # ── Step 2: letter-level substitutions (medicine-specific OCR errors) ──────
    for pattern, replacement in _LETTER_FIXES:
        text = re.sub(pattern, replacement, text)

    # ── Step 3: strip dosage text (irrelevant for name matching) ──────────────
    text = re.sub(
        r'\b\d+\s*(?:mg|mcg|ml|g|iu|tablet|tab|cap|capsule)s?\b',
        '',
        text,
        flags=re.IGNORECASE,
    )

    return ' '.join(text.split())


def db_match(text: str, db: list, threshold: float = DB_LOW_THRESHOLD):

    if not text or not db:
        return None, 0.0

    text_norm    = re.sub(r'[^a-zA-Z0-9\u0e00-\u0e7f]', ' ', text).strip().upper()
    text_nospace = text_norm.replace(' ', '')

    if not text_norm:
        return None, 0.0

    if _RAPIDFUZZ_AVAILABLE:
        best_result = None
        for candidate in [text_norm, text_nospace]:
            result = rfprocess.extractOne(
                candidate, db,
                scorer=fuzz.token_sort_ratio,
                score_cutoff=threshold,
            )
            if result and (best_result is None or result[1] > best_result[1]):
                best_result = result
        if best_result:
            return best_result[0], float(best_result[1])
        return None, 0.0

    else:
        for candidate in [text_norm.lower(), text_nospace.lower()]:
            for name in db:
                if name.lower() in candidate or candidate in name.lower():
                    return name, 80.0
        return None, 0.0


def db_confidence_tier(score: float) -> str:
    if score >= DB_HIGH_THRESHOLD:
        return "HIGH"
    if score >= DB_LOW_THRESHOLD:
        return "MEDIUM"
    return "NONE"


def names_agree(a: str, b: str) -> bool:
    a_l, b_l = a.lower(), b.lower()
    if a_l in b_l or b_l in a_l:
        return True
    if _RAPIDFUZZ_AVAILABLE:
        return fuzz.token_sort_ratio(a_l, b_l) >= DB_LOW_THRESHOLD
    return False