import { useState, useEffect } from "react";
import {
  getMedicinesCodes, addMedicineCode, updateMedicineCode, deleteMedicineCode,
  addMedicineCodeItem, deleteMedicineCodeItem, updateMedicineCodeItem, getDrugDatabase
} from "../api/index";

export default function MedicineCodePage({ user }) {

  const [codes,        setCodes]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [expandedId,   setExpandedId]   = useState(null);
  const [editingQty,   setEditingQty]   = useState(null); // { codeId, itemId, value }
  const [modal,        setModal]        = useState(null);
  const [drugs,        setDrugs]        = useState([]);
  const [modalLabel,   setModalLabel]   = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError,   setModalError]   = useState(null);
  const [itemDrug,     setItemDrug]     = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);

  const fetchCodes = () => {
    setLoading(true);
    return getMedicinesCodes()
      .then(data => setCodes(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCodes(); }, []);

  useEffect(() => {
    getDrugDatabase()
      .then(data => setDrugs(data.drugs || []))
      .catch(() => {});
  }, []);

  const openAdd      = ()           => { setModal({ type: "add" });                setModalLabel("");          setModalError(null); };
  const openEdit     = (code)       => { setModal({ type: "edit", code });         setModalLabel(code.label);  setModalError(null); };
  const openDelete   = (code)       => { setModal({ type: "delete", code });       setModalError(null); };
  const openAddItem  = (code)       => { setModal({ type: "addItem", code });      setItemDrug(""); setItemQuantity(1); setModalError(null); };
  const openDelItem  = (code, item) => { setModal({ type: "deleteItem", code, item }); setModalError(null); };
  const closeModal   = ()           => { setModal(null); setModalLoading(false);   setModalError(null); };

  const handleAdd = async () => {
    if (!modalLabel.trim()) return;
    setModalLoading(true); setModalError(null);
    try {
      await addMedicineCode(modalLabel.trim());
      await fetchCodes();
      closeModal();
    } catch (err) { setModalError(err.message); setModalLoading(false); }
  };

  const handleEdit = async () => {
    if (!modalLabel.trim()) return;
    setModalLoading(true); setModalError(null);
    try {
      await updateMedicineCode(modal.code.id, modalLabel.trim());
      await fetchCodes();
      closeModal();
    } catch (err) { setModalError(err.message); setModalLoading(false); }
  };

  const handleDelete = async () => {
    setModalLoading(true); setModalError(null);
    try {
      await deleteMedicineCode(modal.code.id);
      if (expandedId === modal.code.id) setExpandedId(null);
      await fetchCodes();
      closeModal();
    } catch (err) { setModalError(err.message); setModalLoading(false); }
  };

  const handleAddItem = async () => {
    if (!itemDrug) return;
    setModalLoading(true); setModalError(null);
    try {
      await addMedicineCodeItem(modal.code.id, itemDrug, itemQuantity);
      await fetchCodes();
      closeModal();
    } catch (err) { setModalError(err.message); setModalLoading(false); }
  };

  const saveQty = async () => {
    if (!editingQty) return;
    const qty = parseInt(editingQty.value);
    if (!qty || qty < 1) { setEditingQty(null); return; }
    try {
      await updateMedicineCodeItem(editingQty.codeId, editingQty.itemId, qty);
      await fetchCodes();
    } catch (_) {}
    setEditingQty(null);
  };

  const handleDeleteItem = async () => {
    setModalLoading(true); setModalError(null);
    try {
      await deleteMedicineCodeItem(modal.code.id, modal.item.id);
      await fetchCodes();
      closeModal();
    } catch (err) { setModalError(err.message); setModalLoading(false); }
  };

  const Spinner = () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Medicine Codes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage preset medicine code lists</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                     font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          New Code
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
            <span className="text-sm">Loading medicine codes…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 text-red-400 gap-2">
            <p className="text-sm font-medium">Could not load medicine codes</p>
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {!loading && !error && codes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <p className="text-sm">No medicine codes yet</p>
          </div>
        )}

        {!loading && !error && codes.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["#", "Code Name", "Items", ""].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold
                                          text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {codes.map((code, idx) => (
                <>
                  <tr
                    key={code.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === code.id ? null : code.id)}
                  >
                    <td className="px-5 py-3.5 text-xs text-slate-400 font-mono w-12">{idx + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        <svg
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedId === code.id ? "rotate-90" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                        </svg>
                        {code.label}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">
                      {(code.items || []).length} medicine{(code.items || []).length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(code)}
                          className="text-xs text-slate-500 hover:text-blue-600 font-medium
                                     border border-slate-200 px-2.5 py-1 rounded-lg
                                     hover:border-blue-300 transition-all"
                        >Edit</button>
                        <button
                          onClick={() => openDelete(code)}
                          className="text-xs font-medium border px-2.5 py-1 rounded-lg
                                     transition-all text-red-500 border-red-200 hover:bg-red-50"
                        >Delete</button>
                      </div>
                    </td>
                  </tr>

                  {expandedId === code.id && (
                    <tr key={`${code.id}-items`}>
                      <td colSpan={4} className="bg-slate-50 px-10 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Medicines in this code
                          </p>
                          <button
                            onClick={() => openAddItem(code)}
                            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700
                                       text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                            </svg>
                            Add Medicine
                          </button>
                        </div>
                        {(!code.items || code.items.length === 0) ? (
                          <p className="text-xs text-slate-400">No medicines added yet.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200">
                                {["Drug Name", "Qty", ""].map(h => (
                                  <th key={h} className="text-left pb-2 text-xs font-semibold
                                                          text-slate-400 uppercase tracking-wider">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {code.items.map(item => (
                                <tr key={item.id} className="hover:bg-white transition-colors">
                                  <td className="py-2.5 pr-4 font-medium text-slate-700">{item.drug_name}</td>
                                  <td className="py-2.5 pr-4 text-slate-500">
                                    {editingQty?.itemId === item.id ? (
                                      <input
                                        type="number"
                                        min="1"
                                        className="w-16 border border-blue-400 rounded px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none"
                                        value={editingQty.value}
                                        onChange={e => setEditingQty(prev => ({ ...prev, value: e.target.value }))}
                                        onBlur={saveQty}
                                        onKeyDown={e => { if (e.key === "Enter") saveQty(); if (e.key === "Escape") setEditingQty(null); }}
                                        autoFocus
                                      />
                                    ) : (
                                      <span
                                        className="cursor-pointer hover:text-blue-600 hover:underline"
                                        onClick={() => setEditingQty({ codeId: code.id, itemId: item.id, value: item.quantity })}
                                      >{item.quantity}</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 text-right">
                                    <button
                                      onClick={() => openDelItem(code, item)}
                                      className="text-xs font-medium border px-2.5 py-1 rounded-lg
                                                 transition-all text-red-500 border-red-200 hover:bg-red-50"
                                    >Remove</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && closeModal()}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"/>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">

            {(modal.type === "add" || modal.type === "edit") && (
              <>
                <h3 className="text-base font-bold text-slate-800 mb-4">
                  {modal.type === "add" ? "New Medicine Code" : "Edit Medicine Code"}
                </h3>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Code Name
                </label>
                <input
                  autoFocus
                  value={modalLabel}
                  onChange={e => { setModalLabel(e.target.value); setModalError(null); }}
                  onKeyDown={e => { if (e.key === "Enter") modal.type === "add" ? handleAdd() : handleEdit(); if (e.key === "Escape") closeModal(); }}
                  placeholder="e.g. Morning Meds"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                             text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                {modalError && <p className="text-xs text-red-500 mb-3">{modalError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                               font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={modal.type === "add" ? handleAdd : handleEdit}
                    disabled={modalLoading || !modalLabel.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                               bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                               transition-colors disabled:opacity-50"
                  >
                    {modalLoading && <Spinner/>}
                    {modal.type === "add" ? "Create" : "Save"}
                  </button>
                </div>
              </>
            )}

            {modal.type === "delete" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Delete Code</h3>
                    <p className="text-xs text-slate-400">This will also delete all medicines in this code</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Delete <span className="font-semibold text-slate-800">{modal.code.label}</span>?
                </p>
                {modalError && <p className="text-xs text-red-500 mb-3">{modalError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                               font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleDelete} disabled={modalLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                               bg-red-500 hover:bg-red-600 text-white text-sm font-semibold
                               transition-colors disabled:opacity-50">
                    {modalLoading && <Spinner/>}
                    Delete
                  </button>
                </div>
              </>
            )}

            {modal.type === "addItem" && (
              <>
                <h3 className="text-base font-bold text-slate-800 mb-4">Add Medicine</h3>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Drug
                </label>
                <select
                  value={itemDrug}
                  onChange={e => setItemDrug(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                             text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                >
                  <option value="">Select a drug…</option>
                  {drugs.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Quantity
                </label>
                <input
                  type="number" min={1} value={itemQuantity}
                  onChange={e => setItemQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                             text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                {modalError && <p className="text-xs text-red-500 mb-3">{modalError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                               font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleAddItem} disabled={modalLoading || !itemDrug}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                               bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                               transition-colors disabled:opacity-50">
                    {modalLoading && <Spinner/>}
                    Add
                  </button>
                </div>
              </>
            )}

            {modal.type === "deleteItem" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Remove Medicine</h3>
                    <p className="text-xs text-slate-400">This cannot be undone</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Remove <span className="font-semibold text-slate-800">{modal.item.drug_name}</span> from this code?
                </p>
                {modalError && <p className="text-xs text-red-500 mb-3">{modalError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                               font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleDeleteItem} disabled={modalLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                               bg-red-500 hover:bg-red-600 text-white text-sm font-semibold
                               transition-colors disabled:opacity-50">
                    {modalLoading && <Spinner/>}
                    Remove
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
