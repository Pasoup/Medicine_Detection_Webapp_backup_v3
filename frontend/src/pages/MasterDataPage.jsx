import { useState, useEffect, useMemo, useRef } from "react";
import { getDrugDatabase, addDrug, updateDrug, deleteDrug, getUsers, createUser,updateUser,deleteUser } from "../api/index";


const TABS = [
  { id: "drugs", label: "Drug Database", icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4.5 12.5l7-7a4.95 4.95 0 017 7l-7 7a4.95 4.95 0 01-7-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l8-8" />
    </svg>
  )},
  { id: "users", label: "Users", icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )},
  { id: "roles", label: "Roles", icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )},
];

const PAGE_SIZE = 10;

export default function MasterDataPage({user}) {
  const [tab,     setTab]     = useState("drugs");
  const [search,  setSearch]  = useState("");
  const [page,    setPage]    = useState(1);
  const [drugs,   setDrugs]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  //user states variables

  const [users, setUsers]             = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError]     = useState(null);
  const [userModal, setUserModal]     = useState(null);
  const [userForm, setUserForm]       = useState({username: "", password: "", role: "pharmacist"});
  const [userModalLoading, setUserModalLoading]   = useState(false);
  const [userModalError, setUserModalError]       = useState(null);




  // Modal state: null | { type: "add" | "edit" | "remove", drug?: { id, name } }
  const [modal,        setModal]        = useState(null);
  const [modalName,    setModalName]    = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError,   setModalError]   = useState(null);
  const inputRef = useRef(null);



  useEffect(() => {
    if (tab !== "users") return;
    setUserLoading(true);
    setUserError(null);
    getUsers()
    .then(data => setUsers(data.users || []))
    .catch(err => setUserError(err.message))
    .finally(() => setUserLoading(false));
  }, [tab]);

  // Fetch real drug data from medicine_db.csv via the backend
  useEffect(() => {
    if (tab !== "drugs") return;
    setLoading(true);
    setError(null);
    getDrugDatabase()
      .then(data => setDrugs(data.drugs || []))
      .catch(err  => setError(err.message))
      .finally(() => setLoading(false));
  }, [tab]);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (modal && modal.type !== "remove") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [modal]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return drugs.filter(d => !q || d.name.toLowerCase().includes(q));
  }, [drugs, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Modal helpers ────────────────────────────────────────────────────────────

  const openAdd    = ()     => { setModal({ type: "add" });           setModalName("");          setModalError(null); };
  const openEdit   = (drug) => { setModal({ type: "edit",   drug });  setModalName(drug.name);  setModalError(null); };
  const openRemove = (drug) => { setModal({ type: "remove", drug });  setModalError(null); };
  const closeModal = ()     => { setModal(null); setModalLoading(false); setModalError(null); };

  const openAddUser    = ()     => { setUserModal({ type: "add" });          setUserForm({ username: "", password: "", role: "pharmacist" }); setUserModalError(null); };
  const openEditUser   = (user) => { setUserModal({ type: "edit", user });   setUserForm({ username: user.username, password: "", role: user.role }); setUserModalError(null); };
  const openRemoveUser = (user) => { setUserModal({ type: "remove", user }); setUserModalError(null); };
  const closeUserModal = ()     => { setUserModal(null); setUserModalLoading(false); setUserModalError(null); };

  const handleAddUser = async () => {
    if (!userForm.username.trim() || !userForm.password.trim()) return;
    setUserModalLoading(true);
    setUserModalError(null);
    try {
      await createUser(userForm.username.trim(), userForm.password, userForm.role);
      const data = await getUsers();
      setUsers(data.users || []);
      closeUserModal();
    } catch (err) {
      setUserModalError(err.message);
      setUserModalLoading(false);
    }
  };

  const handleEditUser = async () => {
    if (!userForm.username.trim()) return;
    setUserModalLoading(true);
    setUserModalError(null);
    try {
      await updateUser(userModal.user.id, userForm.username.trim(), userForm.role, userForm.password);
      setUsers(prev => prev.map(u => u.id === userModal.user.id
        ? { ...u, username: userForm.username.trim(), role: userForm.role }
        : u
      ));
      closeUserModal();
    } catch (err) {
      setUserModalError(err.message);
      setUserModalLoading(false);
    }
  };

  const handleRemoveUser = async () => {
    setUserModalLoading(true);
    setUserModalError(null);
    try {
      await deleteUser(userModal.user.id);
      setUsers(prev => prev.filter(u => u.id !== userModal.user.id));
      closeUserModal();
    } catch (err) {
      setUserModalError(err.message);
      setUserModalLoading(false);
    }
  };

  
  const handleAdd = async () => {
    if (!modalName.trim()) return;
    setModalLoading(true);
    setModalError(null);
    try {
      const data = await addDrug(modalName.trim());
      setDrugs(data.drugs || []);
      closeModal();
    } catch (err) {
      setModalError(err.message);
      setModalLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!modalName.trim()) return;
    setModalLoading(true);
    setModalError(null);
    try {
      const data = await updateDrug(modal.drug.id, modalName.trim());
      setDrugs(data.drugs || []);
      closeModal();
    } catch (err) {
      setModalError(err.message);
      setModalLoading(false);
    }
  };

  const handleRemove = async () => {
    setModalLoading(true);
    setModalError(null);
    try {
      const data = await deleteDrug(modal.drug.id);
      setDrugs(data.drugs || []);
      closeModal();
    } catch (err) {
      setModalError(err.message);
      setModalLoading(false);
    }
  };

  // Submit on Enter key inside the name input
  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      if (modal?.type === "add")  handleAdd();
      if (modal?.type === "edit") handleEdit();
    }
    if (e.key === "Escape") closeModal();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Master Data</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage drugs, users, and roles</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
       {TABS.filter(({id}) => id === "drugs" || user?.role === "admin").map(({id,label,icon}) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
                        ${tab === id
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* Drug tab */}
      {tab === "drugs" && (
        <div className="space-y-4">
          {/* Search + action row */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by drug name…"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl
                           bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                         font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Drug
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="text-sm">Loading drug database…</span>
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-16 text-red-400 gap-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm font-medium">Could not load drug database</p>
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {/* Empty — no results */}
            {!loading && !error && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2
                       M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">
                  {drugs.length === 0 ? "No drugs in database" : "No drugs match your search"}
                </p>
              </div>
            )}

            {/* Data table */}
            {!loading && !error && filtered.length > 0 && (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {["#", "Drug Name", ""].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold
                                                text-slate-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {slice.map((drug, idx) => (
                      <tr key={drug.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 text-xs text-slate-400 font-mono w-12">
                          {(currentPage - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-700">{drug.name}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(drug)}
                              className="text-xs text-slate-500 hover:text-blue-600 font-medium
                                         border border-slate-200 px-2.5 py-1 rounded-lg
                                         hover:border-blue-300 transition-all"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openRemove(drug)}
                              className="text-xs font-medium border px-2.5 py-1 rounded-lg
                                         transition-all text-red-500 border-red-200 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100
                                text-sm text-slate-500">
                  <span className="text-xs">
                    Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} drugs
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
                        if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === "…" ? (
                          <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-xs text-slate-400">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`w-8 py-1.5 rounded-lg border text-xs font-medium transition-colors
                                        ${currentPage === p
                                          ? "bg-blue-600 border-blue-600 text-white"
                                          : "border-slate-200 hover:bg-slate-50"}`}
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
        </div>
      )}

    {/* Users tab */}
    {tab === "users" && (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={openAddUser}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                      font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {userLoading && (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              <span className="text-sm">Loading users…</span>
            </div>
          )}

          {!userLoading && userError && (
            <div className="flex flex-col items-center justify-center py-16 text-red-400 gap-2">
              <p className="text-sm font-medium">Could not load users</p>
              <p className="text-xs text-red-300">{userError}</p>
            </div>
          )}

          {!userLoading && !userError && users.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <p className="text-sm">No users found</p>
            </div>
          )}

          {!userLoading && !userError && users.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["#", "Username", "Role", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold
                                            text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user, idx) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-slate-400 font-mono w-12">{idx + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">{user.username}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full
                        ${user.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : user.role === "viwer"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditUser(user)}
                          className="text-xs text-slate-500 hover:text-blue-600 font-medium
                                    border border-slate-200 px-2.5 py-1 rounded-lg
                                    hover:border-blue-300 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openRemoveUser(user)}
                          className="text-xs font-medium border px-2.5 py-1 rounded-lg
                                    transition-all text-red-500 border-red-200 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )}

      {/* Roles tab */}
      {tab === "roles" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["#", "Role", "Dashboard", "Scan", "History", "Master Data", "Setup"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold
                                          text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { name: "Administrator", dashboard: true,  scan: true,  history: true,  master: true,  setup: true },
                { name: "Pharmacist",    dashboard: true,  scan: true,  history: true,  master: true, setup: false },
                { name: "Viewer",        dashboard: true,  scan: false, history: true,  master: false, setup: false },
              ].map((role, i) => (
                <tr key={role.name} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">{i + 1}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-700">{role.name}</td>
                  {["dashboard", "scan", "history", "master", "setup"].map(perm => (
                    <td key={perm} className="px-5 py-3.5">
                      {role[perm]
                        ? <span className="text-green-500">✓</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && closeModal()}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">

            {/* Add / Edit */}
            {(modal.type === "add" || modal.type === "edit") && (
              <>
                <h3 className="text-base font-bold text-slate-800 mb-4">
                  {modal.type === "add" ? "Add Drug" : "Edit Drug"}
                </h3>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Drug Name
                </label>
                <input
                  ref={inputRef}
                  value={modalName}
                  onChange={e => { setModalName(e.target.value); setModalError(null); }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="e.g. Atenolol"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                             text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                {modalError && (
                  <p className="text-xs text-red-500 mb-3">{modalError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                               font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={modal.type === "add" ? handleAdd : handleEdit}
                    disabled={modalLoading || !modalName.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                               bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                               transition-colors disabled:opacity-50"
                  >
                    {modalLoading && (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                      </svg>
                    )}
                    {modal.type === "add" ? "Add" : "Save"}
                  </button>
                </div>
              </>
            )}

            {/* Remove confirmation */}
            {modal.type === "remove" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Remove Drug</h3>
                    <p className="text-xs text-slate-400">This cannot be undone</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Remove <span className="font-semibold text-slate-800">{modal.drug.name}</span> from the database?
                </p>
                {modalError && (
                  <p className="text-xs text-red-500 mb-3">{modalError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                               font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={modalLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                               bg-red-500 hover:bg-red-600 text-white text-sm font-semibold
                               transition-colors disabled:opacity-50"
                  >
                    {modalLoading && (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                      </svg>
                    )}
                    Remove
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* User Modal */}
      {userModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && closeUserModal()}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">

            {/* Add / Edit */}
            {(userModal.type === "add" || userModal.type === "edit") && (
              <>
                <h3 className="text-base font-bold text-slate-800 mb-4">
                  {userModal.type === "add" ? "Add User" : "Edit User"}
                </h3>

                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <input
                  value={userForm.username}
                  onChange={e => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="e.g. john"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                             text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                />

                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  {userModal.type === "edit" ? "New Password (leave blank to keep current)" : "Password"}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={e => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                             text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                />

                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Role
                </label>
                <select
                  value={userForm.role}
                  onChange={e => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                             text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                >
                  <option value="pharmacist">Pharmacist</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>

                {userModalError && (
                  <p className="text-xs text-red-500 mb-3">{userModalError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={closeUserModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                               font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={userModal.type === "add" ? handleAddUser : handleEditUser}
                    disabled={userModalLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                               bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                               transition-colors disabled:opacity-50"
                  >
                    {userModalLoading && (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                      </svg>
                    )}
                    {userModal.type === "add" ? "Add" : "Save"}
                  </button>
                </div>
              </>
            )}

            {/* Remove confirmation */}
            {userModal.type === "remove" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Remove User</h3>
                    <p className="text-xs text-slate-400">This cannot be undone</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Remove <span className="font-semibold text-slate-800">{userModal.user.username}</span>?
                </p>
                {userModalError && (
                  <p className="text-xs text-red-500 mb-3">{userModalError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={closeUserModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                               font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRemoveUser}
                    disabled={userModalLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                               bg-red-500 hover:bg-red-600 text-white text-sm font-semibold
                               transition-colors disabled:opacity-50"
                  >
                    {userModalLoading && (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                      </svg>
                    )}
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
