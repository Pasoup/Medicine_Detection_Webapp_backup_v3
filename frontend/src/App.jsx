import { useState, useCallback, useRef, useEffect } from "react";
import Navbar from "./components/Navbar";
import CameraSection from "./components/CameraSection";
import ExpectedMedicines from "./components/ExpectedMedicines";
import ScanHistory from "./components/ScanHistory";
import HowToUse from "./components/HowToUse";
import ResultPopup from "./components/ResultPopup";
import HistoryDetailPopup from "./components/HistoryDetailPopup";

export default function App() {
  const [scanResults,   setScanResults]   = useState(null);
  const [summary,       setSummary]       = useState({ matched: 0, missing: 0, extra: 0, review: 0 });
  const [history,       setHistory]       = useState([]);
  const [expected,      setExpected]      = useState([]);
  const [isScanning,    setIsScanning]    = useState(false);
  const [annotatedImg,  setAnnotatedImg]  = useState(null);
  const [showPopup,     setShowPopup]     = useState(false);
  const [popupData,     setPopupData]     = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);

 
  const sessionResults   = useRef([]);   
  const sessionStart     = useRef(null);
  const sessionAnnotated = useRef(null);

  const resetSession = useCallback(() => {
    sessionResults.current   = [];
    sessionStart.current     = null;
    sessionAnnotated.current = null;
  }, []);


  const handleScanComplete = useCallback((data) => {
    setIsScanning(false);

    if (!sessionStart.current) sessionStart.current = data.timestamp;
    sessionAnnotated.current = data.annotated_b64;

    // Build expected quantity map
    const expectedMap = {};
    for (const e of expected) {
      const n = (typeof e === "string" ? e : e.name).toUpperCase();
      const q = typeof e === "string" ? 1 : (e.quantity || 1);
      expectedMap[n] = (expectedMap[n] || 0) + q;
    }


    const scanStamp = Date.now();
    for (const r of data.results) {
      if (r.scan_status === "MISSING") continue;
      sessionResults.current.push({
        ...r,
        session_box_id: `${scanStamp}-${r.box_id}`,
      });
    }

  
    const allFoundCounts = {};
    for (const r of sessionResults.current) {
      const n = r.final_name?.toUpperCase();
      if (n && n !== "UNKNOWN" && n !== "PENDING_REVIEW") {
        allFoundCounts[n] = (allFoundCounts[n] || 0) + 1;
      }
    }


    const nameCountSoFar = {};
    const restatused = sessionResults.current.map(r => {
      const n = r.final_name?.toUpperCase();
      if (!n || n === "UNKNOWN" || n === "PENDING_REVIEW") return r;
      nameCountSoFar[n] = (nameCountSoFar[n] || 0) + 1;
      const scan_status = nameCountSoFar[n] <= (expectedMap[n] || 0)
        ? "MATCHED" : "EXTRA";
      return { ...r, scan_status };
    });
    sessionResults.current = restatused;

    const missingResults = [];
    for (const [name, qtyNeeded] of Object.entries(expectedMap)) {
      const qtyFound   = Math.min(allFoundCounts[name] || 0, qtyNeeded);
      const qtyMissing = qtyNeeded - qtyFound;
      // Create one entry PER missing unit — so 3 missing Sefloc = 3 list items.
      // This keeps the count, the list length, and the summary number all consistent.
      for (let i = 0; i < qtyMissing; i++) {
        missingResults.push({
          box_id:          null,
          bbox:            null,
          final_name:      name,
          confidence:      "NONE",
          layer4_note:     `Expected ${qtyNeeded}× — found ${qtyFound} so far`,
          status:          "❌ Not detected",
          scan_status:     "MISSING",
          ocr_raw:         "",
          qr_name:         null,
          reference_image: data.results.find(
            r => r.final_name?.toUpperCase() === name && r.reference_image
          )?.reference_image || null,
          qty_expected:    qtyNeeded,
          qty_found:       qtyFound,
          qty_missing:     qtyMissing,
          unit_index:      i + 1,   // which unit this entry represents (1 of 3, 2 of 3, etc.)
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
      success,
      missing: missingResults,
      extra:   restatused.filter(r => r.scan_status === "EXTRA"),
      review:  restatused.filter(r => r.scan_status === "PENDING_REVIEW"),
      unknown: restatused.filter(r => r.scan_status === "UNKNOWN"),
      summary: mergedSummary,
      rawData: { ...data, results: mergedResults, summary: mergedSummary },
    });
    setShowPopup(true);
  }, [expected]);

  // ── Continue Scan — dismiss popup, keep session running ───────────────────
  const handleContinueScan = useCallback(() => {
    setShowPopup(false);
    // Don't clear popupData yet — session is still active
    // The camera is still live, user can scan again immediately
  }, []);

  // ── Close & Review — finalise session, push to history ───────────────────
  const handleCloseAndReview = useCallback(() => {
    if (popupData && popupData.rawData) {
      const data    = popupData.rawData;
      const allGood = popupData.missing.length === 0
                   && popupData.extra.length   === 0
                   && popupData.review.length  === 0
                   && popupData.unknown.length === 0;

      setHistory(prev => [{
        id:        Date.now(),
        timestamp: sessionStart.current || data.timestamp,
        matched:   data.summary.matched,
        missing:   data.summary.missing,
        extra:     data.summary.extra,
        review:    data.summary.review,
        unknown:   data.summary.unknown || 0,
        summary:   allGood
                     ? `All verified (${data.summary.matched} matched)`
                     : data.results.find(r => r.scan_status === "MATCHED")?.final_name || "No match",
        results:   data.results,
        annotated: sessionAnnotated.current || data.annotated_b64,
      }, ...prev].slice(0, 20));
    }

    resetSession();
    setShowPopup(false);
    setPopupData(null);
  }, [popupData, resetSession]);

  // ── Complete — save current session to history and clear without scanning ──
  const handleComplete = useCallback(() => {
    if (expected.length === 0 && sessionResults.current.length === 0) return;

    const now = new Date().toISOString();
    const allGood = summary.missing === 0
                 && summary.extra    === 0
                 && summary.review   === 0
                 && summary.unknown  === 0;

    setHistory(prev => [{
      id:        Date.now(),
      timestamp: sessionStart.current || now,
      matched:   summary.matched,
      missing:   summary.missing,
      extra:     summary.extra,
      review:    summary.review  || 0,
      unknown:   summary.unknown || 0,
      summary:   allGood
                   ? `All verified (${summary.matched} matched)`
                   : scanResults?.find(r => r.scan_status === "MATCHED")?.final_name || "Manual complete",
      results:   scanResults || [],
      annotated: sessionAnnotated.current || null,
    }, ...prev].slice(0, 20));

    // Clear everything
    resetSession();
    setExpected([]);
    setScanResults(null);
    setSummary({ matched: 0, missing: 0, extra: 0, review: 0, unknown: 0 });
  }, [expected, summary, scanResults, resetSession]);

  // F5 = Complete & Save — preventDefault stops browser page refresh
  useEffect(() => {
    const handler = (e) => {
      if (e.code === "F5") {
        e.preventDefault();
        handleComplete();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleComplete]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />

      <main className="max-w-8xl mx-auto px-1 py-6 space-y-9">
        {/* ── 12-column grid: sidebars col-span-2, camera col-span-8 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-stretch">

          <div className="lg:col-span-2">
            <ExpectedMedicines
              expected={expected}
              setExpected={setExpected}
              scanResults={scanResults}
              summary={summary}
              onListChanged={() => {
                setScanResults(null);
                setSummary({ matched: 0, missing: 0, extra: 0, review: 0 });
                resetSession();
              }}
            />
          </div>

          <div className="lg:col-span-6">
            <CameraSection
              expected={expected}
              scanResults={scanResults}
              annotatedImg={annotatedImg}
              isScanning={isScanning}
              setIsScanning={setIsScanning}
              onScanComplete={handleScanComplete}
              summary={summary}
            />
          </div>

          <div className="lg:col-span-2">
            <ScanHistory
              history={history}
              onSelect={setHistoryDetail}
            />
          </div>
        </div>
        
        {/* Complete button — save session to history without requiring a final scan */}
        {(expected.length > 0 || (scanResults && scanResults.length > 0)) && (
          <div className="flex justify-center">
            <button
              onClick={handleComplete}
              disabled={isScanning}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700
                         disabled:bg-slate-300 text-white font-semibold px-8 py-3
                         rounded-2xl shadow-sm hover:shadow-md transition-all text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5 13l4 4L19 7" />
              </svg>
              Complete &amp; Save to History
              <span className="text-xs font-mono bg-white/20 px-1.5 py-0.5 rounded">F5</span>
            </button>
          </div>
        )}

        <HowToUse />
      </main>

      {showPopup && popupData && (
        <ResultPopup
          data={popupData}
          onClose={handleCloseAndReview}
          continueScan={handleContinueScan}
          onClearData={() => {
            setExpected([]);
            setScanResults(null);
            setSummary({ matched: 0, missing: 0, extra: 0, review: 0 });
          }}
        />
      )}

      {historyDetail && (
        <HistoryDetailPopup
          item={historyDetail}
          onClose={() => setHistoryDetail(null)}
        />
      )}
    </div>
  );
}