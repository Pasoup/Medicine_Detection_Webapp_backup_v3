const BASE = "http://localhost:8000";

export function token_helper() 
{
  const cur_token = localStorage.getItem("access_token")

  return {"Authorization" : "Bearer " + cur_token, "Content-Type" : "application/json"}
}

export function auth_fetch(url, options = {})
{
  return fetch(url, {...options, headers: token_helper()}).then(res => {
    if (res.status === 401)
    {
      localStorage.removeItem("access_token");
      window.location.href = "/";
    }
    return res;
  });
}

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

  const res = await auth_fetch(`${BASE}/scan`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Scan failed: ${res.status}`);
  }
  return res.json();
}

export async function getCalibration() {
  const res = await auth_fetch(`${BASE}/calibration`);
  return res.ok ? res.json() : {};
}

export async function getMedicines() {
  const res = await auth_fetch(`${BASE}/medicines`);
  return res.json();
}

export async function setMedicines(medicines) {
  const res = await auth_fetch(`${BASE}/medicines`, {
    method: "POST",
    body: JSON.stringify({ medicines }),
  });
  return res.json();
}

export async function clearMedicines() {
  const res = await auth_fetch(`${BASE}/medicines`, { method: "DELETE"});
  return res.json();
}

export async function getHistory() {
  const res = await auth_fetch(`${BASE}/history`);
  return res.json();
}

export async function getHistoryDetail(id) {
  const res = await auth_fetch(`${BASE}/history/${id}`);
  return res.json();
  
}


export async function saveHistory(entry) 
{
  const res = await auth_fetch(`${BASE}/history`,{
    method: 'POST',
    body: JSON.stringify(entry),
  });
  return res.json();
}

export async function getDrugDatabase() {
  const res = await auth_fetch(`${BASE}/drug-database`);
  if (!res.ok) throw new Error(`Failed to load drug database: ${res.status}`);
  return res.json(); // { drugs: [{id, name}, ...], total: N }
}

export async function saveCalibration(fields) {
  // fields: { cam_width, cam_height, crop0_right, crop1_left, y_offset, x_offset }
  // Only pass fields you want to update — the rest are kept as-is on the backend.
  const res = await auth_fetch(`${BASE}/calibration`, {
    method: "POST",
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to save calibration: ${res.status}`);
  }
  return res.json(); // { calibration: {...}, restarted: true }
}

export async function addDrug(name) {
  const res = await auth_fetch(`${BASE}/drug-database`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to add drug: ${res.status}`);
  }
  return res.json();
}

export async function updateDrug(id, name) {
  const res = await auth_fetch(`${BASE}/drug-database/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update drug: ${res.status}`);
  }
  return res.json();
}

export async function deleteDrug(id) {
  const res = await auth_fetch(`${BASE}/drug-database/${id}`, { method: "DELETE"});
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete drug: ${res.status}`);
  }
  return res.json();
}

// ------------------------ USERS CREATION ENDPOINTS ----------------------------

export async function getUsers()
{
    const res = await auth_fetch(`${BASE}/users`);
    if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);

    return res.json()
}

export async function createUser(username,password,role)
{
  const res = await auth_fetch(`${BASE}/users`,
    {
      method: "POST",
      body: JSON.stringify({username,password,role}),
    }
  );

  if(!res.ok){
    const err = await res.json().catch( () => ({}));

    throw new Error(err.detail || `Failed to create user: ${res.status}`);

  }
  return res.json()

}

export async function updateUser(id, username,password,role)
{
    const body = password
    ? { username,role,password}
    : {username,role};

    const res = await auth_fetch(`${BASE}/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    if(!res.ok)
    {
      const err = await res.json().catch( () => ({}));
      throw new Error(err.detail  || `Failed to update user: ${res.status}`);
    }

    return res.json();
}



export async function deleteUser(id)
{
  const res = await auth_fetch(`${BASE}/users/${id}`,{
      method: "DELETE"
  });
  if(!res.ok)
  { 
    const err = await res.json().catch( () => ({}));
    throw new Error(err.detail ||  `Failed to delete user ${res.status}`);


  }
  return res.json();
  
}




