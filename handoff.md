# MedVerify v3 — Session Handoff

> Updated: 2026-06-02
> Project root: C:\Users\pasul\Desktop\InternStuff\v3_webapp

---

## 1. Project Overview

**MedCheckPro / MedVerify** — A pharmacy medicine verification system built for a Thai hospital internship project. A pharmacist places a bag of medicines under a dual-camera rig, the system scans and identifies each medicine, then compares the result against an expected prescription list.

### Tech Stack

| Layer     | Technology                                                                               |
| --------- | ---------------------------------------------------------------------------------------- |
| Frontend  | React + Vite + Tailwind CSS                                                              |
| Backend   | Python FastAPI                                                                           |
| Camera    | OpenCV (dual USB cameras via DirectShow/CAP_DSHOW)                                       |
| Detection | YOLO OBB (Layer 1), QR decode (Layer 2), Tesseract OCR (Layer 3), YOLO Vision (Layer 4) |
| Drug DB   | SQLite — backend/data/medverify.db (migrated from CSV this session)                      |
| History   | SQLite — scan_sessions + scan_results tables (persistent across restarts)                |
| Auth      | Hardcoded admin / 1234 in LoginPage.jsx — not real yet                                   |

### How to run

```
# Backend
cd backend && uvicorn server:app --reload

# Frontend
cd frontend && npm run dev
```

---

## 2. Key File Structure

### Backend

```
backend/
├── server.py               # FastAPI app — all REST endpoints
├── database.py             # SQLite init, get_db(), all table definitions  ← NEW
├── camera.py               # Dual-camera capture, stitching, brightness equalization
├── config.py               # App config (camera indices, paths, thresholds)
├── pipeline/
│   ├── layer1_detect.py    # YOLO OBB detection + perspective warp (straightens crops)
│   ├── layer2_qr.py        # QR code decode
│   ├── layer3_ocr.py       # Tesseract OCR on text label
│   ├── layer4_vision.py    # YOLO visual classifier (fallback) — fed FULL stitched frame
│   └── consensus.py        # Merges layer 2/3/4 results into final_name
├── utils/
│   ├── image.py            # get_perspective() — perspective transform, crop straightening
│   ├── medicine_db.py      # Fuzzy match helpers used by pipeline (reads from SQLite now)
│   └── font.py             # Thai font rendering for annotated output
└── data/
    ├── medverify.db        # SQLite database — drugs, scan_sessions, scan_results  ← NEW
    ├── medicine_db.csv     # Legacy CSV — kept for reference only, no longer used
    ├── medicine_images/    # Reference images per drug (used by Layer 4)
    └── homography.npy      # Camera homography calibration matrix
```

### Frontend

```
frontend/src/
├── App.jsx                 # Root: auth gate, all state (history, scan, expected), nav
├── api/index.js            # All fetch() calls to backend API
├── pages/
│   ├── LoginPage.jsx       # Login form (hardcoded admin/1234 — real auth not built yet)
│   ├── ScanPage.jsx        # Main scan UI — camera feed, expected list, results table
│   ├── HistoryPage.jsx     # Scan history table with search/filter/pagination
│   ├── DashboardPage.jsx   # Stats overview (placeholder — not pulling real DB data yet)
│   ├── MasterDataPage.jsx  # Drug database CRUD + (placeholder) User/Role management
│   └── SetupPage.jsx       # Camera resolution, calibration, brightness setup
├── components/
│   ├── Sidebar.jsx         # Fixed left nav with page links + sign out
│   ├── ResultPopup.jsx     # Modal shown after each scan with matched/missing/extra
│   ├── Historydetailpopup.jsx  # Modal for viewing a past scan full detail (loads from DB)
│   ├── CameraSection.jsx   # Live MJPEG camera feed component
│   ├── ExpectedMedicines.jsx   # Expected medicine list management on ScanPage
│   └── HowtoUse.jsx        # Help guide component
└── utils/
    └── calibration.json    # Shared calibration (read by both frontend and backend)
```

---

## 3. What Was Completed This Session

### SQLite Phase 1 — Drug Database

- **`backend/database.py` created** — `init_db()`, `get_db()`, `CREATE TABLE drugs` with AUTOINCREMENT
- **CSV → SQLite migration** — `migrate_csv.py` run once, 17 drugs imported, script deleted
- **Drug CRUD rewritten** — `server.py` drug endpoints now use sqlite3. Old CSV helpers (`_read_drug_names`, `_write_drug_names`, `_names_to_response`) deleted
- **`_reload_medicine_db()` helper added** — called after every drug add/edit/delete so the in-memory pipeline list updates immediately without server restart
- **Drug IDs are now stable** — AUTOINCREMENT primary key, deleting a row does not shift other IDs

### SQLite Phase 2 — Persistent Scan History

- **`scan_sessions` + `scan_results` tables** added to `database.py`
- **`POST /history`** endpoint — saves session summary + all result rows in one transaction, returns `session_id`
- **`GET /history`** endpoint — returns all sessions ordered newest first (excludes `annotated` blob for performance)
- **`GET /history/{id}`** endpoint — returns full session + all `scan_results` rows for detail popup
- **`App.jsx` wired up** — `saveHistory()` called in both `handleCloseAndReview` and `handleComplete`; `useEffect` on mount fetches `GET /history` to restore state
- **`HistoryPage.jsx` wired up** — clicking a row calls `getHistoryDetail(item.id)` to load full data from DB instead of in-memory object
- **`api/index.js`** — `saveHistory()`, `getHistory()`, `getHistoryDetail()` added

### Pipeline Bug Fix — OCR Score Recalculation

- **Root cause** — `server.py` computed `ocr_db_score` correctly (including Layer 3 internal boost), then threw it away and passed raw text to `consensus.py` which recalculated from scratch and got a different answer. A score of 95 was being ignored and falling through to UNKNOWN.
- **Fix** — `consensus.py` now accepts `ocr_db_name` and `ocr_db_score` as optional parameters. If provided, Stage 2 skips recalculation entirely and uses them directly. `server.py` now passes its pre-computed scores down.

---

## 4. Current State

### Working

- Full 4-layer scan pipeline (YOLO → QR → OCR → Vision)
- Dual camera stitching with brightness equalization offset
- Live MJPEG camera feed in browser
- Expected medicine list management (add/remove/quantity)
- Scan result popup with matched/missing/extra/unknown breakdown
- **Drug database CRUD against SQLite** (stable IDs, no row-shift bug)
- **Scan history persistent** — survives page refresh and server restart
- **History detail popup loads from DB** — annotated image + all result rows
- Perspective/straightening calibration on detected crops (Layer 1)
- Camera resolution and calibration setup page
- Camera autofocus lock on both cameras

### Known Issues / Still To Build

- **Auth is fake** — admin / 1234 hardcoded in LoginPage.jsx, no backend validation
- **Dashboard stats are placeholder** — not pulling real data from DB
- **Auto-logout logic** — UI exists but idle timer not wired up
- **User management / Role management in MasterData** — Coming soon placeholders only
- **History export** — no Excel download yet
- **Ambient light sensitivity** — internal lighting too weak vs office lights. Software offset partially compensates but hardware lighting needs improvement.

---

## 5. Active Decisions

### SQLite is the database — medverify.db lives in backend/data/

Single-workstation internship project. No server to install, file-based, Python built-in. `medverify.db` must be in `.gitignore` — it contains real scan data. Can migrate to PostgreSQL later if multi-station deployment is required.

### medicine_db.csv is legacy — do not use it for CRUD

The CSV still exists but is no longer the source of truth. All drug reads/writes go through SQLite. `utils/medicine_db.py` still reads from the CSV path at startup for the pipeline — this is fine because `_reload_medicine_db()` in `server.py` keeps the in-memory list up to date after any mutation.

### Color convention: Missing = red, Extra = amber

Missing medicine is clinically more dangerous. This was explicitly set and must not be reversed.

### Layer 4 runs on the full stitched frame — not crops

`med_box.pt` was trained on full images. `layer4_scan_full_frame()` receives the entire stitched frame, scans it once, then `layer4_match_to_box()` maps detections back to Layer 1 boxes by centre-point intersection.

### Layer 4 is a fallback only

Called only when `not qr_present and not ocr_high`. If QR is found or OCR scores >= 92, Layer 4 is skipped entirely.

### consensus.py score flow — calculate once, pass down

`server.py` computes `ocr_db_name` and `ocr_db_score` (with L3 boost applied), then passes them to `consensus_check()`. `consensus.py` skips Stage 2 recalculation if these are provided. Do not revert this — the triple recalculation bug caused valid HIGH scores to be ignored.

### calibration.json is shared between frontend and backend

`frontend/src/utils/calibration.json` is read by both React (for display) and `backend/camera.py` (polled every 2 seconds). Do not move this file.

---

## 6. Next Steps (Priority Order)

### IMMEDIATE — commit all changes

```
git add backend/database.py backend/server.py backend/pipeline/consensus.py
git add frontend/src/App.jsx frontend/src/api/index.js frontend/src/pages/HistoryPage.jsx
git commit -m "SQLite drug DB + persistent history + consensus score fix"
```

### HIGH — Authentication (Week 3)

Files to change:
- `backend/database.py` — add `users` table
- `backend/server.py` — add `POST /auth/login` endpoint returning JWT
- `backend/server.py` — add JWT middleware dependency, protect all routes
- `frontend/src/pages/LoginPage.jsx` — POST to real endpoint, store token in localStorage
- `frontend/src/api/index.js` — attach `Authorization: Bearer` header to all requests
- `frontend/src/App.jsx` — auth guard (redirect to /login if no token), handle 401, auto-logout timer

Schema:
```sql
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    DEFAULT 'pharmacist'
);
```

Dependencies to install:
```
pip install python-jose[cryptography] passlib[bcrypt]
```

### MEDIUM — Dashboard real stats

- Add `GET /stats` endpoint — query DB for today's scan count, pass rate, total drugs, weekly trend
- Wire `DashboardPage.jsx` to fetch from `/stats`

### MEDIUM — User management

- Add admin-only `GET/POST/PUT/DELETE /users` endpoints
- Replace Coming Soon tab in `MasterDataPage.jsx` with real CRUD table

### MEDIUM — Auto-logout idle timer

- `App.jsx` — `useEffect` with `mousemove`/`keydown` listeners resetting 15-min timer
- On timeout: clear token, redirect to login

### LOW — History Excel export

- `GET /history/export` — query all sessions, build `.xlsx` with `openpyxl`, return as file download
- Add Export button in `HistoryPage.jsx`

### LOW — remaining

- Error toasts and loading spinners throughout
- UI consistency check
- README with setup instructions
- Final smoke test and git tag

---

## 7. Important Context & Gotchas

### medverify.db must be in .gitignore

The database file contains real scan data and drug names. Add it if not already there:
```
echo "backend/data/medverify.db" >> .gitignore
```

### Uncommitted edits get lost

When Claude edits a file in a chat session it is written to disk but NOT committed to git. Always commit after any session you want to keep.

### _reload_medicine_db() must be called after every drug mutation

After any add/edit/delete drug operation, `_reload_medicine_db()` in `server.py` must be called to refresh the in-memory `medicine_db` list. It's already wired into all three mutation endpoints — do not remove it.

### consensus.py — do not re-introduce Stage 2 recalculation

The bug where valid OCR scores (e.g. 95) were being ignored and falling through to UNKNOWN was caused by `consensus.py` recalculating `ocr_db_score` from scratch. The fix was adding `ocr_db_name` and `ocr_db_score` as optional parameters. If you ever refactor `consensus.py`, preserve this pass-through behaviour.

### Camera autofocus DirectShow caveat

Some webcam drivers on Windows silently ignore `CAP_PROP_AUTOFOCUS`. If the camera still autofocuses, pin the focus value explicitly:
```python
cap.set(cv2.CAP_PROP_AUTOFOCUS, 0)
cap.set(cv2.CAP_PROP_FOCUS, cap.get(cv2.CAP_PROP_FOCUS))
```

### calibration.json is shared — do not move it

`frontend/src/utils/calibration.json` is read by both React and `backend/camera.py` (polled every 2 seconds).

### History scanned_by always shows "admin" until real auth is built

`App.jsx` reads `user?.username` from login state. Since login is hardcoded to admin/1234 it will always be "admin" until JWT auth is implemented.

### No hospital database access needed

All data is self-contained in `medverify.db`. Hospital IT integration is out of scope for the internship deliverable.
