import { useState, useCallback, useRef, useEffect } from "react";

import Sidebar            from "./components/Sidebar";
import ResultPopup        from "./components/ResultPopup";
import HistoryDetailPopup from "./components/HistoryDetailPopup";

import LoginPage      from "./pages/LoginPage";
import ScanPage       from "./pages/ScanPage";
import HistoryPage    from "./pages/HistoryPage";
import DashboardPage  from "./pages/DashboardPage";
import MasterDataPage from "./pages/MasterDataPage";
import SetupPage      from "./pages/SetupPage";

import { saveHistory, getHistory, getHistoryDetail} from "./api";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  scan:      "Scan Medicines",
  history:   "Scan History",
  code:      "Medicine Code",
  master:    "Master Data",
  setup:     "Setup",
};

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if(token)
    {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUser({username: payload.sub, role: payload.role});

    }
  },[]);
// --- TIMER ──────────────────────────────────────────────────────────────────
  const idleTimerRef = useRef(null)

  useEffect(() => {
   const resetTimer = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        localStorage.removeItem("access_token");
        setUser(null);
      },30 * 60 * 1000)
   }; 
   window.addEventListener("mousemove", resetTimer)
   window.addEventListener("keydown", resetTimer)
   resetTimer()
    return () => {
      clearTimeout(idleTimerRef.current);
      window.removeEventListener("mousemove", resetTimer)
      window.removeEventListener("keydown", resetTimer)
    };

  }, []);


  // ── Navigation ────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState("dashboard");

  // ── Scan state ────────────────────────────────────────────────────────────
  const [scanResults,   setScanResults]  = useState(null);
  const [summary,       setSummary]      = useState({ matched: 0, missing: 0, extra: 0, review: 0, unknown: 0 });
  const [history,       setHistory]      = useState([]);
  const [expected,      setExpected]     = useState([]);
  const [isScanning,    setIsScanning]   = useState(false);
  const [annotatedImg,  setAnnotatedImg] = useState(null);
  const [showPopup,     setShowPopup]    = useState(false);
  const [popupData,     setPopupData]    = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);

  const sessionResults   = useRef([]);
  const sessionStart     = useRef(null);
  const sessionAnnotated = useRef(null);

  const resetSession = useCallback(() => {
    sessionResults.current   = [];
    sessionStart.current     = null;
    sessionAnnotated.current = null;
  }, []);

  // ── Scan complete ─────────────────────────────────────────────────────────
  const handleScanComplete = useCallback((data) => {
    setIsScanning(false);
    if (!sessionStart.current) sessionStart.current = data.timestamp;
    sessionAnnotated.current = data.annotated_b64;

    const expectedMap = {};
    console.log("backend results:", data.results);
    for (const e of expected) {
      const n = (typeof e === "string" ? e : e.name).toUpperCase();
      const q = typeof e === "string" ? 1 : (e.quantity || 1);
      expectedMap[n] = (expectedMap[n] || 0) + q;
    }

    const scanStamp = Date.now();
    for (const r of data.results) {
      if (r.scan_status === "MISSING") continue;
      sessionResults.current.push({ ...r, session_box_id: `${scanStamp}-${r.box_id}` });
    }

    const allFoundCounts = {};
    for (const r of sessionResults.current) {
      const n = r.final_name?.toUpperCase();
      if (n && n !== "UNKNOWN" && n !== "PENDING_REVIEW")
        allFoundCounts[n] = (allFoundCounts[n] || 0) + 1;
    }

    const nameCountSoFar = {};
    const restatused = sessionResults.current.map(r => {
      const n = r.final_name?.toUpperCase();
      if (!n || n === "UNKNOWN" || n === "PENDING_REVIEW") return r;
      nameCountSoFar[n] = (nameCountSoFar[n] || 0) + 1;
      const scan_status = nameCountSoFar[n] <= (expectedMap[n] || 0) ? "MATCHED" : "EXTRA";
      return { ...r, scan_status };
    });
    sessionResults.current = restatused;

    const missingResults = [];
    for (const [name, qtyNeeded] of Object.entries(expectedMap)) {
      const qtyFound   = Math.min(allFoundCounts[name] || 0, qtyNeeded);
      const qtyMissing = qtyNeeded - qtyFound;
      for (let i = 0; i < qtyMissing; i++) {
        missingResults.push({
          box_id: null, bbox: null, final_name: name,
          confidence: "NONE", layer4_note: `Expected ${qtyNeeded}× — found ${qtyFound} so far`,
          status: "❌ Not detected", scan_status: "MISSING",
          ocr_raw: "", qr_name: null,
          reference_image: data.results.find(
            r => r.final_name?.toUpperCase() === name && r.scan_status === "MISSING"
          )?.reference_image || null,
          qty_expected: qtyNeeded, qty_found: qtyFound,
          qty_missing: qtyMissing, unit_index: i + 1,
        });
      }
    }

    const mergedResults = [...restatused, ...missingResults];
    const mergedSummary = {
      matched: restatused.filter(r => r.scan_status === "MATCHED").length,
      missing: missingResults.length,
      extra:   restatused.filter(r => r.scan_status === "EXTRA").length,
      review:  restatused.filter(r => r.scan_status === "PENDING_REVIEW").length,
      unknown: restatused.filter(r => r.scan_status === "UNKNOWN").length,
    };

    const success = missingResults.length === 0
                 && mergedSummary.extra   === 0
                 && mergedSummary.review  === 0
                 && mergedSummary.unknown === 0;

    setScanResults(mergedResults);
    setSummary(mergedSummary);
    setAnnotatedImg(data.annotated_b64);
    setPopupData({
      success, missing: missingResults,
      extra:   restatused.filter(r => r.scan_status === "EXTRA"),
      review:  restatused.filter(r => r.scan_status === "PENDING_REVIEW"),
      unknown: restatused.filter(r => r.scan_status === "UNKNOWN"),
      summary: mergedSummary,
      rawData: { ...data, results: mergedResults, summary: mergedSummary },
    });
    setShowPopup(true);
  }, [expected]);

  // ── Continue scan ─────────────────────────────────────────────────────────
  const handleContinueScan = useCallback(() => setShowPopup(false), []);

  // ── Close & review — push to history ─────────────────────────────────────
  const handleCloseAndReview = useCallback(() => {
    if (popupData?.rawData) {
        const data = popupData.rawData;
        const entry = {
            timestamp:  sessionStart.current || data.timestamp,
            scanned_by: user?.username || "—",
            location:   localStorage.getItem("hospital_name" || ""),
            matched:    data.summary.matched,
            missing:    data.summary.missing,
            extra:      data.summary.extra,
            review:     data.summary.review,
            unknown:    data.summary.unknown || 0,
            annotated:  sessionAnnotated.current || data.annotated_b64,
            results:    data.results.map(r => ({
                box_id:          r.box_id?.toString() || null,
                final_name:      r.final_name,
                scan_status:     r.scan_status,
                confidence:      r.confidence,
                ocr_raw:         r.ocr_raw,
                qr_name:         r.qr_name,
                reference_image: r.reference_image || null,
            })),
        };
        saveHistory(entry).then(saved => {
            setHistory(prev => [{ ...entry, id: saved.id }, ...prev]);
        });
    }
    resetSession();
    setScanResults(null);
    setShowPopup(false);
    setPopupData(null);
  }, [popupData, resetSession]);

  // ── Complete — finalise session manually ──────────────────────────────────
  const handleComplete = useCallback(() => {
    if (expected.length === 0 && sessionResults.current.length === 0) return;
    const now     = new Date().toISOString();
    const allGood = summary.missing === 0 && summary.extra === 0
                 && summary.review  === 0 && summary.unknown === 0;
    const entry = {
        timestamp:  sessionStart.current || now,
        scanned_by: user?.username || "—",
        location:   localStorage.getItem("hospital_name") || "",
        matched:    summary.matched,
         missing:    summary.missing,
        extra:      summary.extra,
        review:     summary.review  || 0,
        unknown:    summary.unknown || 0,
        annotated:  sessionAnnotated.current || null,
        results:    (scanResults || []).map(r => ({
            box_id:          r.box_id?.toString() || null,
            final_name:      r.final_name,
            scan_status:     r.scan_status,
            confidence:      r.confidence,
            ocr_raw:         r.ocr_raw,
            qr_name:         r.qr_name,
            reference_image: r.reference_image || null,
        })),
    };
    saveHistory(entry).then(saved => {
        setHistory(prev => [{ ...entry, id: saved.id }, ...prev]);
    });

    resetSession();
    setExpected([]);
    setScanResults(null);
    setSummary({ matched: 0, missing: 0, extra: 0, review: 0, unknown: 0 });
  }, [expected, summary, scanResults, resetSession]);

  useEffect(() => {
    if (!user) return;

    getHistory().then(data => {
      if(data.history) {
        setHistory(data.history);
      }
    });
  }, [user])

  // F5 = Complete & Save
  useEffect(() => {
    const handler = (e) => { if (e.code === "F5") { e.preventDefault(); handleComplete(); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleComplete]);

  // ── Login gate ────────────────────────────────────────────────────────────
  if (!user) return <LoginPage onLogin={setUser} />;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* Fixed sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        historyCount={history.length}
        user={user}
        onSignOut={() =>{
          localStorage.removeItem("access_token")
          setUser(null)
        }}
      />

      {/* Main content — offset by sidebar width (w-56 = 224px) */}
      <div className="flex-1 ml-56 min-h-screen flex flex-col">

        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-14
                           flex items-center justify-between px-6 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">
            {PAGE_TITLES[currentPage] || currentPage}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              System Online
            </span>
            <span className="font-mono">
              {new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {currentPage === "dashboard" && (
            <DashboardPage history={history} onNavigate={setCurrentPage} />
          )}
          {currentPage === "scan" && (
            <ScanPage
              expected={expected}       setExpected={setExpected}
              scanResults={scanResults} setScanResults={setScanResults}
              summary={summary}         setSummary={setSummary}
              annotatedImg={annotatedImg}
              isScanning={isScanning}   setIsScanning={setIsScanning}
              onScanComplete={handleScanComplete}
              onComplete={handleComplete}
              resetSession={resetSession}
            />
          )}
          {currentPage === "history" && (
            <HistoryPage history={history} />
          )}
          {currentPage === "master" && <MasterDataPage user={user}/>}
          {currentPage === "setup"  && <SetupPage />}
        </main>
      </div>

      {/* Popups — rendered outside page flow */}
      {showPopup && popupData && (
        <ResultPopup
          data={popupData}
          onClose={handleCloseAndReview}
          continueScan={handleContinueScan}
          onClearData={() => {
            setExpected([]);
            setScanResults(null);
            setSummary({ matched: 0, missing: 0, extra: 0, review: 0, unknown: 0 });
          }}
        />
      )}
      {historyDetail && (
        <HistoryDetailPopup item={historyDetail} onClose={() => setHistoryDetail(null)} />
      )}
    </div>
  );
}
