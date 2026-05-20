import { useState, useEffect, useCallback } from "react";
import { useCamera } from "../hooks/useCamera";
import { postScan } from "../api";

// ── Scanning overlay — reused on both camera panes ───────────────────────────
const ScanningOverlay = () => (
  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent
                      rounded-full animate-spin" />
      <p className="text-white text-sm font-medium">Scanning…</p>
    </div>
  </div>
);

export default function CameraSection({
  expected, scanResults, annotatedImg, isScanning,
  setIsScanning, onScanComplete, summary,
}) {
  const {
    video0Ref, video1Ref,
    ready, error,
    captureFrame,
    deviceIds, cam0Id, setCam0Id, cam1Id, setCam1Id,
    locked, lockCameras, unlockCameras,
  } = useCamera();

  const [scanError,     setScanError]     = useState(null);
  const [showAnnotated, setShowAnnotated] = useState(false);
  const [locking,       setLocking]       = useState(false);

  const handleLock = async () => {
    setLocking(true);
    await lockCameras();
    setLocking(false);
  };

  const handleScan = useCallback(async () => {
    setScanError(null);
    const frame = captureFrame();
    if (!frame) { setScanError("Camera not ready"); return; }
    setIsScanning(true);
    try {
      const data = await postScan(frame, expected);
      onScanComplete(data);
    } catch (err) {
      setScanError(err.message);
      setIsScanning(false);
    }
  }, [expected, captureFrame, setIsScanning, onScanComplete]);

  // F4 shortcut
  useEffect(() => {
    const handler = (e) => { if (e.code === "F4") handleScan(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleScan]);

  const hasCam1 = cam1Id && cam1Id !== cam0Id;

  // Aspect ratio: 16:9 single cam, 32:9 dual cam
  const paddingTop = hasCam1 ? "46.875%" : "62.5%";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Camera Feed</h2>
        <div className="flex items-center gap-3">
          {/* Lock / Unlock button */}
          <button
            onClick={locked ? unlockCameras : handleLock}
            disabled={!ready || locking}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5
                       rounded-lg transition-colors disabled:opacity-40 ${
              locked
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            title={locked ? "Locked — click to unlock" : "Place medicines then click to lock camera settings"}
          >
            {locking ? (
              <>
                <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                Locking…
              </>
            ) : locked ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Locked
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                Lock Camera
              </>
            )}
          </button>

          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full animate-pulse ${locked ? "bg-amber-400" : "bg-green-500"}`} />
            <span className="text-xs font-semibold text-slate-500">
              {locked ? "settings locked" : hasCam1 ? "2 cameras live" : "1 camera live"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Camera selector — only shown if more than 2 devices detected ── */}
      {deviceIds.length > 2 && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-500 font-medium mb-1 block">Camera 1 (Left)</label>
            <select
              value={cam0Id || ""}
              onChange={e => setCam0Id(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2
                         bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {deviceIds.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 font-medium mb-1 block">Camera 2 (Right)</label>
            <select
              value={cam1Id || ""}
              onChange={e => setCam1Id(e.target.value || null)}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2
                         bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— None —</option>
              {deviceIds.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Aspect-ratio wrapper ── */}
      <div style={{ paddingTop, position: "relative" }} className="w-full">
        <div className="absolute inset-0 rounded-2xl overflow-hidden border-2 border-blue-500 bg-black">

          {/* Error state */}
          {error ? (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-red-400 text-sm p-4 text-center">{error}</p>
            </div>

          /* Annotated result — fills entire frame */
          ) : showAnnotated && annotatedImg ? (
            <img
              src={annotatedImg}
              alt="Scan result"
              className="w-full h-full object-contain"
            />

          /* Live camera feeds */
          ) : (
            <div className={`w-full h-full flex`} style={{ gap: 0 }}>

              {/* Camera 0 */}
              <div className="relative overflow-hidden flex-1">
                <video
                  ref={video0Ref}
                  autoPlay playsInline muted
                  className="absolute"
                  style={{
                    top: "50%", left: "54%",
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    transform: "translate(-50%, -50%) rotate(-90deg)",
                  }}
                />
                
                {isScanning && <ScanningOverlay />}
              </div>

              {/* Camera 1 — only when a second device is selected */}
              {hasCam1 && (
                <div className="relative overflow-hidden flex-1" style={{ marginLeft: "-1px" }}>
                  <video
                    ref={video1Ref}
                    autoPlay playsInline muted
                    className="absolute"
                    style={{
                      top: "50%", left: "47%",
                      width: "100%", height: "100%",
                      objectFit: "cover",
                      transform: "translate(-50%, -50%) rotate(90deg) ",
                    }}
                  />
                
                </div>
              )}
            </div>
          )}

        </div>
      </div>{/* end aspect-ratio wrapper */}

      {/* ── Scan button ── */}
      <button
        onClick={handleScan}
        disabled={isScanning || !ready}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300
                   text-white font-bold py-4 rounded-2xl flex items-center
                   justify-center gap-3 transition-all text-base tracking-widest
                   shadow-sm hover:shadow-md"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {isScanning ? "SCANNING…" : "SCAN  (F4)"}
      </button>

      {scanError && (
        <p className="text-center text-sm text-red-500">{scanError}</p>
      )}
      <p className="text-center text-xs text-slate-400">
        Each camera frame is scanned individually at full resolution
      </p>
    </div>
  );
}