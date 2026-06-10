import { useState } from "react";
import calibration from "../utils/calibration.json";
import { saveCalibration } from "../api/index";


const RESOLUTION_PRESETS = {
  "1950x1950": { label: "2048×1536", crop0_right: 0, crop1_left: 0, y_offset: 89,  x_offset: -340 },
  "1500x1500": { label: "1600×1200", crop0_right: 0, crop1_left: 0, y_offset: 74,  x_offset: -273 },
  "1280x1280": { label: "1280×960",  crop0_right: 0, crop1_left: 0, y_offset: 57,  x_offset: -219 },
  "640x480":   { label: "640×480",   crop0_right: 0, crop1_left: 0, y_offset: 29,  x_offset: -110 },
};

const SETUP_TABS = [
  { id: "general", label: "General", icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
  { id: "camera", label: "Camera", icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
];

export default function SetupPage() {
  
  const [camWidth,   setCamWidth]   = useState(calibration.cam_width   ?? 960);
  const [camHeight,  setCamHeight]  = useState(calibration.cam_height  ?? 1080);
  const [crop0Right, setCrop0Right] = useState(calibration.crop0_right ?? 0);
  const [crop1Left,  setCrop1Left]  = useState(calibration.crop1_left  ?? 0);
  const [yOffset,    setYOffset]    = useState(calibration.y_offset    ?? 0);
  const [xOffset,    setXOffset]    = useState(calibration.x_offset    ?? 0);

  const [tab, setTab]           = useState("general");
  const [saved, setSaved]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);

  // General settings state
  const [autoLogout,     setAutoLogout]     = useState(true);
  const [logoutSecs,     setLogoutSecs]     = useState(300);
  const [warnSecs,       setWarnSecs]       = useState(30);
  const [hospitalName,   setHospitalName]   = useState(localStorage.getItem("hospital_name") || "โรงพยาบาลตัวอย่าง");
  const [hospitalCode,   setHospitalCode]   = useState(localStorage.getItem("hospital_code") || "HOPS-1");

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if(tab == "camear")
      {
        await saveCalibration({
          cam_width:   camWidth,
          cam_height:  camHeight,
          crop0_right: crop0Right,
          crop1_left:  crop1Left,
          y_offset:    yOffset,
          x_offset:    xOffset,
        });
      }
      localStorage.setItem("hospital_name", hospitalName)
      localStorage.setItem("hospital_code", hospitalCode)
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const testDb = () => {
    setDbStatus("testing");
    setTimeout(() => setDbStatus("ok"), 1500);
  };

  const handleResolutionChange = (e) => {
    const val    = e.target.value;
    const [w, h] = val.split("x").map(Number);
    setCamWidth(w);
    setCamHeight(h);
    // Silently load the pre-configured offsets for this resolution
    const preset = RESOLUTION_PRESETS[val];
    if (preset) {
      setCrop0Right(preset.crop0_right);
      setCrop1Left(preset.crop1_left);
      setYOffset(preset.y_offset);
      setXOffset(preset.x_offset);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Setup</h1>
          <p className="text-sm text-slate-500 mt-0.5">System configuration and preferences</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl text-sm
                        transition-all shadow-sm disabled:opacity-60
                        ${saved
                          ? "bg-green-600 text-white"
                          : "bg-blue-600 hover:bg-blue-700 text-white"}`}
          >
            {saving ? ( 
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
                Restarting cameras…
              </>
            ) : saved ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Settings
              </>
            )}
          </button>
          {saveError && (
            <p className="text-xs text-red-500">{saveError}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {SETUP_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
                        ${tab === id
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* General tab */}
      {tab === "general" && (
        <div className="space-y-6">
          {/* Auto logout */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Auto Logout
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Idle Timeout (seconds)
                </label>
                <input
                  type="number" min={30} value={logoutSecs}
                  onChange={e => setLogoutSecs(parseInt(e.target.value) || 300)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                             text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Warning Before (seconds)
                </label>
                <input
                  type="number" min={10} value={warnSecs}
                  onChange={e => setWarnSecs(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                             text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Enable Auto Logout
                </label>
                <button
                  onClick={() => setAutoLogout(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                              ${autoLogout ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow
                                    transition-transform ${autoLogout ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="ml-2 text-sm text-slate-600">{autoLogout ? "On" : "Off"}</span>
              </div>
            </div>
          </div>

          {/* Hospital info */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Hospital Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                { label: "Hospital Name",   value: hospitalName,  setter: setHospitalName },
                { label: "Hospital Code",   value: hospitalCode,  setter: setHospitalCode },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {label}
                  </label>
                  <input
                    value={value}
                    onChange={e => setter(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                               text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Camera tab */}
      {tab === "camera" && (
        <div className="space-y-6">
          {[1, 2].map(n => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">
                Camera {n} — {n === 1 ? "Left View" : "Right View"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Device ID
                  </label>
                  <input defaultValue={n === 1 ? "Index 0" : "Index 2"}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                               text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Resolution
                  </label>
                  <select
                    value={`${camWidth}x${camHeight}`}
                    onChange={handleResolutionChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                               text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.keys(RESOLUTION_PRESETS).map(key => (
                      <option key={key} value={key}>{RESOLUTION_PRESETS[key].label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

        </div>
      )}

    </div>
  );
}
