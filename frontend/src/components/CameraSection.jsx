import { useState, useEffect, useCallback } from "react";
import { postScan } from "../api";

const BASE = "http://localhost:8000";

// ── Scanning overlay ──────────────────────────────────────────────────────────
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
  const [scanError, setScanError] = useState(null);

  const handleScan = useCallback(async () => {
    setScanError(null);
    setIsScanning(true);
    try {
      // No frame sent — backend captures directly from its cv2 camera streams
      const data = await postScan(null, expected);
      onScanComplete(data);
    } catch (err) {
      setScanError(err.message);
      setIsScanning(false);
    }
  }, [expected, setIsScanning, onScanComplete]);

  // F4 shortcut
  useEffect(() => {
    const handler = (e) => { if (e.code === "F4") handleScan(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleScan]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Camera Feed</h2>
      </div>

      {/* ── Camera viewport ── */}
      <div
        className="w-full relative rounded-2xl overflow-hidden border-2 border-blue-500 bg-black"
        style={{ aspectRatio: "9/5", maxHeight: "480px" }}
      >
        <div className="absolute inset-0">
          {/* MJPEG stream served directly by the Python backend */}
          <img
            src={`${BASE}/video_feed`}
            alt="Live camera feed"
            className="w-full h-full object-contain"
          />
          {isScanning && <ScanningOverlay />}
        </div>
      </div>

      {/* ── Scan button ── */}
      <button
        onClick={handleScan}
        disabled={isScanning}
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
        Dual-camera feed — press F4 or tap SCAN
      </p>

    </div>
  );
}
