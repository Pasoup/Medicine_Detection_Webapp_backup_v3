import { useState, useRef,useEffect } from "react";

export default function ExpectedMedicines({ expected, setExpected, scanResults, summary, onListChanged }) {
  const [name,     setName]     = useState("");
  const [quantity, setQuantity] = useState(1);
  const fileRef = useRef(null);

    useEffect(() => {
      const handler = (e) => {
        if (e.code === "F9") fileRef.current?.click();
        if (e.code === "F10") clearAll();
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, []);
  const addMedicine = () => {
    const n = name.trim().toUpperCase();
    if (!n) return;
    if (expected.some(e => e.name === n)) {
      setExpected(prev => prev.map(e =>
        e.name === n ? { ...e, quantity: e.quantity + quantity } : e
      ));
      setName("");
      setQuantity(1);
      onListChanged?.();
      return;
    }
    setExpected(prev => [...prev, { name: n, quantity }]);
    setName("");
    setQuantity(1);
    onListChanged?.();
  };

  const removeMedicine = (n) => {
    setExpected(prev => prev.filter(e => e.name !== n));
    onListChanged?.();
  };

  const clearAll = () => {
    setExpected([]);
    onListChanged?.();
  };

  const loadFromFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split(/\r?\n/);
      const newMeds = [];
      for (const line of lines) {
        const n = line.trim().toUpperCase();
        if (n && !expected.some(e => e.name === n) && !newMeds.some(m => m.name === n)) {
          newMeds.push({ name: n, quantity: 1 });
        }
      }
      setExpected(prev => [...prev, ...newMeds]);
      onListChanged?.();
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const getStatus = (name) => {
    if (!scanResults || scanResults.length === 0) return null;
    const entries = scanResults.filter(r => r.final_name?.toUpperCase() === name);
    if (entries.length === 0) return null;
    const missingCount = entries.filter(r => r.scan_status === "MISSING").length;
    const extraCount   = entries.filter(r => r.scan_status === "EXTRA").length;
    const matchedCount = entries.filter(r => r.scan_status === "MATCHED").length;
    if (missingCount > 0) return { status: "MISSING", count: missingCount };
    if (extraCount   > 0) return { status: "EXTRA",   count: extraCount   };
    if (matchedCount > 0) return { status: "MATCHED", count: matchedCount };
    return { status: entries[0].scan_status, count: 1 };
  };

  // Count total UNKNOWN boxes across all scan results (not tied to a medicine name)
  const unknownCount = scanResults
    ? scanResults.filter(r => r.scan_status === "UNKNOWN").length
    : 0;

  const STATUS_STYLE = {
    MATCHED:        "bg-green-100 text-green-700",
    MISSING:        "bg-red-100   text-red-700",
    EXTRA:          "bg-amber-100 text-amber-700",
    PENDING_REVIEW: "bg-yellow-100 text-yellow-700",
    UNKNOWN:        "bg-orange-100 text-orange-700",
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Expected Medicines</h2>

      {/* File import banner */}
      <div
        onClick={() => fileRef.current?.click()}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3
                   text-sm text-slate-400 cursor-pointer hover:bg-slate-100 mb-4
                   transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Load expected data from medicine file (.txt)
        <span className="ml-auto text-xs font-mono bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
          F9
        </span>
      </div>
      <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={loadFromFile} />

      {/* Manual add */}
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
        Medicine Name
      </label>
      <div className="flex gap-2 mb-1">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addMedicine()}
          placeholder="Enter medicine name"
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm
                     text-slate-700 bg-slate-50 focus:outline-none focus:ring-2
                     focus:ring-blue-500 focus:bg-white transition"
        />
        <input
          type="number" min={1} value={quantity}
          onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                     text-slate-700 bg-slate-50 focus:outline-none focus:ring-2
                     focus:ring-blue-500 text-center"
        />
      </div>

      {/* Load / Clear buttons */}
      <div className="flex gap-3 mb-5 mt-3">
        <button
          onClick={addMedicine}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold
                     py-2.5 rounded-xl text-sm transition-colors"
        >
          Load Data
        </button>
        <button
          onClick={clearAll}
          className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold
                     py-2.5 rounded-xl text-sm transition-colors"
        >
          
          Clear Data
           <span className="text-xs font-mono bg-white/20 px-1.5 py-0.5 rounded">F10</span>
        </button>
      </div>

      {/* Expected list */}
      {expected.length > 0 && (
        <>
          <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">
            Expected List
          </p>
          <div className="flex flex-col divide-y divide-slate-100 border border-slate-200
                          rounded-xl overflow-hidden mb-5 max-h-52 overflow-y-auto">
            {expected.map(({ name: n, quantity: q }) => {
              const st = getStatus(n);
              return (
                <div key={n} className="flex items-center px-4 py-3 bg-white hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{n}</p>
                    <p className="text-xs text-slate-400">×{q} unit{q > 1 ? "s" : ""}</p>
                  </div>
                  {st && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full mr-2 ${STATUS_STYLE[st.status] || ""}`}>
                      {st.status === "MISSING" && st.count > 0
                        ? `Missing ×${st.count}`
                        : st.status === "EXTRA" && st.count > 0
                        ? `Extra ×${st.count}`
                        : st.status === "UNKNOWN"
                        ? "Unknown"
                        : st.status}
                    </span>
                  )}
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center
                                  justify-center text-slate-400 font-bold text-sm mr-2">
                    x{q}
                  </div>
                  <button onClick={() => removeMedicine(n)}
                    className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none">
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {[
          { label: "Matched", value: summary.matched, bg: "bg-green-50",  text: "text-green-600" },
          { label: "Missing", value: summary.missing, bg: "bg-yellow-50", text: "text-orange-500" },
        ].map(({ label, value, bg, text }) => (
          <div key={label} className={`${bg} rounded-xl py-4 flex flex-col items-center gap-0.5`}>
            <span className={`text-2xl font-bold ${text}`}>{value}</span>
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Extra",   value: summary.extra,          bg: "bg-red-50",    text: "text-red-500" },
          { label: "Unknown", value: summary.unknown || unknownCount, bg: "bg-orange-50", text: "text-orange-600" },
        ].map(({ label, value, bg, text }) => (
          <div key={label} className={`${bg} rounded-xl py-4 flex flex-col items-center gap-0.5`}>
            <span className={`text-2xl font-bold ${text}`}>{value}</span>
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}