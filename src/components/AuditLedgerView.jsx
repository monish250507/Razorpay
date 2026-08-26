import React, { useState } from 'react';
import { FileCheck2, CheckCircle2, XCircle, ChevronDown, ChevronUp, Lock, Link, Hash } from 'lucide-react';

/**
 * Computes how many characters of hash1 and hash2 match from the start.
 * Used to visually prove that block.previousHash === prev.hash.
 */
function computeHashMatch(hash1, hash2) {
  if (!hash1 || !hash2) return { match: false, prefix: 0 };
  const match = hash1 === hash2;
  let prefix = 0;
  for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
    if (hash1[i] === hash2[i]) prefix++;
    else break;
  }
  return { match, prefix };
}

/**
 * HashChain visualizer — shows block N's previousHash alongside block N-1's hash,
 * with a matching color when they link correctly (proving the chain is unbroken).
 */
function HashChainLink({ block, prevBlock }) {
  const { match } = prevBlock
    ? computeHashMatch(block.previousHash, prevBlock.hash)
    : { match: block.index === 1 && block.previousHash === '0'.repeat(64) };

  const isGenesis = block.index === 1;

  if (isGenesis) {
    return (
      <div className="mt-2.5 pt-2 border-t border-slate-800/60">
        <div className="flex items-center gap-2 text-[10px]">
          <div className="w-5 h-5 rounded bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Hash className="w-3 h-3 text-purple-400" />
          </div>
          <span className="text-slate-500 font-mono">Genesis Block — no previous hash</span>
        </div>
        <div className="mt-1.5 font-mono text-[10px]">
          <span className="text-slate-500">Hash: </span>
          <span className="text-purple-300 break-all">{block.hash}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-800/60 space-y-2">
      {/* Hash chain connector visualization */}
      <div className="flex items-stretch gap-0">
        {/* This block's previousHash */}
        <div className="flex-1 min-w-0 bg-slate-900/80 border border-slate-700/60 rounded-l-lg p-2">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">
            Block #{block.index} ← previousHash
          </p>
          <p className="text-[10px] font-mono text-slate-300 break-all leading-tight">
            {block.previousHash?.slice(0, 24)}…
          </p>
        </div>

        {/* Chain link connector */}
        <div className={`flex flex-col items-center justify-center px-2 border-y border-slate-700/60 ${
          match ? 'bg-emerald-950/30' : 'bg-rose-950/30'
        }`}>
          <Link className={`w-3.5 h-3.5 ${match ? 'text-emerald-400' : 'text-rose-400'}`} />
          <span className={`text-[8px] font-bold mt-0.5 ${match ? 'text-emerald-400' : 'text-rose-400'}`}>
            {match ? 'MATCH' : 'BREAK'}
          </span>
        </div>

        {/* Previous block's hash */}
        <div className={`flex-1 min-w-0 border rounded-r-lg p-2 ${
          match
            ? 'bg-emerald-950/20 border-emerald-500/30'
            : 'bg-rose-950/20 border-rose-500/30'
        }`}>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">
            Block #{block.index - 1} → hash
          </p>
          <p className={`text-[10px] font-mono break-all leading-tight ${match ? 'text-emerald-300' : 'text-rose-300'}`}>
            {prevBlock?.hash?.slice(0, 24)}…
          </p>
        </div>
      </div>

      {/* Full hashes line */}
      <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
        <div>
          <span className="text-slate-500">This block hash: </span>
          <span className="text-purple-300 break-all">{block.hash?.slice(0, 16)}…</span>
        </div>
        <div>
          {match ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Chain integrity: VALID ✓
            </span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              Chain integrity: BROKEN ✕
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditLedgerView({ ledgerData }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const ledger = ledgerData?.ledger || [];
  const integrity = ledgerData?.integrityCheck || { isValid: true };

  // Sort ascending for chain display (Genesis = index 1 first)
  const sortedLedger = [...ledger].sort((a, b) => a.index - b.index);

  // Build a map: index → block for O(1) prevBlock lookup
  const blockByIndex = Object.fromEntries(sortedLedger.map(b => [b.index, b]));

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col h-full space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Layer 6: Audit & Explainability Ledger</h2>
            <p className="text-[11px] text-slate-400">Hash-Chained SHA-256 Tamper-Evident Merchant Journal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 text-xs font-mono border rounded-lg flex items-center gap-1.5 ${
            integrity.isValid
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
          }`}>
            <Lock className="w-3 h-3" />
            <span>Chain: {integrity.isValid ? 'VALID ✓' : 'CORRUPTED ✕'}</span>
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {ledger.length} blocks
          </span>
        </div>
      </div>

      {/* Block List */}
      {ledger.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
          No audit blocks recorded yet. Execute an intent above to append a block.
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          {/* Show in reverse order (newest first) but still show chain linkage to prev */}
          {[...sortedLedger].reverse().map((block) => {
            const isExpanded = expandedIndex === block.index;
            const isPass = block.decision === 'APPROVED';
            const prevBlock = blockByIndex[block.index - 1] || null;

            return (
              <div
                key={block.index}
                className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all"
              >
                {/* Block header row */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedIndex(isExpanded ? null : block.index)}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
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
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      isPass ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {block.decision} · {block.trustScore}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* ── Hash Chain Linkage (always visible) ── */}
                <HashChainLink block={block} prevBlock={prevBlock} />

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block mb-1">Gateway Reasoning:</span>
                      <p className="text-slate-200 font-mono text-[11px] bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed">
                        "{block.explanation}"
                      </p>
                    </div>

                    {/* Full hashes */}
                    <div className="space-y-1.5">
                      <span className="text-slate-400 font-semibold block">Full SHA-256 Hashes:</span>
                      <div className="bg-slate-950 rounded-lg border border-slate-800 p-2.5 space-y-1.5">
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase tracking-wide">Block Hash:</span>
                          <p className="font-mono text-[10px] text-purple-300 break-all mt-0.5">{block.hash}</p>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase tracking-wide">Previous Hash:</span>
                          <p className={`font-mono text-[10px] break-all mt-0.5 ${prevBlock ? 'text-emerald-300' : 'text-slate-500'}`}>
                            {block.previousHash}
                          </p>
                        </div>
                        {prevBlock && (
                          <div className={`flex items-center gap-2 pt-1.5 border-t border-slate-800 text-[10px] font-semibold ${
                            block.previousHash === prevBlock.hash ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {block.previousHash === prevBlock.hash
                              ? <><CheckCircle2 className="w-3.5 h-3.5" /> previousHash === Block #{block.index - 1} hash — chain is unbroken</>
                              : <><XCircle className="w-3.5 h-3.5" /> MISMATCH — chain tampered!</>
                            }
                          </div>
                        )}
                      </div>
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
