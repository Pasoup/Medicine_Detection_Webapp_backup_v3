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
  const res = await fetch(`${BASE}/scan/history`);
  return res.json();
}