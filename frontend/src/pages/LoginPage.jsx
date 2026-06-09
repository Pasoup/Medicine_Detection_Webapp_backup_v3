import { useState, useRef } from "react";
import medsureLogo from '../assets/medsure.jpg';



export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const passwordRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    fetch("http://localhost:8000/auth/login",
    {
      method: "POST",
      headers : {"Content-Type" : "application/json"},
      body: JSON.stringify({username,password})
    }).then(res => {
      if (!res.ok) throw new Error("invalid credentials")
      return res.json()  
    })
    .then(data => {
      setLoading(false)
      console.log( "acess tokensssss: "+ data.access_token)
      localStorage.setItem("access_token", data.access_token)
      const payload = JSON.parse(atob(data.access_token.split(".")[1]))
      onLogin({username : payload.sub, role: payload.role})
    })
    .catch(err => {
      setLoading(false)
      setError("Failed to login")
    })
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo / branding */}
        <div className="text-center mb-8">
              <div className="w-13 h-24">
                <img src={medsureLogo} alt="MedSure" className="w-full h-full object-contain object-center" />
              </div>
          <p className="text-sm text-slate-500 mt-1">Pharmacy Verification System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-base font-semibold text-slate-700 mb-6">Sign in to continue</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500
                                uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(""); }}
                autoFocus
                autoComplete="username"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); passwordRef.current?.focus(); } }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                           text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:border-transparent transition-all"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500
                                uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                ref={passwordRef}
                autoComplete="current-password"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm
                           text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:border-transparent transition-all"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50
                              border border-red-100 rounded-xl px-3 py-2.5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200
                         disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl
                         text-sm transition-all shadow-sm hover:shadow-md mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white
                                   rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          MedCheckPro · Hospital Pharmacy System
        </p>
      </div>
    </div>
  );
}
