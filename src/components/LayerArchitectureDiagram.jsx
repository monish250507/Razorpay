import React from 'react';
import { Network, Database, ShieldAlert, Cpu, CreditCard, FileCheck2, CheckCircle2, XCircle, SkipForward, Loader2, AlertTriangle } from 'lucide-react';

/**
 * Per-layer status states and their visual treatment:
 *   "idle"      — neutral dark card (no simulation running)
 *   "started"   — pulsing blue ring, spinning loader icon (currently executing)
 *   "completed" — green checkmark, result text shown
 *   "blocked"   — red/rose border, XCircle icon (Layer 3 blocked the tx)
 *   "skipped"   — muted gray, SkipForward icon (Layers 4-5 when blocked)
 */
export default function LayerArchitectureDiagram({ layerStatuses = {}, activeResult, isProcessing }) {
  const layers = [
    {
      id: 1,
      name: "Layer 1: Protocol Translation",
      subtitle: "ACP / AP2 / UCP / NPCI UAP → Canonical Intent",
      icon: Network,
      color: "from-blue-600 to-indigo-600",
      glowColor: "shadow-blue-500/40",
      ringColor: "ring-blue-500/60",
      getResultText: (data) => {
        if (!data?.protocolOrigin) return null;
        let badge = "";
        if (data.protocolOrigin === "AP2") badge = "Validated against real AP2 v0.1 schema";
        else if (data.protocolOrigin === "ACP") badge = "Validated against real ACP v1.0.0 schema";
        else if (data.protocolOrigin === "UCP") badge = "Validated against real UCP schema";
        else badge = "Simulation: No public schema exists";
        
        return `${badge} · Intent ${data.intentId?.slice(-8)}`;
      },
    },
    {
      id: 2,
      name: "Layer 2: Catalog Agentification",
      subtitle: "Unstructured merchant data → MCP Schemas",
      icon: Database,
      color: "from-indigo-600 to-violet-600",
      glowColor: "shadow-violet-500/40",
      ringColor: "ring-violet-500/60",
      getResultText: (data) => data?.itemsChecked != null ? `${data.catalogHits}/${data.itemsChecked} items verified · ₹${data.totalAmount}` : null,
    },
    {
      id: 3,
      name: "Layer 3: Trust & Mandate Gateway",
      subtitle: "Zero-Trust: Signatures, Spend Cap & Anomaly Scorer",
      icon: ShieldAlert,
      color: "from-amber-600 to-orange-600",
      glowColor: "shadow-amber-500/40",
      ringColor: "ring-amber-500/60",
      isCenterpiece: true,
      getResultText: (data, status) => {
        if (!data) return null;
        if (status === 'blocked') return `BLOCKED · Trust ${data.trustScore}/100`;
        return `APPROVED · Trust ${data.trustScore}/100`;
      },
    },
    {
      id: 4,
      name: "Layer 4: Orchestrator Agent",
      subtitle: "Claude Agent SDK routing & Graceful Fallback",
      icon: Cpu,
      color: "from-cyan-600 to-blue-600",
      glowColor: "shadow-cyan-500/40",
      ringColor: "ring-cyan-500/60",
      getResultText: (data) => {
        if (!data) return null;
        if (data.fallbackTriggered) return "Fallback Mode Active";
        return data.routingAction ? `Routed: ${data.routingAction}` : "Routing complete";
      },
    },
    {
      id: 5,
      name: "Layer 5: Razorpay Execution",
      subtitle: "Test-mode Orders & Payment Links API",
      icon: CreditCard,
      color: "from-blue-600 to-cyan-500",
      glowColor: "shadow-blue-500/40",
      ringColor: "ring-blue-500/60",
      getResultText: (data) => data?.orderId ? `Order: ${data.orderId}` : null,
    },
    {
      id: 6,
      name: "Layer 6: Audit & Explainability Ledger",
      subtitle: "Tamper-evident SHA-256 Hash Chained Log",
      icon: FileCheck2,
      color: "from-purple-600 to-indigo-600",
      glowColor: "shadow-purple-500/40",
      ringColor: "ring-purple-500/60",
      getResultText: (data) => data?.index ? `Block #${data.index} · ${data.hash?.slice(0, 12)}…` : null,
    }
  ];

  // Derive overall status from layer statuses for header badge
  const l3 = layerStatuses[3];
  const overallDecision = l3?.status === 'blocked'
    ? 'BLOCKED'
    : l3?.status === 'completed'
    ? 'APPROVED'
    : activeResult?.verification?.decision ?? null;

  // Check if Layer 4 is in fallback mode
  const l4Fallback = layerStatuses[4]?.data?.fallbackTriggered;

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isProcessing ? 'bg-blue-400 animate-ping' : 'bg-blue-500 animate-pulse'}`}></span>
            AEGIS RAIL 6-Layer Architecture Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            End-to-End request translation, zero-trust gating, and execution flow
          </p>
        </div>
        <div className="flex items-center gap-2">
          {l4Fallback && (
            <span className="px-2 py-1 text-[10px] font-semibold rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30 flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              Fallback Mode Active
            </span>
          )}
          {overallDecision && (
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
              overallDecision === 'APPROVED'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              Status: {overallDecision}
            </span>
          )}
        </div>
      </div>

      {/* Layer Cards Horizontal Pipeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        {layers.map((layer) => {
          const Icon = layer.icon;
          const layerState = layerStatuses[layer.id];
          const status = layerState?.status ?? 'idle';
          const data = layerState?.data ?? null;

          const isStarted   = status === 'started';
          const isCompleted = status === 'completed';
          const isBlocked   = status === 'blocked';
          const isSkipped   = status === 'skipped';
          const isIdle      = status === 'idle';

          // Dynamic gradient for Layer 3 based on result
          const layerColor = layer.id === 3
            ? (isBlocked ? "from-rose-600 to-pink-600" : isCompleted ? "from-emerald-600 to-teal-600" : layer.color)
            : layer.color;

          // Card border and ring
          const cardClass = [
            "relative rounded-xl p-3.5 border transition-all duration-500 glass-card-hover",
            layer.isCenterpiece && isIdle
              ? "bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-500/5"
              : isBlocked
              ? "bg-rose-950/40 border-rose-500/50 shadow-lg shadow-rose-500/10"
              : isSkipped
              ? "bg-slate-900/30 border-slate-700/40 opacity-50"
              : isCompleted
              ? `bg-slate-900/80 border-emerald-500/20 shadow-sm`
              : isStarted
              ? `bg-slate-900/80 border-blue-500/40 shadow-lg ${layer.glowColor} ring-1 ${layer.ringColor}`
              : "bg-slate-900/50 border-slate-800",
          ].join(" ");

          // Status indicator icon
          let StatusIcon = null;
          let statusIconClass = "";
          if (isStarted) {
            StatusIcon = Loader2;
            statusIconClass = "text-blue-400 animate-spin";
          } else if (isCompleted) {
            StatusIcon = CheckCircle2;
            statusIconClass = layer.id === 3 ? "text-emerald-400" : "text-emerald-400";
          } else if (isBlocked) {
            StatusIcon = XCircle;
            statusIconClass = "text-rose-400";
          } else if (isSkipped) {
            StatusIcon = SkipForward;
            statusIconClass = "text-slate-500";
          }

          const resultText = layer.getResultText?.(data, status);
          const isFallbackLayer = layer.id === 4 && data?.fallbackTriggered;

          return (
            <div key={layer.id} className={cardClass}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${layerColor} flex items-center justify-center shadow-sm transition-all duration-500 ${isStarted ? 'animate-pulse' : ''}`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className={`text-xs font-bold truncate transition-colors duration-300 ${isSkipped ? 'text-slate-500' : 'text-slate-200'}`}>
                  L{layer.id}
                </span>

                {/* Status icon */}
                {StatusIcon && (
                  <span className="ml-auto">
                    <StatusIcon className={`w-3.5 h-3.5 ${statusIconClass}`} />
                  </span>
                )}

                {/* Centerpiece badge (idle only) */}
                {layer.isCenterpiece && isIdle && (
                  <span className="ml-auto text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                    Core
                  </span>
                )}
              </div>

              <h3 className={`text-xs font-semibold line-clamp-1 transition-colors duration-300 ${isSkipped ? 'text-slate-500' : 'text-slate-200'}`}>
                {layer.name.split(': ')[1]}
              </h3>
              <p className={`text-[10px] mt-0.5 line-clamp-2 leading-tight transition-colors duration-300 ${isSkipped ? 'text-slate-600' : 'text-slate-400'}`}>
                {layer.subtitle}
              </p>

              {/* Layer result / status text */}
              {isStarted && (
                <div className="mt-2.5 pt-2 border-t border-blue-500/20 text-[10px] font-mono text-blue-400 animate-pulse">
                  ⟳ Processing…
                </div>
              )}

              {isSkipped && (
                <div className="mt-2.5 pt-2 border-t border-slate-700/30 text-[10px] font-mono text-slate-500">
                  ⊘ Skipped (blocked)
                </div>
              )}

              {isBlocked && (
                <div className="mt-2.5 pt-2 border-t border-rose-500/20 space-y-0.5">
                  <div className="text-[10px] font-mono text-rose-400 font-semibold">
                    ✕ BLOCKED · Trust {data?.trustScore}/100
                  </div>
                  {data?.blockReasons?.[0] && (
                    <div className="text-[9px] text-rose-300/70 line-clamp-2 leading-tight">
                      {data.blockReasons[0]}
                    </div>
                  )}
                </div>
              )}

              {isCompleted && resultText && !isBlocked && (
                <div className={`mt-2.5 pt-2 border-t border-slate-800 text-[10px] font-mono truncate transition-colors duration-300 ${
                  isFallbackLayer ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {isFallbackLayer ? '⚠ ' : '✓ '}{resultText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
