function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function ScanHistory({ history, onSelect }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Scan History</h2>
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-300">
          <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">No scans yet</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
          {history.map((item) => {
            const allGood  = item.missing === 0 && item.extra === 0 && item.review === 0 && (item.unknown || 0) === 0;
            const dotColor = allGood ? "bg-green-500" : item.missing > 0 ? "bg-red-500" : (item.unknown || 0) > 0 ? "bg-orange-400" : "bg-amber-400";

            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="w-full text-left flex items-start justify-between py-3 px-3
                           border border-transparent rounded-xl hover:bg-slate-50
                           hover:border-slate-200 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                  <div>
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                      {item.summary}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-slate-400">{formatDate(item.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
                        {item.matched}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"/>
                        {item.missing}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"/>
                        {item.extra}
                      </span>
                      {(item.unknown || 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block"/>
                          {item.unknown}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 mt-1 shrink-0 transition-colors"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}