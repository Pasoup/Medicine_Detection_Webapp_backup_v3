import { useEffect } from "react";

export default function ResultPopup({ data, onClose, continueScan, onClearData }) {
  const { success, missing, extra, review, unknown = [], summary } = data;

  const handleClose = () => {
    onClose();
    onClearData?.();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape")           handleClose();
      if (e.code === "F8" && !success)  continueScan();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, continueScan, success, onClearData]);

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md
                      overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header stripe */}
        <div className={`px-6 py-5 flex items-center gap-4 ${
          success ? "bg-green-50" : "bg-red-50"
        }`}>
          {/* Icon */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
            success ? "bg-green-100" : "bg-red-100"
          }`}>
            {success ? (
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            )}
          </div>

          <div>
            <h2 className={`text-xl font-bold ${success ? "text-green-700" : "text-red-600"}`}>
              {success ? "Scan Successful" : "Scan Incomplete"}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {success
                ? "All expected medicines were verified."
                : "Some medicines could not be verified."}
            </p>
          </div>
        </div>

        {/* Summary counts */}
        <div className="grid grid-cols-4 gap-2 px-6 py-4 bg-slate-50">
          {[
            { label: "Matched", val: summary.matched,          cls: "text-green-600 bg-green-100"  },
            { label: "Missing", val: summary.missing,          cls: "text-red-500   bg-red-100"    },
            { label: "Extra",   val: summary.extra,            cls: "text-amber-600 bg-amber-100"  },
            { label: "Unknown", val: summary.unknown || unknown.length, cls: "text-orange-600 bg-orange-100" },
          ].map(({ label, val, cls }) => (
            <div key={label} className={`rounded-xl py-3 text-center ${cls.split(" ")[1]}`}>
              <p className={`text-2xl font-bold ${cls.split(" ")[0]}`}>{val}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Detail lists */}
        <div className="px-6 py-4 space-y-4 max-h-72 overflow-y-auto">

          {missing.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>
                Missing Medicines ({missing.length} unit{missing.length !== 1 ? "s" : ""})
              </p>
              <div className="space-y-1">
                {/* Group by name so "3× Sefloc missing" shows as one row */}
                {Object.entries(
                  missing.reduce((acc, r) => {
                    const key = r.final_name;
                    if (!acc[key]) acc[key] = { ...r, count: 0 };
                    acc[key].count += 1;
                    return acc;
                  }, {})
                ).map(([name, r]) => (
                  <div key={name} className="flex items-center gap-3 bg-red-50 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-red-400 shrink-0" fill="none"
                      stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-sm font-semibold text-red-700 font-mono">
                      {name}
                    </span>
                    {r.count > 1 && (
                      <span className="text-xs font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">
                        ×{r.count}
                      </span>
                    )}
                    <span className="text-xs text-red-400 ml-auto">{r.layer4_note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {extra.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>
                Unexpected Medicines
              </p>
              <div className="space-y-1">
                {extra.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 bg-amber-50 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none"
                      stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01"/>
                    </svg>
                    <span className="text-sm font-semibold text-amber-700 font-mono">
                      {r.final_name}
                    </span>
                    <span className="text-xs text-amber-500 ml-auto">Not in list</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {review.length > 0 && (
            <div>
              <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"/>
                Needs Manual Review
              </p>
              <div className="space-y-1">
                {review.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 bg-yellow-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-semibold text-yellow-700 font-mono">
                      {r.final_name}
                    </span>
                    <span className="text-xs text-yellow-500 ml-auto">OCR/Vision conflict</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unknown.length > 0 && (
            <div>
              <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>
                Unidentified Boxes ({unknown.length})
              </p>
              <div className="space-y-1">
                {unknown.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 bg-orange-50 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none"
                      stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-semibold text-orange-700 font-mono">
                      Box {r.box_id ?? i + 1}
                    </span>
                    <span className="text-xs text-orange-400 ml-auto">
                      {r.ocr_raw ? `OCR: "${r.ocr_raw}"` : "No text detected"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 bg-green-50 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-700 font-medium">
                All {summary.matched} medicine{summary.matched !== 1 ? "s" : ""} verified successfully.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 space-y-2">
          {/* Continue Scan — only shown when there are still missing medicines */}
          {!success && (
            <button
              onClick={continueScan}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold
                         py-3 rounded-xl transition-colors text-sm flex items-center
                         justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Continue Scanning
              <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                F8
              </span>
            </button>
          )}

          {/* Close & Review / Done — always shown */}
          <button
            onClick={handleClose}
            className={`w-full font-semibold py-3 rounded-xl transition-colors text-sm ${
              success
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            {success ? "✓  Done — All Verified" : "Close & Review"}
          </button>

          {!success && (
            <p className="text-center text-xs text-slate-400">
              Continue scanning to find missing medicines, or close to save this result to history.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}