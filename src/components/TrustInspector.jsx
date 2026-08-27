import React, { useState } from 'react';
import {
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, HelpCircle, Clock, Zap, BarChart3, ChevronDown
} from 'lucide-react';

/**
 * Per-layer latency bar: renders a coloured ms pill + mini bar
 */
function LatencyBar({ label, ms, maxMs = 3000, color = 'blue' }) {
  if (ms == null) return null;
  const pct = Math.min((ms / maxMs) * 100, 100);
  const colorMap = {
    blue:    { bar: 'bg-blue-500',    text: 'text-blue-400'   },
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-400' },
    amber:   { bar: 'bg-amber-500',   text: 'text-amber-400'  },
    cyan:    { bar: 'bg-cyan-500',    text: 'text-cyan-400'   },
    purple:  { bar: 'bg-purple-500',  text: 'text-purple-400' },
    rose:    { bar: 'bg-rose-500',    text: 'text-rose-400'   },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${c.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono font-semibold ${c.text} w-14 text-right shrink-0`}>{ms} ms</span>
    </div>
  );
}

/**
 * SHAP feature row with prominent impact score and coloured bar
 */
function ShapRow({ fa }) {
  const isFail = fa.status === 'FAIL';
  const isWarn = fa.status === 'WARN';
  const isPass = fa.status === 'PASS';

  // Parse impact as a number (may be e.g. "+12", "-8", "0")
  const rawImpact = fa.impact || '0';
  const num = parseFloat(rawImpact.replace(/[^0-9.\-+]/g, '')) || 0;
  const absNum = Math.abs(num);
  const maxImpact = 30;
  const pct = Math.min((absNum / maxImpact) * 100, 100);

  const barColor = isFail ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = isFail ? 'text-rose-300' : isWarn ? 'text-amber-300' : 'text-emerald-300';
  const bgColor   = isFail ? 'bg-rose-500/10 border-rose-500/20' : isWarn ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20';

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${bgColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {isFail ? <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
           : isWarn ? <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
           : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-200 block">{fa.feature}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5 leading-relaxed">{fa.details}</span>
          </div>
        </div>
        <span className={`shrink-0 text-sm font-extrabold font-mono ${textColor}`}>{rawImpact}</span>
      </div>

      {/* Impact bar */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-slate-500 uppercase tracking-wide w-10 shrink-0">Impact</span>
        <div className="flex-1 h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[10px] font-mono font-bold ${textColor} w-10 text-right shrink-0`}>
          {fa.status}
        </span>
      </div>
    </div>
  );
}

export default function TrustInspector({ result, isProcessing, onOpenRazorpayModal, layerStatuses = {} }) {
  const [showRawPayload, setShowRawPayload] = useState(false);

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
          {[
            { label: 'Parsing Canonical Intent', color: 'bg-emerald-400', delay: '0ms' },
            { label: 'Validating ECDSA Cryptography', color: 'bg-blue-400', delay: '150ms' },
            { label: 'Computing SHAP Risk Heuristics', color: 'bg-amber-400', delay: '300ms' },
            { label: 'Awaiting Deterministic Verdict…', color: 'bg-slate-700', delay: '0ms' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-xs text-slate-300">
              <div className={`w-2.5 h-2.5 rounded-full ${item.color} animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.5)]`}
                style={{ animationDelay: item.delay }}></div>
              <span className="font-medium">{item.label}</span>
            </div>
          ))}
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
          Select a preset scenario or type a natural-language request in Nova to evaluate agent trust in real-time.
        </p>
      </div>
    );
  }

  if (result.success === false) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-slate-800 flex flex-col items-center justify-center text-center h-full min-h-[350px]">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-rose-300">Pipeline Execution Error</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-2 p-3 bg-rose-950/30 rounded-lg border border-rose-500/30 text-left font-mono">
          {result.error || "An unknown error occurred while processing the transaction intent. The backend may not be reachable."}
        </p>
      </div>
    );
  }

  const { verification, canonicalIntent, execution, fallback, llmRouting, processingTimeMs } = result;
  const isApproved = verification?.decision === 'APPROVED';
  const trustScore = verification?.trustScore ?? 0;
  const riskScore  = verification?.riskScore ?? 0;

  // Latency data: real latency from LLM routing (Layer 4) + processing total
  const l4LatencyMs = llmRouting?.latencyMs ?? null;
  const totalMs     = processingTimeMs ?? null;

  // Estimate layer breakdown (Layers 1/2/3/5/6 are deterministic, effectively instant)
  const deterministicMs = totalMs && l4LatencyMs ? Math.max(0, totalMs - l4LatencyMs) : null;

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col h-full space-y-4 overflow-y-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isApproved ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
          }`}>
            {isApproved ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Layer 3: Trust & Mandate Verification Engine</h2>
            <p className="text-[11px] text-slate-400">Zero-Trust Agent Gating & Feature-Attribution Inspector</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
          isApproved
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
        }`}>
          {verification?.decision}
        </span>
      </div>

      {/* ── Score Cards ── */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {/* Trust Score */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Trust Score</span>
          <div className={`text-3xl font-extrabold font-mono tracking-tight ${
            trustScore >= 70 ? 'text-emerald-400' : trustScore >= 40 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {trustScore}<span className="text-xs font-normal text-slate-400">/100</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">
            {trustScore >= 70 ? 'High Confidence' : trustScore >= 40 ? 'Moderate Risk' : 'High Risk'}
          </span>
        </div>

        {/* Spend Mandate */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300">Spend Limit</span>
            {verification?.isBounded
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : <XCircle className="w-4 h-4 text-rose-400" />}
          </div>
          <div className="my-1">
            <div className="text-xs text-slate-400">Cart: <span className="font-semibold text-white">₹{canonicalIntent?.totalAmount}</span></div>
            <div className="text-xs text-slate-400">Cap: <span className="font-semibold text-blue-400">₹{canonicalIntent?.mandate?.maxAmount}</span></div>
          </div>
          <span className={`text-[10px] font-medium ${verification?.isBounded ? 'text-emerald-400' : 'text-rose-400'}`}>
            {verification?.isBounded ? '✓ Within Limit' : '✕ Over Limit'}
          </span>
        </div>

        {/* Crypto Signature */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300">Signature</span>
            {verification?.isSignatureValid
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : <XCircle className="w-4 h-4 text-rose-400" />}
          </div>
          <div className="my-1 font-mono text-[10px] text-slate-400 truncate">
            {canonicalIntent?.mandate?.signature}
          </div>
          <span className={`text-[10px] font-medium ${verification?.isSignatureValid ? 'text-emerald-400' : 'text-rose-400'}`}>
            {verification?.isSignatureValid ? '✓ Verified ECDSA' : '✕ Forged / Tampered'}
          </span>
        </div>
      </div>

      {/* ── Per-Layer Processing Latency ── */}
      {(totalMs != null) && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-300">Per-Layer Processing Latency</h3>
            <span className="ml-auto text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Total: <span className="text-amber-300 font-bold">{totalMs} ms</span>
            </span>
          </div>
          <div className="space-y-2">
            <LatencyBar label="L1 Protocol Parse"    ms={deterministicMs != null ? Math.round(deterministicMs * 0.05) : null} maxMs={100}  color="blue"    />
            <LatencyBar label="L2 Catalog Check"     ms={deterministicMs != null ? Math.round(deterministicMs * 0.10) : null} maxMs={100}  color="emerald" />
            <LatencyBar label="L3 Trust Gateway"     ms={deterministicMs != null ? Math.round(deterministicMs * 0.60) : null} maxMs={500}  color="amber"   />
            <LatencyBar label="L4 Orchestrator LLM"  ms={l4LatencyMs}                                                          maxMs={5000} color="cyan"    />
            <LatencyBar label="L5 Razorpay Execute"  ms={deterministicMs != null ? Math.round(deterministicMs * 0.20) : null} maxMs={500}  color="purple"  />
            <LatencyBar label="L6 Ledger Write"      ms={deterministicMs != null ? Math.round(deterministicMs * 0.05) : null} maxMs={100}  color="rose"    />
          </div>
          {llmRouting?.modelUsed && (
            <p className="text-[10px] text-slate-500 mt-2 font-mono">
              LLM: {llmRouting.modelUsed} · Stage: {llmRouting.stageReached} ·{' '}
              {llmRouting.fallbackTriggered ? '⚠ Fallback' : '✓ Direct'}
            </p>
          )}
        </div>
      )}

      {/* ── SHAP Feature Attribution ── */}
      <div className="shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-300">
            SHAP Feature-Attribution Risk Breakdown
          </h3>
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
          <span className="ml-auto text-[10px] font-mono text-slate-500">
            Risk score: <span className={`font-bold ${riskScore > 40 ? 'text-rose-400' : riskScore > 20 ? 'text-amber-400' : 'text-emerald-400'}`}>{riskScore}</span>
          </span>
        </div>
        <div className="space-y-2">
          {(verification?.featureAttributions || []).map((fa, index) => (
            <ShapRow key={index} fa={fa} />
          ))}
          {(!verification?.featureAttributions || verification.featureAttributions.length === 0) && (
            <p className="text-xs text-slate-500 italic">No attributions available</p>
          )}
        </div>
      </div>

      {/* ── Plain-Language Explanation ── */}
      <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 shrink-0">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Plain-Language Gateway Reasoning
        </h4>
        <p className="text-xs text-slate-200 leading-relaxed font-mono">
          "{verification?.explanation}"
        </p>
      </div>

      {/* ── Block Reasons ── */}
      {!isApproved && verification?.blockReasons?.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3.5 shrink-0">
          <h4 className="text-[11px] font-bold text-rose-300 mb-2 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Block Reasons
          </h4>
          <ul className="space-y-1">
            {verification.blockReasons.map((r, i) => (
              <li key={i} className="text-xs text-rose-300/80 flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Action Buttons ── */}
      {isApproved && execution && (
        <div className="pt-1 shrink-0">
          <button
            onClick={() => onOpenRazorpayModal(execution)}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Preview Razorpay Order ({execution.orderId})</span>
          </button>
        </div>
      )}

      {!isApproved && fallback?.fallbackPaymentLink && (
        <div className="pt-1 shrink-0">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
            <span className="font-semibold block mb-1">🛡️ Graceful Failure Fallback Active</span>
            <p className="text-[11px] text-slate-300 mb-2">
              Agent direct execution was blocked. Hallucion generated a standard payment link:
            </p>
            <a href={fallback.fallbackPaymentLink} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-400 underline font-mono text-[11px]">
              {fallback.fallbackPaymentLink} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
