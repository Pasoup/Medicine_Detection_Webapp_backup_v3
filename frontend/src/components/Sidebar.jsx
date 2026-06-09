import medsureLogo from '../assets/medsure.jpg';

const NAV = [
  {
    section: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard',allowedRoles: ['admin', 'pharmacist','Viewer'], icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )},
    ],
  },

  {
    section: 'VERIFY',
    items: [
      { id: 'scan', label: 'Scan',allowedRoles: ['admin','pharmacist'], icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )},
      { id: 'history', label: 'History', allowedRoles: ['admin','pharmacist','Viewer'], icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )},
    ],
  },
  {
    section: 'MANAGE',
    items: [
      { id: 'master', label: 'Master Data',allowedRoles: ['admin','pharmacist'], icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      )},
      { id: 'setup', label: 'Setup',allowedRoles: ['admin','pharmacist'], icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )},
    ],
  },
];

export default function Sidebar({ currentPage, onNavigate, historyCount = 0, user, onSignOut }) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-white border-r border-slate-200
                      flex flex-col z-40 shadow-sm">

      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-slate-100 shrink-0">
        <div className="w-28 h-9">
          <img src={medsureLogo} alt="MedSure" className="w-full h-full object-contain object-left" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV.map(({ section, items }) => {
          const visibleItems = items.filter(({ allowedRoles }) => allowedRoles.includes(user?.role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section ?? '__top'} className="mb-1">
              {section && (
                <p className="px-5 mb-1 mt-3 text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                  {section}
                </p>
              )}
              {visibleItems.map(({ id, label, icon }) => {
                const active = currentPage === id;
                return (
                  <button
                    key={id}
                    onClick={() => onNavigate(id)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium
                                border-l-2 transition-all
                                ${active
                                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                                  : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                  >
                    <span className={active ? 'text-blue-600' : 'text-slate-400'}>{icon}</span>
                    <span>{label}</span>
                    {id === 'history' && historyCount > 0 && (
                      <span className="ml-auto bg-blue-100 text-blue-600 text-xs font-bold
                                       px-2 py-0.5 rounded-full">
                        {historyCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-100 shrink-0 space-y-3">
        {user && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-700">{user.username}</p>
              <p className="text-[10px] font-semibold bg-green-100 text-green-600 
                            px-2 py-0.5 rounded-full inline-block mt-0.5">
                {user.role}
              </p>
            </div>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1 text-slate-400 hover:text-red-500
                         transition-colors text-xs font-medium"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7
                     a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-400">MedCheckPro</p>
          <p className="text-[10px] text-slate-300 mt-0.5">v3.0 · Drug Verification System</p>
        </div>
      </div>
    </aside>
  );
}
