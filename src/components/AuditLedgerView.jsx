import React, { useState } from 'react';
import { FileCheck2, Hash, CheckCircle2, ShieldAlert, ChevronDown, ChevronUp, Lock } from 'lucide-react';

export default function AuditLedgerView({ ledgerData }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const ledger = ledgerData?.ledger || [];
  const integrity = ledgerData?.integrityCheck || { isValid: true };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col h-full space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <FileCheck2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Layer 6: Audit & Explainability Ledger</h2>
            <p className="text-[11px] text-slate-400">Hash-Chained SHA-256 Tamper-Evident Merchant Journal</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-lg flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-purple-400" />
            <span>Chain Integrity: {integrity.isValid ? 'VALID ✓' : 'CORRUPTED ✕'}</span>
          </span>
          <span className="text-xs text-slate-400 font-mono">
            Blocks: {ledger.length}
          </span>
        </div>
      </div>

      {/* Block List */}
      {ledger.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
          No audit blocks recorded yet. Execute an intent above to append a block.
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
          {ledger.map((block) => {
            const isExpanded = expandedIndex === block.index;
            const isPass = block.decision === 'APPROVED';

            return (
              <div
                key={block.index}
                className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedIndex(isExpanded ? null : block.index)}>
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 font-mono text-xs font-bold flex items-center justify-center">
                      #{block.index}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{block.buyerAgent}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-blue-400 rounded">
                          {block.protocol}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {block.cartSummary} (₹{block.totalAmount})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      isPass ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {block.decision} (Trust: {block.trustScore})
                    </span>

                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* Hashes */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                  <div className="truncate">
                    <span className="text-slate-500">Block Hash: </span>
                    <span className="text-purple-300">{block.hash}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-slate-500">Prev Hash: </span>
                    <span className="text-slate-400">{block.previousHash}</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block mb-0.5">Explanation Trace:</span>
                      <p className="text-slate-200 font-mono text-[11px] bg-slate-950 p-2 rounded border border-slate-800">
                        "{block.explanation}"
                      </p>
                    </div>

                    {block.orderId && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400">Razorpay Order ID:</span>
                        <span className="font-mono text-blue-400 font-bold">{block.orderId}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
