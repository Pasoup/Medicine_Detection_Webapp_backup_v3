const BASE = "http://localhost:8000";

export async function postScan(frames, expectedList) {
  // frames === null  → no frame sent; backend captures directly from its cv2 streams
  // frames is string → already a stitched JPEG (frame_b64 path)
  // frames is array  → raw per-camera frames (frames_b64 path)
  const payload =
    frames == null
      ? { expected: expectedList }
      : typeof frames === "string"
        ? { frame_b64:  frames,                                    expected: expectedList }
        : { frames_b64: Array.isArray(frames) ? frames : [frames], expected: expectedList };

  const res = await fetch(`${BASE}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Scan failed: ${res.status}`);
  }
  return res.json();
}

export async function getCalibration() {
  const res = await fetch(`${BASE}/calibration`);
  return res.ok ? res.json() : {};
}

export async function getMedicines() {
  const res = await fetch(`${BASE}/medicines`);
  return res.json();
}

export async function setMedicines(medicines) {
  const res = await fetch(`${BASE}/medicines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ medicines }),
  });
  return res.json();
}

export async function clearMedicines() {
  const res = await fetch(`${BASE}/medicines`, { method: "DELETE" });
  return res.json();
}

export async function getHistory() {
  const res = await fetch(`${BASE}/history`);
  return res.json();
}

export async function getHistoryDetail(id) {
  const res = await fetch(`${BASE}/history/${id}`);
  return res.json();
  
}

export async function saveHistory(entry) 
{
  const res = await fetch(`${BASE}/history`,{
    method: 'POST',
    headers: { 'Content-Type': 'application/json'},
    body: JSON.stringify(entry),
  });
  return res.json();
}

export async function getDrugDatabase() {
  const res = await fetch(`${BASE}/drug-database`);
  if (!res.ok) throw new Error(`Failed to load drug database: ${res.status}`);
  return res.json(); // { drugs: [{id, name}, ...], total: N }
}

export async function saveCalibration(fields) {
  // fields: { cam_width, cam_height, crop0_right, crop1_left, y_offset, x_offset }
  // Only pass fields you want to update — the rest are kept as-is on the backend.
  const res = await fetch(`${BASE}/calibration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to save calibration: ${res.status}`);
  }
  return res.json(); // { calibration: {...}, restarted: true }
}

export async function addDrug(name) {
  const res = await fetch(`${BASE}/drug-database`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to add drug: ${res.status}`);
  }
  return res.json();
}

export async function updateDrug(id, name) {
  const res = await fetch(`${BASE}/drug-database/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update drug: ${res.status}`);
  }
  return res.json();
}

export async function deleteDrug(id) {
  const res = await fetch(`${BASE}/drug-database/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete drug: ${res.status}`);
  }
  return res.json();
}