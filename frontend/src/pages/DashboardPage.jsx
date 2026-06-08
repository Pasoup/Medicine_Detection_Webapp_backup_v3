function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function getStatusKey(item) {
  if (item.missing > 0) return "error";
  if (item.extra > 0 || (item.unknown || 0) > 0 || item.review > 0) return "partial";
  return "ok";
}

export default function DashboardPage({ history, onNavigate }) {
  const todayStr   = new Date().toDateString();
  const todayItems = history.filter(h => new Date(h.timestamp).toDateString() === todayStr);

  const stats = {
    total:    todayItems.length,
    passed:   todayItems.filter(h => getStatusKey(h) === "ok").length,
    errors:   todayItems.filter(h => getStatusKey(h) !== "ok").length,
    accuracy: todayItems.length === 0
                ? "—"
                : Math.round((todayItems.filter(h => getStatusKey(h) === "ok").length / todayItems.length) * 100) + "%",
  };

  const recent = todayItems.slice(0, 8);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => onNavigate("scan")}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                     font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          New Scan
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Scans Today", value: stats.total,
            icon: (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            ),
            color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100",
          },
          {
            label: "All Passed", value: stats.passed,
            icon: (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ),
            color: "text-green-600", bg: "bg-green-50", border: "border-green-100",
          },
          {
            label: "Had Errors", value: stats.errors,
            icon: (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ),
            color: "text-red-500", bg: "bg-red-50", border: "border-red-100",
          },
          {
            label: "Accuracy", value: stats.accuracy,
            icon: (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
            color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200",
          },
        ].map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-2xl p-5`}>
            <div className={`${color} mb-3`}>{icon}</div>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Activity
          </h2>
          <button
            onClick={() => onNavigate("history")}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
          >
            View all →
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-300">
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No activity yet — start scanning</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recent.map(item => {
              const key   = getStatusKey(item);
              const dot   = key === "ok" ? "bg-green-500" : key === "partial" ? "bg-amber-400" : "bg-red-500";
              const label = key === "ok" ? "Passed" : key === "partial" ? "Partial" : "Failed";
              const badge = key === "ok"
                ? "bg-green-100 text-green-700"
                : key === "partial"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700";
              return (
                <div key={item.id} className="flex items-center gap-4 px-6 py-3.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.summary}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(item.timestamp)}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <span className="text-green-600 font-medium">{item.matched} matched</span>
                    {item.missing > 0 && <span className="text-red-500 font-medium">{item.missing} missing</span>}
                    {item.extra   > 0 && <span className="text-amber-500   font-medium">{item.extra} extra</span>}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${badge}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            page: "scan", title: "Start Scanning",
            desc: "Place medicines in front of cameras and verify against expected list",
            icon: (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
            color: "hover:border-blue-300 hover:bg-blue-50",
          },
          {
            page: "history", title: "View History",
            desc: "Browse and filter all past verification sessions",
            icon: (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      
              </svg>
            ),
            color: "hover:border-blue-300 hover:bg-blue-50",
          },
          {
            page: "master", title: "Master Data",
            desc: "Manage the medicine database and system users",
            icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
      ),
      color: "hover:border-blue-300 hover:bg-blue-50",
          },
        ].map(({ page, title, desc, icon, color }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className={`text-left p-5 bg-white rounded-2xl border border-slate-200
                        shadow-sm transition-all ${color}`}
          >
            <span className="text-2xl text-slate-500">{icon}</span>
            <p className="mt-3 font-semibold text-slate-700 text-sm">{title}</p>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
