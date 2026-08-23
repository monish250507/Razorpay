import React from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, ExternalLink, HelpCircle } from 'lucide-react';

export default function TrustInspector({ result, isProcessing, onOpenRazorpayModal }) {
  if (isProcessing) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-slate-800 flex flex-col items-center justify-center text-center h-full min-h-[350px]">
        <div className="w-16 h-16 relative mb-6">
          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
        <h3 className="text-base font-bold text-white mb-2 animate-pulse">Evaluating Trust Matrix...</h3>
        <div className="flex flex-col gap-3 w-full max-w-sm mt-4 text-left">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
            <span className="font-medium">Layer 1: Parsing Canonical Intent</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]" style={{animationDelay: '150ms'}}></div>
            <span className="font-medium">Layer 2: Validating ECDSA Cryptography</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" style={{animationDelay: '300ms'}}></div>
            <span className="font-medium">Layer 3: Computing SHAP Risk Heuristics</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
            <span className="font-medium">Layer 4: Awaiting Deterministic Verdict...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-slate-800 flex flex-col items-center justify-center text-center h-full min-h-[350px]">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 animate-bounce">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-200">Trust & Verification Gateway Standby</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Select a preset scenario on top or trigger an intent from the Nova AI simulator on the left to evaluate agent trust in real-time.
        </p>
      </div>
    );
  }

  const { verification, canonicalIntent, execution, fallback } = result;
  const isApproved = verification?.decision === 'APPROVED';
  const trustScore = verification?.trustScore ?? 0;

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col h-full space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${isApproved ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/20 border border-rose-500/30 text-rose-400'} flex items-center justify-center`}>
            {isApproved ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Layer 3: Trust & Mandate Verification Engine
            </h2>
            <p className="text-[11px] text-slate-400">Zero-Trust Agent Gating & Feature-Attribution Inspector</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
            isApproved 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 glow-emerald'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30 glow-rose'
          }`}>
            {verification?.decision}
          </span>
        </div>
      </div>

      {/* Trust Score & Key Checks Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Trust Score Gauge Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
            Agent Trust Score
          </span>
          <div className="relative flex items-center justify-center my-1">
            <div className={`text-3xl font-extrabold font-mono tracking-tight ${
              trustScore >= 70 ? 'text-emerald-400' : trustScore >= 40 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {trustScore}
              <span className="text-xs font-normal text-slate-400">/100</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-400">
            {trustScore >= 70 ? 'High Confidence (Pass)' : trustScore >= 40 ? 'Moderate Risk' : 'High Risk (Blocked)'}
          </span>
        </div>

        {/* Spend Mandate Gating Check */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300">Mandate Spend Limit</span>
            {verification?.isBounded ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className="my-1">
            <div className="text-xs text-slate-400">Cart: <span className="font-semibold text-white">₹{canonicalIntent?.totalAmount}</span></div>
            <div className="text-xs text-slate-400">Cap: <span className="font-semibold text-blue-400">₹{canonicalIntent?.mandate?.maxAmount}</span></div>
          </div>
          <span className={`text-[10px] font-medium ${verification?.isBounded ? 'text-emerald-400' : 'text-rose-400'}`}>
            {verification?.isBounded ? '✓ Within Limit' : '✕ Over Spend Limit'}
          </span>
        </div>

        {/* Cryptographic Signature Check */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300">Crypto Signature</span>
            {verification?.isSignatureValid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className="my-1 font-mono text-[10px] text-slate-400 truncate">
            {canonicalIntent?.mandate?.signature}
          </div>
          <span className={`text-[10px] font-medium ${verification?.isSignatureValid ? 'text-emerald-400' : 'text-rose-400'}`}>
            {verification?.isSignatureValid ? '✓ Verified ECDSA Token' : '✕ Forged / Tampered'}
          </span>
        </div>
      </div>

      {/* SHAP Feature Attribution Breakdown */}
      <div>
        <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
          <span>SHAP Feature-Attribution Risk Breakdown</span>
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
        </h3>
        <div className="space-y-2">
          {(verification?.featureAttributions || []).map((fa, index) => {
            const isFail = fa.status === 'FAIL';
            const isWarn = fa.status === 'WARN';

            return (
              <div key={index} className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {isFail ? (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : isWarn ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-200 block truncate">{fa.feature}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{fa.details}</span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                  isFail ? 'bg-rose-500/20 text-rose-300' : isWarn ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {fa.impact}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plain-Language Explanation */}
      <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Plain-Language Merchant Reasoning Summary
        </h4>
        <p className="text-xs text-slate-200 leading-relaxed font-mono">
          "{verification?.explanation}"
        </p>
      </div>

      {/* Action: Open Razorpay Order / Payment Link */}
      {isApproved && execution && (
        <div className="pt-2">
          <button
            onClick={() => onOpenRazorpayModal(execution)}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Preview Generated Razorpay Order & Payment Link ({execution.orderId})</span>
          </button>
        </div>
      )}

      {!isApproved && fallback?.fallbackPaymentLink && (
        <div className="pt-2">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
            <span className="font-semibold block mb-1">🛡️ Graceful Failure Fallback Active</span>
            <p className="text-[11px] text-slate-300">
              Agent direct execution was blocked. To prevent lost merchant revenue, AEGIS RAIL generated a standard human Payment Link:
            </p>
            <a
              href={fallback.fallbackPaymentLink}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-blue-400 underline font-mono text-[11px]"
            >
              {fallback.fallbackPaymentLink} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

    </div>
  );
}
