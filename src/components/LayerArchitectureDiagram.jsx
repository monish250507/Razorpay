import React from 'react';
import { Network, Database, ShieldAlert, Cpu, CreditCard, FileCheck2, ArrowRight } from 'lucide-react';

export default function LayerArchitectureDiagram({ currentStep, activeResult }) {
  const layers = [
    {
      id: 1,
      name: "Layer 1: Protocol Translation",
      subtitle: "ACP / AP2 / UCP / NPCI UAP -> Canonical Intent",
      icon: Network,
      color: "from-blue-600 to-indigo-600",
      activeText: activeResult?.protocol ? `Parsed ${activeResult.protocol} Request` : null
    },
    {
      id: 2,
      name: "Layer 2: Catalog Agentification",
      subtitle: "Unstructured merchant data -> MCP Schemas",
      icon: Database,
      color: "from-indigo-600 to-violet-600",
      activeText: activeResult ? "Verified Stock & Price Feed" : null
    },
    {
      id: 3,
      name: "Layer 3: Trust & Mandate Gateway",
      subtitle: "Zero-Trust: Signatures, Spend Cap & Anomaly Scorer",
      icon: ShieldAlert,
      color: activeResult?.verification?.decision === 'APPROVED' ? "from-emerald-600 to-teal-600" : activeResult ? "from-rose-600 to-pink-600" : "from-amber-600 to-orange-600",
      isCenterpiece: true,
      activeText: activeResult?.verification ? `Trust Score: ${activeResult.verification.trustScore}/100 (${activeResult.verification.decision})` : null
    },
    {
      id: 4,
      name: "Layer 4: Orchestrator Agent",
      subtitle: "Claude Agent SDK routing & Graceful Fallback",
      icon: Cpu,
      color: "from-cyan-600 to-blue-600",
      activeText: activeResult?.fallback?.triggered ? "Fallback Mode Active" : activeResult ? "Routing to Razorpay Execution" : null
    },
    {
      id: 5,
      name: "Layer 5: Razorpay Execution",
      subtitle: "Test-mode Orders & Payment Links API",
      icon: CreditCard,
      color: "from-blue-600 to-cyan-500",
      activeText: activeResult?.execution?.orderId ? `Order: ${activeResult.execution.orderId}` : null
    },
    {
      id: 6,
      name: "Layer 6: Audit & Explainability Ledger",
      subtitle: "Tamper-evident SHA-256 Hash Chained Log",
      icon: FileCheck2,
      color: "from-purple-600 to-indigo-600",
      activeText: activeResult?.ledgerBlock ? `Block #${activeResult.ledgerBlock.index} Signed` : null
    }
  ];

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            AEGIS RAIL 6-Layer Architecture Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            End-to-End request translation, zero-trust gating, and execution flow
          </p>
        </div>
        {activeResult && (
          <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
            activeResult.verification?.decision === 'APPROVED' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}>
            Status: {activeResult.verification?.decision}
          </span>
        )}
      </div>

      {/* Layer Cards Horizontal Pipeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        {layers.map((layer) => {
          const Icon = layer.icon;
          const isActive = !!activeResult;
          const isHighlighted = layer.isCenterpiece;

          return (
            <div
              key={layer.id}
              className={`relative rounded-xl p-3.5 border transition-all duration-300 glass-card-hover ${
                isHighlighted
                  ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-500/5'
                  : 'bg-slate-900/50 border-slate-800'
              } ${isActive ? 'ring-1 ring-blue-500/30' : ''}`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${layer.color} flex items-center justify-center shadow-sm`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-bold text-slate-200 truncate">
                  L{layer.id}
                </span>
                {isHighlighted && (
                  <span className="ml-auto text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                    Core
                  </span>
                )}
              </div>
              <h3 className="text-xs font-semibold text-slate-200 line-clamp-1">
                {layer.name.split(': ')[1]}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">
                {layer.subtitle}
              </p>

              {layer.activeText && (
                <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] font-mono text-blue-400 truncate">
                  ✓ {layer.activeText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
