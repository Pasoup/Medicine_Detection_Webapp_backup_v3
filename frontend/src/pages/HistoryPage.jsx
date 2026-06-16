import { useState, useMemo } from "react";
import { getHistoryDetail, exportHistory } from "../api";
import HistoryDetailPopup from "../components/HistoryDetailPopup";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

const STATUS_BADGE = {
  ok:      "bg-green-100 text-green-700",
  error:   "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
};

function getStatusKey(item) {
  if (item.missing > 0) return "error";
  if (item.extra > 0 || (item.unknown || 0) > 0 || item.review > 0) return "partial";
  return "ok";
}

const PAGE_SIZE = 10;

export default function HistoryPage({ history }) {
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState("all");
  const [page,      setPage]      = useState(1);
  const [detail,    setDetail]    = useState(null);
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return history.filter(item => {
      const matchSearch = !q || item.summary?.toLowerCase().includes(q) ||
                          formatDate(item.timestamp).toLowerCase().includes(q);
      const key = getStatusKey(item);
      const matchFilter = filter === "all" ||
                          (filter === "pass"    && key === "ok") ||
                          (filter === "partial" && key === "partial") ||
                          (filter === "fail"    && key === "error");
      return matchSearch && matchFilter;
    });
  }, [history, search, filter]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Summary stats from all history
  const todayStr = new Date().toDateString();
  const todayItems = history.filter(h => new Date(h.timestamp).toDateString() === todayStr);
  const stats = {
    total:   todayItems.length,
    passed:  todayItems.filter(h => getStatusKey(h) === "ok").length,
    errors:  todayItems.filter(h => getStatusKey(h) !== "ok").length,
    matched: todayItems.reduce((s, h) => s + (h.matched || 0), 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Scan History</h1>
          <p className="text-sm text-slate-500 mt-0.5">All verification sessions recorded this session</p>
        </div>
        <button
          onClick={() => { setExporting(true); exportHistory().finally(() => setExporting(false)); }}
          disabled={exporting || history.length === 0}
          className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50
                     text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-sm
                     transition-colors disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          {exporting ? "Exporting…" : "Export Excel"}
        </button>
      </div>


      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by medicine name or date…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl
                       bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {[
            { key: "all",     label: "All"     },
            { key: "pass",    label: "Passed"  },
            { key: "partial", label: "Partial" },
            { key: "fail",    label: "Failed"  },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all
                          ${filter === key
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-medium">
              {history.length === 0 ? "No scans yet" : "No results match your filter"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date / Time</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Scanned By</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-green-600 uppercase tracking-wider">✓ Matched</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-red-500 uppercase tracking-wider">⚠ Missing</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-amber-500 uppercase tracking-wider">× Extra</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-orange-500 uppercase tracking-wider">? Unknown</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slice.map((item, idx) => {
                    const statusKey = getStatusKey(item);
                    const statusLabel = statusKey === "ok" ? "Passed" : statusKey === "partial" ? "Partial" : "Failed";
                    return (
                      <tr
                        key={item.id}
                        onClick={() => getHistoryDetail(item.id).then(data => setDetail(data))}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">
                          {(currentPage - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                          {formatDate(item.timestamp)}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 max-w-[160px]">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <span className="text-sm font-medium truncate">{item.scanned_by || "—"}</span>
                          </div>
                        </td>
                        <td>
                           <span className="text-sm font-medium truncate">{item.location || "—"}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-green-600">{item.matched}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-red-500">{item.missing}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-amber-500">{item.extra}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-orange-500">{item.unknown || 0}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold
                                            ${STATUS_BADGE[statusKey]}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={e => { e.stopPropagation(); getHistoryDetail(item.id).then(data =>setDetail(data)); }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium
                                       hover:underline transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100
                            text-sm text-slate-500">
              <span>
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium
                             disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-xs text-slate-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 py-1.5 rounded-lg border text-xs font-medium transition-colors
                                    ${currentPage === p
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        {p}
                      </button>
                    )
                  )
                }
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium
                             disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {detail && <HistoryDetailPopup item={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
