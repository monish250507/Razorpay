import React from 'react';
import { ShieldAlert, XCircle, AlertTriangle, CheckCircle2, X, Bug } from 'lucide-react';

/**
 * AttackResultPanel — surfaces the result of an attack scenario preset
 * in a prominent, styled panel. Currently used for the Prompt Injection demo
 * which calls /api/catalog/agentify directly (not the streaming pipeline).
 */
export default function AttackResultPanel({ result, onClose }) {
  if (!result) return null;

  if (result.loading) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-orange-500/30 bg-orange-950/20 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Bug className="w-5 h-5 text-orange-400 animate-bounce" />
          </div>
          <div>
            <p className="text-sm font-bold text-orange-300">Running Attack Simulation…</p>
            <p className="text-xs text-slate-400">Sending prompt injection payload through Layer 2 harness</p>
          </div>
        </div>
      </div>
    );
  }

  const isRejected = !result.success;
  const failureReason = result.failure_reason || result.harness_stage_reached || '';
  const status = result.status;

  // Parse which harness stage caught it
  const stageLabels = {
    extraction_failed: "Stage 3: Grounding Check",
    needs_manual_review: "Stage 3: Grounding Check (2nd failure → flagged)",
  };
  const caughtAt = stageLabels[status] || (failureReason.includes("Grounding FAILED") ? "Stage 3: Grounding Check" : "LLM Harness");

  // Extract which field was rejected if it's a grounding failure
  const groundingMatch = failureReason.match(/field '([^']+)' value '([^']+)'/);
  const rejectedField = groundingMatch ? groundingMatch[1] : null;
  const rejectedValue = groundingMatch ? groundingMatch[2] : null;

  return (
    <div className={`glass-card rounded-2xl border transition-all duration-300 overflow-hidden ${
      isRejected
        ? 'border-orange-500/40 bg-orange-950/10'
        : 'border-emerald-500/30 bg-emerald-950/10'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${
        isRejected ? 'border-orange-500/20' : 'border-emerald-500/20'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            isRejected ? 'bg-orange-500/15' : 'bg-emerald-500/15'
          }`}>
            {isRejected
              ? <ShieldAlert className="w-5 h-5 text-orange-400" />
              : <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            }
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              ⚠️ Prompt Injection Attack — Simulation Result
            </h3>
            <p className="text-xs text-slate-400">
              {isRejected
                ? `HARNESS DEFENDED: Injection caught at ${caughtAt}`
                : 'WARNING: Injection may have passed — check extraction result'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-4">
        {/* Overall verdict */}
        <div className={`flex items-center gap-3 p-3 rounded-xl ${
          isRejected ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
        }`}>
          {isRejected
            ? <XCircle className="w-5 h-5 text-orange-400 shrink-0" />
            : <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          }
          <div>
            <p className={`text-xs font-bold ${isRejected ? 'text-orange-300' : 'text-emerald-300'}`}>
              {isRejected ? 'EXTRACTION REJECTED' : 'EXTRACTION PASSED (unexpected)'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Status: <span className="font-mono text-slate-200">{status}</span>
            </p>
          </div>
        </div>

        {/* Rejected field highlight */}
        {rejectedField && (
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <p className="text-xs font-bold text-rose-300">Injected Field Detected & Rejected</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/60 rounded-lg p-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Field</p>
                <p className="text-xs font-mono text-rose-300">{rejectedField}</p>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Injected Value</p>
                <p className="text-xs font-mono text-rose-300">{rejectedValue}</p>
              </div>
            </div>
          </div>
        )}

        {/* Failure reason */}
        {failureReason && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Harness Rejection Reason</p>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3">
              <p className="text-[11px] font-mono text-amber-300/80 leading-relaxed break-words">
                {failureReason}
              </p>
            </div>
          </div>
        )}

        {/* Raw text preview */}
        {result.raw_text_preview && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Injected Raw Text (preview)</p>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3">
              <p className="text-[11px] font-mono text-slate-400 leading-relaxed break-words whitespace-pre-wrap">
                {result.raw_text_preview}
              </p>
            </div>
          </div>
        )}

        {/* Defense explanation */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-950/20 border border-blue-500/15">
          <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-300/80 leading-relaxed">
            <span className="font-semibold text-blue-300">Why this is safe:</span> The Hallucion Layer 2 harness runs a grounding check on every LLM-extracted field. Any value not traceable to the original source document is hard-rejected — meaning an attacker cannot force arbitrary prices or fields through the catalog pipeline, even if the LLM was tricked.
          </p>
        </div>
      </div>
    </div>
  );
}
