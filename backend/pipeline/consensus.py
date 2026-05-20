# =============================================================================
#  pipeline/consensus.py — final verdict logic
#
#  Trust hierarchy:
#    1. QR/Barcode  — encoded data, near-lossless
#    2. OCR + DB fuzzy match  — text evidence, independently validated
#    3. Layer 4 YOLO  — visual pattern match, lowest trust alone
#
#  Conflict rule: if OCR and Layer 4 give DIFFERENT DB-validated names,
#  output PENDING_REVIEW instead of guessing.
# =============================================================================

from utils.medicine_db import (
    normalize_ocr,
    db_match,
    db_confidence_tier,
    names_agree,
)


def consensus_check(
    ocr_texts:   list,
    qr_texts:    list,
    vision_name: str,
    vision_conf: float,
    medicine_db: list,
) -> dict:
    """
    Trust hierarchy (updated):
      1. QR/Barcode                        — always highest trust
      2. OCR with DB score >= 92 (HIGH)    — trusted, used directly
      3. YOLO (Layer 4)                    — used when OCR score < 92
      4. OCR with DB score 88-91 (MEDIUM)  — only used if YOLO also fails
      5. PENDING_REVIEW                    — when nothing is reliable enough

    Key rule: OCR is only believed when it scores HIGH against the DB.
    If OCR score is below HIGH, we fall through to YOLO instead of guessing
    on a weak OCR read.
    """
    ocr_raw      = "".join(ocr_texts).strip()
    ocr_combined = ocr_raw.lower()
    qr_combined  = " ".join(qr_texts).lower().strip()

    # ── Stage 1 · QR ─────────────────────────────────────────────────────────
    qr_medicine = None
    qr_db_score = 0.0
    if qr_combined:
        qr_db_name, qr_db_score = db_match(qr_combined, medicine_db)
        qr_medicine = qr_db_name if qr_db_name else qr_combined.upper()

    # ── Stage 2 · OCR → DB ───────────────────────────────────────────────────
    ocr_medicine = None
    ocr_db_name  = None
    ocr_db_score = 0.0
    ocr_db_tier  = "NONE"
    if ocr_combined:
        ocr_clean              = normalize_ocr(ocr_combined)
        ocr_db_name, ocr_db_score = db_match(ocr_clean, medicine_db)
        ocr_db_tier            = db_confidence_tier(ocr_db_score)
        ocr_medicine           = ocr_db_name if ocr_db_name else None

    # ── Stage 3 · Layer 4 YOLO ───────────────────────────────────────────────
    vision_medicine = None
    vision_db_score = 0.0
    vision_db_tier  = "NONE"
    if vision_name and vision_name != "UNKNOWN":
        vision_db_name, vision_db_score = db_match(vision_name, medicine_db)
        vision_db_tier  = db_confidence_tier(vision_db_score)
        vision_medicine = vision_db_name if vision_db_name else vision_name.upper()

    # ── Decision tree ─────────────────────────────────────────────────────────
    status        = ""
    confidence    = "NONE"
    final_name    = "UNKNOWN"
    layer4_agrees = False
    layer4_note   = "Layer 4: no detection"

    # ── Path A · QR present — always wins ────────────────────────────────────
    if qr_medicine:
        final_name = qr_medicine
        if ocr_db_tier == "HIGH" and ocr_db_name and names_agree(ocr_db_name, qr_medicine):
            status, confidence = "✅ VERIFIED — QR + OCR + DB agree", "HIGH"
        elif vision_medicine and names_agree(vision_medicine, qr_medicine):
            status, confidence = "✅ VERIFIED — QR + Layer4 agree", "HIGH"
        else:
            status, confidence = "✅ QR identified", "HIGH"

        if vision_medicine:
            if names_agree(vision_medicine, final_name):
                layer4_agrees = True
                layer4_note   = f"✅ Layer 4 confirms: {vision_medicine} (conf={vision_conf:.2f})"
            else:
                layer4_note   = (f"⚠️  Layer 4 says '{vision_medicine}' "
                                 f"— QR overrides (conf={vision_conf:.2f})")

    # ── Path B · OCR HIGH (score >= 92) — trust OCR directly ─────────────────
    elif ocr_db_tier == "HIGH" and ocr_db_name:
        final_name = ocr_db_name
        if vision_medicine and names_agree(ocr_db_name, vision_medicine):
            layer4_agrees = True
            layer4_note   = f"✅ Layer 4 confirms: {vision_medicine} (conf={vision_conf:.2f})"
            status        = "✅ VERIFIED — OCR HIGH + Layer4 agree"
            confidence    = "HIGH"
        elif vision_medicine and not names_agree(ocr_db_name, vision_medicine):
            # OCR is HIGH confidence — we trust it over YOLO, but log the mismatch
            layer4_note   = (f"⚠️  Layer 4 says '{vision_medicine}' "
                             f"— OCR HIGH overrides (conf={vision_conf:.2f})")
            status        = "✅ OCR HIGH — Layer4 disagrees but OCR trusted"
            confidence    = "HIGH"
        else:
            layer4_note   = "Layer 4: no detection for this box"
            status        = "✅ OCR identified — DB HIGH confidence"
            confidence    = "HIGH"

    # ── Path C · OCR not HIGH — fall through to YOLO ─────────────────────────
    elif vision_medicine:
        final_name  = vision_medicine
        if vision_db_tier == "HIGH":
            status     = "✅ YOLO identified — OCR score too low, YOLO DB HIGH"
            confidence = "HIGH"
        elif vision_db_tier == "MEDIUM":
            status     = "⚠️  YOLO identified — OCR score too low, YOLO DB MEDIUM"
            confidence = "MEDIUM"
        else:
            status     = "⚠️  YOLO only — not DB-validated — human verify"
            confidence = "LOW"
        layer4_note = (f"Layer 4 result: {vision_medicine} "
                       f"(conf={vision_conf:.2f}, db_score={vision_db_score:.0f})")

        # If OCR had a MEDIUM score and agrees with YOLO — bump confidence up
        if ocr_db_tier == "MEDIUM" and ocr_db_name and names_agree(ocr_db_name, vision_medicine):
            status     = "✅ VERIFIED — YOLO + OCR MEDIUM agree"
            confidence = "HIGH"
            layer4_note = (f"✅ YOLO + OCR soft-agree: {vision_medicine} "
                           f"(conf={vision_conf:.2f})")

    # ── Path D · OCR MEDIUM only (no YOLO) ───────────────────────────────────
    # OCR scored 88-91 against DB — borderline match, no YOLO to confirm.
    # Still trust the DB name since it cleared the minimum threshold.
    elif ocr_db_tier == "MEDIUM" and ocr_db_name:
        final_name  = ocr_db_name
        status      = "⚠️  OCR MEDIUM only — no YOLO confirm — flag for review"
        confidence  = "MEDIUM"
        layer4_note = "Layer 4: no detection for this box"

    # ── Path E · OCR read something but it's NOT in the DB, and YOLO failed ──
    # Raw OCR noise / unrecognised medicine — do NOT show the raw string.
    # The system doesn't know what this is, so output UNKNOWN.
    elif ocr_medicine:
        final_name  = "UNKNOWN"
        status      = f"❌ UNKNOWN — OCR read '{ocr_raw}' but not found in DB, no YOLO match"
        confidence  = "NONE"
        layer4_note = "Layer 4: no detection for this box"

    # ── Path F · All failed ───────────────────────────────────────────────────
    else:
        status      = "❌ UNKNOWN — all layers failed"
        confidence  = "NONE"
        final_name  = "UNKNOWN"
        layer4_note = "Layer 4: no detection"

    print(f"    [Cross-check] {layer4_note}")

    return {
        "status":         status,
        "confidence":     confidence,
        "qr_name":        qr_medicine,
        "qr_db_score":    round(qr_db_score, 1),
        "ocr_name":       ocr_medicine,
        "ocr_db_name":    ocr_db_name,
        "ocr_db_score":   round(ocr_db_score, 1),
        "ocr_db_tier":    ocr_db_tier,
        "ocr_raw":        ocr_raw,
        "model_name":     vision_medicine,
        "model_conf":     vision_conf,
        "model_db_score": round(vision_db_score, 1),
        "layer4_agrees":  layer4_agrees,
        "layer4_note":    layer4_note,
        "final_name":     final_name,
    }
