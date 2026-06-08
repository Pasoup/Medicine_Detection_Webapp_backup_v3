# MedVerify v3 — Session Handoff

> Updated: 2026-06-04
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
| Drug DB   | SQLite — backend/data/medverify.db                                                       |
| History   | SQLite — scan_sessions + scan_results tables (persistent across restarts)                |
| Auth      | JWT-based — backend fully protected. Frontend wiring is next (Jun 5).                   |

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
├── database.py             # SQLite init, get_db(), all table definitions
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
    ├── medverify.db        # SQLite database — drugs, scan_sessions, scan_results, users
    ├── medicine_db.csv     # Legacy CSV — kept for reference only, no longer used
    ├── medicine_images/    # Reference images per drug (used by Layer 4)
    └── homography.npy      # Camera homography calibration matrix
```

### Frontend

```
frontend/src/
├── App.jsx                 # Root: auth gate, all state (history, scan, expected), nav
├── api/index.js            # All fetch() calls to backend API — Bearer header NOT wired yet
├── pages/
│   ├── LoginPage.jsx       # Login form — still hardcoded admin/1234, needs real POST next
│   ├── ScanPage.jsx        # Main scan UI — camera feed, expected list, results table
│   ├── HistoryPage.jsx     # Scan history table with search/filter/pagination
│   ├── DashboardPage.jsx   # Stats — reads real data from history prop (no /stats endpoint needed)
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

## 3. What Was Completed This Session (June 4, 2026)

### Authentication — Backend (fully complete)

- **`users` table** added to `database.py` — `id`, `username` (UNIQUE), `password_hash`, `role` (DEFAULT 'pharmacist')
- **Default admin seeded** — `INSERT OR IGNORE` seeds `admin` / bcrypt hash of `1234` / role `admin` on every `init_db()` call. Safe to run repeatedly.
- **Dependencies installed** — `pip install python-jose[cryptography] passlib[bcrypt]` and `pip install bcrypt==4.0.1` (version pin required for passlib compatibility)
- **`pwd_context`** — `CryptContext(schemes=["bcrypt"])` defined in `database.py`, imported into `server.py`
- **`POST /auth/login`** — accepts `LoginRequest(username, password)`, verifies bcrypt hash, returns `{"access_token": JWT, "token_type": "bearer"}`. JWT payload: `{"sub": username, "role": role, "exp": now + 30min}`
- **`get_current_user()` dependency** — decodes Bearer token, extracts `sub`, raises 401 on invalid/expired. Uses `OAuth2PasswordBearer(tokenUrl="/auth/login")` + `Depends()`
- **All 18 endpoints protected** — `current_user = Depends(get_current_user)` added to every endpoint except `POST /auth/login`
- **Verified working** — unauthenticated requests to `/drug-database` return 401. Valid login returns a unique JWT that expires after 30 minutes.

### Previously completed (prior sessions)

- SQLite drug DB (stable AUTOINCREMENT IDs, no row-shift bug)
- Persistent scan history (scan_sessions + scan_results)
- OCR consensus score fix (eliminated triple-recalculation bug)
- DashboardPage already reads real data from history prop

---

## 4. Current State

### Working

- Full 4-layer scan pipeline (YOLO → QR → OCR → Vision)
- Dual camera stitching with brightness equalization offset
- Live MJPEG camera feed in browser
- Expected medicine list management (add/remove/quantity)
- Scan result popup with matched/missing/extra/unknown breakdown
- Drug database CRUD against SQLite (stable IDs, no row-shift bug)
- Scan history persistent — survives page refresh and server restart
- History detail popup loads from DB — annotated image + all result rows
- **JWT authentication backend** — login endpoint, token generation, middleware, all routes protected
- Perspective/straightening calibration on detected crops (Layer 1)
- Camera resolution and calibration setup page
- Camera autofocus lock on both cameras

### Known Issues / Still To Build

- **Frontend auth not wired** — LoginPage.jsx still uses hardcoded check, api/index.js does not attach Bearer header. This is the NEXT task (Jun 5).
- **Auth guard not in frontend** — no redirect to /login if no token, no 401 handling
- **Auto-logout idle timer** — not wired up yet
- **Medicine Code feature** — new tab + DB tables + ScanPage dropdown not built yet
- **User management in MasterData** — Coming soon placeholder only
- **History export** — no Excel download yet
- **Layer 4 only handles 8 medicine types** — plan to expand to 20 types (12 new classes, 250 images each, manual annotation required for new classes)
- **Ambient light sensitivity** — software offset partially compensates but hardware lighting needs improvement

---

## 5. Active Decisions

### JWT auth — backend only, frontend is next

Backend is fully protected. Frontend still uses hardcoded login. Do not add any more backend endpoints without also adding `Depends(get_current_user)`.

### JWT constants in server.py

```python
SECRET_KEY = "abefkjhaekjfhkajef"   # fine for internship, change before any real deployment
ALGORITHM  = "HS256"
```

Token expiry: 30 minutes. Payload contains `sub` (username), `role`, `exp`.

### bcrypt version must be pinned

`passlib` has a compatibility bug with newer `bcrypt`. Pin: `pip install bcrypt==4.0.1`. Without this, `pwd_context.hash()` throws a ValueError on startup.

### SQLite is the database — medverify.db lives in backend/data/

`medverify.db` must be in `.gitignore` — it contains real scan data and hashed passwords.

### medicine_db.csv is legacy — do not use it for CRUD

All drug reads/writes go through SQLite. `utils/medicine_db.py` still reads from CSV at startup for the pipeline — fine because `_reload_medicine_db()` keeps the in-memory list up to date.

### Color convention: Missing = red, Extra = amber

Missing medicine is clinically more dangerous. This was explicitly set and must not be reversed.

### Layer 4 runs on the full stitched frame — not crops

`med_box.pt` was trained on full images. `layer4_scan_full_frame()` receives the entire stitched frame, scans it once, then `layer4_match_to_box()` maps detections back to Layer 1 boxes by centre-point intersection.

### Layer 4 is a fallback only

Called only when `not qr_present and not ocr_high`. If QR is found or OCR scores >= 92, Layer 4 is skipped entirely.

### consensus.py score flow — calculate once, pass down

`server.py` computes `ocr_db_name` and `ocr_db_score` (with L3 boost applied), then passes them to `consensus_check()`. `consensus.py` skips Stage 2 recalculation if these are provided. Do not revert this — the triple recalculation bug caused valid HIGH scores to be ignored.

### calibration.json is shared — do not move it

`frontend/src/utils/calibration.json` is read by both React and `backend/camera.py` (polled every 2 seconds).

### DashboardPage does not need a /stats endpoint

It reads today's stats directly from the `history` prop passed from `App.jsx` (which loads from DB on mount). Do not add a separate `/stats` endpoint.

---

## 6. Next Steps (Priority Order)

### TODAY — Jun 5 — Frontend auth wiring

**`frontend/src/pages/LoginPage.jsx`**
- Remove hardcoded `if username === "admin" && password === "1234"` check
- POST `{username, password}` to `/auth/login`
- On success: store `access_token` in `localStorage`
- On failure: show error message

**`frontend/src/api/index.js`**
- Read token from `localStorage` on every call
- Attach `Authorization: Bearer <token>` header to every `fetch()`

### NEXT — Jun 8 — App.jsx auth guard + 401 handling

- Redirect to `/login` if no token in localStorage
- Handle 401 globally — clear token and redirect
- Wire sign-out button to clear localStorage

### NEXT — Jun 8 — Dashboard today-only filter

- `DashboardPage.jsx` — filter the `history` prop to only entries where `timestamp` is today before computing stats
- History page stays unchanged — still shows all records

### NEXT — Jun 10 — Auto-logout idle timer

- `App.jsx` — `useEffect` with `mousemove`/`keydown` listeners resetting 15-min timer
- On timeout: clear token, redirect to login, show toast

### NEXT — Jun 11 — Image audit (ML)

- Count images per class in `backend/data/medicine_images/`
- Identify existing classes under 250 images
- Confirm 12 new medicine boxes are available
- Document gap list: class → current count → images needed

### NEXT — Jun 12 — Medicine Code backend

**`backend/database.py`**
```sql
CREATE TABLE IF NOT EXISTS medicine_codes (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT
);
CREATE TABLE IF NOT EXISTS medicine_code_items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    code_id   INTEGER NOT NULL REFERENCES medicine_codes(id) ON DELETE CASCADE,
    drug_name TEXT    NOT NULL,
    quantity  INTEGER DEFAULT 1
);
```
- CRUD endpoints: `GET /medicine-codes`, `POST /medicine-codes`, `GET/PUT/DELETE /medicine-codes/{id}`, `POST /medicine-codes/{id}/items`, `DELETE /medicine-codes/{id}/items/{item_id}`

### MEDIUM — Medicine Code frontend (Jun 15–17)

- `MedicineCodePage.jsx` — new page, CRUD for codes, medicine picker from drug master data
- `Sidebar.jsx` — add Medicine Code tab between Master Data and Setup
- `ScanPage.jsx` / `ExpectedMedicines.jsx` — Load Code dropdown, auto-populates expected list

### MEDIUM — User management (Jun 23)

- `server.py` — admin-only `GET/POST/PUT/DELETE /users`, role check from JWT
- `MasterDataPage.jsx` — replace Coming Soon with real CRUD table

### MEDIUM — History Excel export (Jun 24)

- `GET /history/export` — openpyxl, FileResponse
- Export button in `HistoryPage.jsx`

### ML — Layer 4 expansion to 20 classes (Jun 18–22)

- Collect 250 images × 12 new medicine types (physical photography)
- Manual annotation for all 12 new classes (auto-annotation cannot be used — model hasn't seen them)
- Auto-annotate top-up images for existing 8 classes
- Retrain YOLO, launch overnight Mon Jun 22
- Validate and replace `med_box.pt` Tue Jun 23

---

## 7. Important Context & Gotchas

### medverify.db must be in .gitignore

Contains real scan data and hashed passwords:
```
echo "backend/data/medverify.db" >> .gitignore
```

### bcrypt must be pinned to 4.0.1

`pip install bcrypt==4.0.1` — passlib compatibility issue with newer bcrypt. Without this the server crashes on startup when `pwd_context.hash()` is called.

### All new endpoints must have Depends(get_current_user)

Every new `@app.get/post/put/delete` endpoint added to `server.py` must include `current_user = Depends(get_current_user)` as a parameter. The only exception is `POST /auth/login`.

### _reload_medicine_db() must be called after every drug mutation

After any add/edit/delete drug operation, `_reload_medicine_db()` in `server.py` must be called to refresh the in-memory `medicine_db` list.

### consensus.py — do not re-introduce Stage 2 recalculation

The fix was adding `ocr_db_name` and `ocr_db_score` as optional parameters. If you refactor `consensus.py`, preserve this pass-through behaviour.

### Camera autofocus DirectShow caveat

Some webcam drivers on Windows silently ignore `CAP_PROP_AUTOFOCUS`. If the camera still autofocuses, pin the focus value explicitly:
```python
cap.set(cv2.CAP_PROP_AUTOFOCUS, 0)
cap.set(cv2.CAP_PROP_FOCUS, cap.get(cv2.CAP_PROP_FOCUS))
```

### calibration.json is shared — do not move it

`frontend/src/utils/calibration.json` is read by both React and `backend/camera.py` (polled every 2 seconds).

### History scanned_by will show real username once frontend auth is wired

`App.jsx` reads `user?.username` from login state. Once `LoginPage.jsx` stores the decoded username from the JWT response, this will show the correct username.

### No hospital database access needed

All data is self-contained in `medverify.db`. Hospital IT integration is out of scope for the internship deliverable.
