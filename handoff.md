# MedVerify v3 — Session Handoff

> Updated: 2026-06-09
> Project root: C:\Users\pasul\Desktop\InternStuff\v3_webapp

---

## 0. How to Work With the User — READ FIRST

**Do NOT write code unless the user explicitly tells you to.**
The user writes all code themselves. Your role is to:
- Point them in the right direction
- Explain concepts when asked
- Review code they paste and flag issues
- Tell them exactly what to change, not write it for them

**Do NOT open or read files unless the user asks or you need to review something specific.**

**Do NOT make assumptions about what the user wants next.** Wait for them to tell you.

When the user says "let's begin" or "start", guide them step by step — one small piece at a time. Wait for them to paste their attempt before reviewing.

When the user shares code, check for:
- Typos in property names (e.g. `headerss` instead of `headers` — this has happened before)
- Wrong variable scope
- Missing error handling
- Logic bugs

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
| Auth      | JWT-based — backend fully protected, frontend fully wired as of Jun 5.                  |

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
├── api/index.js            # All fetch() calls — token_helper() Bearer header on every call
├── pages/
│   ├── LoginPage.jsx       # Login form — POSTs to /auth/login, stores JWT in localStorage
│   ├── ScanPage.jsx        # Main scan UI — camera feed, expected list, results table
│   ├── HistoryPage.jsx     # Scan history table — shows location column
│   ├── DashboardPage.jsx   # Stats — reads real data from history prop
│   ├── MasterDataPage.jsx  # Drug database CRUD + (placeholder) User/Role management
│   └── SetupPage.jsx       # Camera resolution, calibration, hospital info (saves to localStorage)
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

## 3. What Was Completed

### Jun 4 — Authentication Backend (fully complete)

- `users` table in `database.py` with bcrypt-hashed admin seed
- `POST /auth/login` — verifies hash, returns JWT (30-min expiry)
- `get_current_user()` JWT middleware — all 18 endpoints protected except `/auth/login`

### Jun 5 — Frontend Auth Wiring (fully complete)

- `LoginPage.jsx` — real `POST /auth/login`, stores `access_token` in `localStorage`, calls `onLogin({ username, role })`
- `api/index.js` — `token_helper()` reads token from localStorage, returns `{ Authorization: Bearer ..., Content-Type: application/json }`. Applied to every `fetch()` call.
- `/video_feed` intentionally left unprotected — MJPEG stream loads via `<img src>`, cannot carry headers
- `onLogin` in `App.jsx` receives `{ username, role }` object — `user.username` now shows correctly in History

### Jun 5 — Hospital Location Feature (fully complete)

- `SetupPage.jsx` — reads `hospital_name` / `hospital_code` from `localStorage` on init; saves both on "Save Settings"
- `database.py` — `location TEXT` column added to `scan_sessions` (ALTER TABLE also run on existing DB)
- `server.py` — `SaveHistoryPayload` has `location: str | None = None`; inserted in `POST /history`; returned in `GET /history`
- `App.jsx` — reads `localStorage.getItem("hospital_name")` and includes it as `location` in both `handleCloseAndReview()` and `handleComplete()`
- `HistoryPage.jsx` — displays `item.location` in the Location column

### Previously completed (prior sessions)

- SQLite drug DB (stable AUTOINCREMENT IDs, no row-shift bug)
- Persistent scan history (scan_sessions + scan_results)
- OCR consensus score fix (eliminated triple-recalculation bug)
- DashboardPage reads real data from history prop

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
- **JWT authentication — fully wired frontend + backend**
- **Hospital location saved to scan history**
- **Role-based UI — viewer/pharmacist/admin see different pages and tabs**
- **Auto-logout after 30 min idle**
- **Reference images stored and shown in history detail**
- Perspective/straightening calibration on detected crops (Layer 1)
- Camera resolution and calibration setup page
- Camera autofocus lock on both cameras

### Jun 8 — Auth Guard + 401 Handling (fully complete)

- `App.jsx` — `useEffect` on mount restores user from JWT in localStorage (survives page refresh)
- `api/index.js` — `auth_fetch()` wraps all fetch calls, auto-attaches Bearer token, redirects to login on 401
- `App.jsx` — sign-out clears `access_token` from localStorage before resetting user state
- `getHistory` useEffect depends on `[user]` so it only loads after login

### Jun 8 — Dashboard Today Filter (fully complete)

- `DashboardPage.jsx` — stats and recent activity filtered to today's entries only

### Jun 9 — User Management (fully complete)

- `server.py` — 4 admin-only endpoints: `GET /users`, `POST /users`, `PUT /users/{id}`, `DELETE /users/{id}`
- All protected by role check — returns 403 if not admin, passwords hashed with bcrypt
- `api/index.js` — `getUsers`, `createUser`, `updateUser`, `deleteUser` functions added
- `MasterDataPage.jsx` — replaced "Coming Soon" with full user CRUD table + add/edit/remove modals
- Role dropdown supports 3 roles: `admin`, `pharmacist`, `viewer`
- Role badge colors: admin = purple, pharmacist = blue, viewer = slate

### Jun 9 — Bug Fixes

- `LoginPage.jsx` — role was hardcoded to `"Administrator"`. Fixed to decode role from JWT payload on login so sidebar shows the correct role
- `MasterDataPage.jsx` — role dropdown values were capitalized (`Viewer`, `Admin`, `Pharmacist`). Fixed to lowercase to match JWT payload
- `server.py` — role values now normalized to lowercase on save (`INSERT` and `UPDATE`)
- Existing DB roles normalized via `UPDATE users SET role = LOWER(role)`

### Jun 9 — Auto-logout idle timer (fully complete)

- `App.jsx` — `useEffect` with `mousemove`/`keydown` listeners resetting a 30-min `setTimeout`
- On timeout: `localStorage.removeItem("access_token")` then `setUser(null)`
- Frontend-only — no backend changes needed

### Jun 9 — Role-based UI access (fully complete)

- `Sidebar.jsx` — `allowedRoles` array on each nav item; section header hidden if all items filtered out
  - viewer: Dashboard + History only
  - pharmacist: all pages except hidden Users/Roles tabs
  - admin: full access
- `MasterDataPage.jsx` — accepts `user` prop; Users and Roles tabs filtered out for non-admin roles
- `App.jsx` — passes `user` prop to `<MasterDataPage>`

### Jun 9 — Reference image fix for history detail (fully complete)

- `database.py` — `reference_image TEXT` column added to `scan_results` table
- `server.py` — `ScanResultItem` model includes `reference_image`; INSERT and GET detail both include the field
- `App.jsx` — `reference_image` included in results map in both `handleCloseAndReview` and `handleComplete`
- Run once on existing DB: `ALTER TABLE scan_results ADD COLUMN reference_image TEXT;`

### Jun 10 — Medicine Code Backend (fully complete)

- `database.py` — `medicine_codes` (id, label) and `medicine_code_items` (id, code_id, drug_name, quantity) tables added
- `server.py` — 7 CRUD endpoints: `GET/POST /medicine-codes`, `GET/PUT/DELETE /medicine-codes/{id}`, `POST /medicine-codes/{id}/items`, `DELETE /medicine-codes/{id}/items/{item_id}`
- Pydantic models: `MedCodes` (label) and `MedCodesItem` (drug_name, quantity)
- `SetupPage.jsx` — Save Settings now only calls `saveCalibration` when on the Camera tab; other tabs just save to localStorage without restarting cameras

### Known Issues / Still To Build

- **Medicine Code frontend** — `MedicineCodePage.jsx` + Sidebar tab not built yet (Jun 12)
- **ScanPage Load Code dropdown** — not built yet (Jun 13)
- **History export** — no Excel download yet
- **Layer 4 only handles 8 medicine types** — plan to expand to 20 types
- **Ambient light sensitivity** — software offset partially compensates but hardware lighting needs improvement

---

## 5. Active Decisions

### JWT auth — fully wired

Backend protected. Frontend wired. `token_helper()` in `api/index.js` handles all Bearer headers.

### JWT constants in server.py

```python
SECRET_KEY = "abefkjhaekjfhkajef"   # fine for internship, change before any real deployment
ALGORITHM  = "HS256"
```

Token expiry: 30 minutes. Payload contains `sub` (username), `role`, `exp`.

### bcrypt version must be pinned

`pip install bcrypt==4.0.1` — passlib compatibility issue with newer bcrypt. Without this the server crashes on startup when `pwd_context.hash()` is called.

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

It reads stats directly from the `history` prop passed from `App.jsx`. Do not add a separate `/stats` endpoint.

### Hospital info stored in localStorage

`hospital_name` and `hospital_code` keys in localStorage. Set by SetupPage on save, read by App.jsx when building scan session entries.

### /video_feed is intentionally unprotected

MJPEG stream is loaded via `<img src>` tag — browsers cannot attach custom headers to image src URLs. Removing auth from this endpoint is correct and intentional.

---

## 6. Next Steps (Priority Order)

### NEXT — Jun 11 — Image audit (ML)

- Count images per class in `backend/data/medicine_images/`
- Identify existing classes under 250 images
- Confirm 12 new medicine boxes are available
- Document gap list: class → current count → images needed

### NEXT — Jun 12 — Medicine Code frontend (moved up from Jun 15)

- `MedicineCodePage.jsx` — new page, CRUD for codes, medicine picker from drug master data
- `Sidebar.jsx` — add Medicine Code tab between Master Data and Setup

### NEXT — Jun 13 — ScanPage Load Code dropdown (moved up from Jun 16)

- `ScanPage.jsx` / `ExpectedMedicines.jsx` — Load Code dropdown, auto-populates expected list on selection
- User can still manually add/remove after loading

### NEXT — Jun 16 — Arduino RGB LED Strip Integration

- Write Arduino sketch (Nano V3) — listens on serial for `R,G,B\n` commands, drives strip via FastLED or Adafruit NeoPixel
- Add `backend/led.py` — `pyserial` wrapper: `led_on()`, `led_off()`, `led_color(r,g,b)`
- Hook into `server.py` scan flow: white on scan start, green on clean pass, red if missing medicines
- Note: LED strip needs separate 5V power supply — Nano cannot drive the strip directly
- Find correct COM port via Device Manager → Ports

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

### Watch for typos in api/index.js

`headerss` (double s) has caused silent failures before — always check fetch() calls use `headers` (singular).

### No hospital database access needed

All data is self-contained in `medverify.db`. Hospital IT integration is out of scope for the internship deliverable.
