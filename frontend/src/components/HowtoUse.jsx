export default function HowToUse() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-6 py-5
                    flex items-start gap-4">
      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">How to use MedVerify</h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          Enter the expected medicine name and click <strong>Load Data</strong>, or import a{" "}
          <strong>.txt file</strong> with one medicine per line. Position your medicine boxes within
          the camera frame, then click <strong>SCAN</strong>. Results will show which medicines are
          matched, missing, or unexpected. A popup will confirm success or list what's wrong.
        </p>
      </div>
    </div>
  );
}