import { useState, useRef, useEffect } from "react";
import { getMedicinesCodes } from "../api/index.js";

export default function ExpectedMedicines({ expected, setExpected, scanResults, summary, onListChanged }) {
  const [name,     setName]     = useState("");
  const [quantity, setQuantity] = useState(1);
  const [codes,    setCodes]    = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    getMedicinesCodes().then(setCodes).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.code === "F9")  fileRef.current?.click();
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
    } else {
      setExpected(prev => [...prev, { name: n, quantity }]);
    }
    setName("");
    setQuantity(1);
    onListChanged?.();
  };
  
  
  const editMedicine = () => {

  }

  const removeMedicine = (n) => { setExpected(prev => prev.filter(e => e.name !== n)); onListChanged?.(); };
  const clearAll       = ()  => { setExpected([]);                                       onListChanged?.(); };

  const loadFromCode = (codeId) => {
    if (!codeId) return;
    const code = codes.find(c => c.id === parseInt(codeId));
    if (!code?.items?.length) return;
    const newList = code.items.map(item => ({
      name: item.drug_name.toUpperCase(),
      quantity: item.quantity,
    }));
    setExpected(newList);
    onListChanged?.();
  };

  const loadFromFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const newMeds = ev.target.result.split(/\r?\n/)
        .map(l => l.trim().toUpperCase())
        .filter(n => n && !expected.some(e => e.name === n))
        .map(n => ({ name: n, quantity: 1 }));
      setExpected(prev => [...prev, ...newMeds]);
      onListChanged?.();
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const getStatus = (name) => {
    if (!scanResults?.length) return null;
    const entries = scanResults.filter(r => r.final_name?.toUpperCase() === name);
    if (!entries.length) return null;
    if (entries.some(r => r.scan_status === "MISSING")) return { status: "MISSING" };
    if (entries.some(r => r.scan_status === "EXTRA"))   return { status: "EXTRA"   };
    if (entries.some(r => r.scan_status === "MATCHED")) return { status: "MATCHED" };
    return { status: entries[0].scan_status };
  };

  const unknownCount = scanResults?.filter(r => r.scan_status === "UNKNOWN").length ?? 0;

  const STATUS_STYLE = {
    MATCHED:        "bg-green-100 text-green-700",
    MISSING:        "bg-red-100   text-red-700",
    EXTRA:          "bg-amber-100 text-amber-700",
    PENDING_REVIEW: "bg-yellow-100 text-yellow-700",
    UNKNOWN:        "bg-orange-100 text-orange-700",
  };

  const hasScanResults = scanResults && scanResults.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">

      {/* Header */}
      <h2 className="text-base font-semibold text-slate-800">Expected Medicines</h2>

      {/* Input row */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Medicine Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addMedicine()}
            placeholder="Enter medicine name"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm
                       text-slate-700 focus:outline-none focus:ring-2
                       focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            QTY
          </label>
          <input
            type="number" min={1} value={quantity}
            onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                       text-slate-700 focus:outline-none focus:ring-2
                       focus:ring-blue-500 text-center"
          />
        </div>
        <button
          onClick={addMedicine}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold
                     px-6 py-2.5 rounded-xl text-sm transition-colors shrink-0"
        >
          Add
        </button>
      </div>

      {/* Secondary actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {codes.length > 0 && (
          <select
            defaultValue=""
            onChange={e => { loadFromCode(e.target.value); e.target.value = ""; }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600
                       focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="" disabled>Load Code…</option>
            {codes.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50
                     text-slate-500 font-medium px-3 py-2 rounded-xl text-xs transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Import .txt
          <span className="font-mono bg-slate-100 text-slate-400 px-1 py-0.5 rounded text-[10px]">F9</span>
        </button>

        {expected.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 border border-red-200 hover:bg-red-50
                       text-red-400 font-medium px-3 py-2 rounded-xl text-xs transition-colors"
          >
            Clear all
            <span className="font-mono bg-red-50 text-red-400 px-1 py-0.5 rounded text-[10px]">F10</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={loadFromFile} />
      </div>

      {/* Medicine list */}
      {expected.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100
                        max-h-52 overflow-y-auto">
          {expected.map(({ name: n, quantity: q }) => {
            const st = getStatus(n);
            return (
              <div key={n} className="flex items-center px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{n}</p>
                  <p className="text-xs text-slate-400 mt-0.5">×{q} unit{q > 1 ? "s" : ""}</p>
                </div>
                {st && (
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full mr-3
                                    ${STATUS_STYLE[st.status] || ""}`}>
                    {st.status === "MISSING"  ? "Missing"
                     : st.status === "EXTRA"  ? "Extra"
                     : st.status === "MATCHED" ? "Matched"
                     : st.status}
                  </span>
                )}
                <button
                  onClick={() => removeMedicine(n)}
                  className="w-6 h-6 flex items-center justify-center rounded-full
                             text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors text-base"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-slate-300
                        border border-dashed border-slate-200 rounded-xl">
          <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2
                 M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">No medicines added yet</p>
        </div>
      )}

      {/* Summary row — only shown after a scan */}
      {hasScanResults && (
        <div className="grid grid-cols-4 gap-3 pt-1">
          {[
            { label: "Matched", value: summary.matched,               bg: "bg-green-50",  text: "text-green-600",  border: "border-green-100"  },
            { label: "Missing", value: summary.missing,               bg: "bg-red-50",    text: "text-red-500",    border: "border-red-100"    },
            { label: "Extra",   value: summary.extra,                 bg: "bg-amber-50",  text: "text-amber-500",  border: "border-amber-100"  },
            { label: "Unknown", value: summary.unknown ?? unknownCount, bg: "bg-orange-50", text: "text-orange-500", border: "border-orange-100" },
          ].map(({ label, value, bg, text, border }) => (
            <div key={label} className={`${bg} border ${border} rounded-xl py-4 flex flex-col items-center gap-1 w-60 h-30`}>
              <span className={`text-2xl font-bold ${text}`}>{value}</span>
              <span className="text-xs text-slate-500 font-medium">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
