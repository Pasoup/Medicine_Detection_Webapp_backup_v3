const BASE = "http://localhost:8000";

export async function postScan(frames, expectedList) {
  // frames is an array of base64 strings — one per camera
  // Server stitches them together before running the pipeline
  const framesArray = Array.isArray(frames) ? frames : [frames];
  const res = await fetch(`${BASE}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frames_b64: framesArray, expected: expectedList }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Scan failed: ${res.status}`);
  }
  return res.json();
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