import { useEffect } from "react";

const API = "http://localhost:8000";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "short", year: "numeric", month: "short",
      day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return iso; }
}

const STATUS_CONFIG = {
  MATCHED:        { label: "Matched",      bg: "bg-green-50",  text: "text-green-700",  badge: "bg-green-100 text-green-700",   dot: "bg-green-500"  },
  MISSING:        { label: "Missing",      bg: "bg-red-50",    text: "text-red-700",    badge: "bg-red-100   text-red-700",     dot: "bg-red-500"    },
  EXTRA:          { label: "Extra",        bg: "bg-amber-50",  text: "text-amber-700",  badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-400"  },
  PENDING_REVIEW: { label: "Needs Review", bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400" },
  UNKNOWN:        { label: "Unknown",      bg: "bg-orange-50", text: "text-orange-700", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-400" },
};

function ResultRow({ r }) {
  const cfg = STATUS_CONFIG[r.scan_status] || STATUS_CONFIG.UNKNOWN;
  const imgSrc = r.reference_image ? `${API}${r.reference_image}` : null;
  console.log("HEREEEE")
  console.log(imgSrc)

  return (
    <div className={`rounded-xl px-4 py-3 ${cfg.bg}`}>
      {/* Top row: dot + name + badge */}
      <div className="flex items-start gap-3">
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-semibold font-mono truncate ${cfg.text}`}>
              {r.final_name}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>

          {/* Layer 4 note */}
          {r.layer4_note && r.layer4_note !== "Not detected in scan" && (
            <p className="text-xs text-slate-400 mt-0.5 leading-tight">{r.layer4_note}</p>
          )}

          {/* Missing label with quantity info */}
          {r.scan_status === "MISSING" && (
            <p className="text-xs text-red-400 mt-0.5">
              {r.qty_expected
                ? `❌ Expected ${r.qty_expected}× — only ${r.qty_found} found`
                : "❌ Not detected in scan"}
            </p>
          )}

          {/* OCR raw */}
          {r.ocr_raw && (
            <p className="text-xs text-slate-400 mt-0.5">
              OCR: <span className="font-mono">{r.ocr_raw}</span>
            </p>
          )}
        </div>
      </div>

      {/* Reference image — only shown for MISSING with an image */}
      {r.scan_status === "MISSING" && imgSrc && (
        <div className="mt-3 ml-5">
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-1.5">
            Reference — what this medicine looks like
          </p>
          <img
            src={imgSrc}
            alt={`Reference image for ${r.final_name}`}
            className="h-24 w-auto rounded-lg border border-red-200 object-contain bg-white shadow-sm"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        </div>
      )}

      {/* No image fallback */}
      {r.scan_status === "MISSING" && !imgSrc && (
        <div className="mt-3 ml-5 flex items-center gap-2 text-xs text-red-300 italic">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          No reference image found — add one to data/medicine_images/
        </div>
      )}
    </div>
  );
}

export default function HistoryDetailPopup({ item, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const results = item.results || [];
  const matched = results.filter(r => r.scan_status === "MATCHED");
  const missing = results.filter(r => r.scan_status === "MISSING");
  const extra   = results.filter(r => r.scan_status === "EXTRA");
  const review  = results.filter(r => r.scan_status === "PENDING_REVIEW");
  const unknown = results.filter(r => r.scan_status === "UNKNOWN");
  const allGood = missing.length === 0 && extra.length === 0 && review.length === 0 && unknown.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg
                      overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between ${
          allGood ? "bg-green-50 border-b border-green-100"
                  : "bg-slate-50  border-b border-slate-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              allGood ? "bg-green-100" : "bg-blue-100"
            }`}>
              <svg className={`w-5 h-5 ${allGood ? "text-green-600" : "text-blue-600"}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Scan Detail</h2>
              <p className="text-xs text-slate-400">{formatDate(item.timestamp)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200
                       flex items-center justify-center text-slate-400
                       hover:text-slate-600 transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-2 px-6 py-4 border-b border-slate-100">
          {[
            { label: "Matched", val: item.matched,          numCls: "text-green-600",  bgCls: "bg-green-50"  },
            { label: "Missing", val: item.missing,          numCls: "text-red-500",    bgCls: "bg-red-50"    },
            { label: "Extra",   val: item.extra,            numCls: "text-amber-600",  bgCls: "bg-amber-50"  },
            { label: "Unknown", val: item.unknown || unknown.length, numCls: "text-orange-600", bgCls: "bg-orange-50" },
          ].map(({ label, val, numCls, bgCls }) => (
            <div key={label} className={`rounded-xl py-3 text-center ${bgCls}`}>
              <p className={`text-2xl font-bold ${numCls}`}>{val}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Annotated image */}
        {item.annotated && (
          <div className="px-6 pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              Annotated Image
            </p>
            <img
              src={item.annotated}
              alt="Annotated scan"
              className="w-full rounded-xl border border-slate-200 object-contain max-h-48"
            />
          </div>
        )}

        {/* Results grouped by status */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {missing.length > 0 && (
            <section>
              <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Missing ({missing.length})
              </p>
              <div className="space-y-3">
                {missing.map((r, i) => <ResultRow key={i} r={r} />)}
              </div>
            </section>
          )}

          {matched.length > 0 && (
            <section>
              <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Matched ({matched.length})
              </p>
              <div className="space-y-2">
                {matched.map((r, i) => <ResultRow key={i} r={r} />)}
              </div>
            </section>
          )}

          {extra.length > 0 && (
            <section>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Unexpected ({extra.length})
              </p>
              <div className="space-y-2">
                {extra.map((r, i) => <ResultRow key={i} r={r} />)}
              </div>
            </section>
          )}

          {review.length > 0 && (
            <section>
              <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                Needs Review ({review.length})
              </p>
              <div className="space-y-2">
                {review.map((r, i) => <ResultRow key={i} r={r} />)}
              </div>
            </section>
          )}

          {unknown.length > 0 && (
            <section>
              <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                Unidentified ({unknown.length})
              </p>
              <div className="space-y-2">
                {unknown.map((r, i) => <ResultRow key={i} r={r} />)}
              </div>
            </section>
          )}

          {results.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No detail data available.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold
                       py-3 rounded-xl transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}