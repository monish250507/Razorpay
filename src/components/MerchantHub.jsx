import React, { useState, useRef } from 'react';
import { Store, Code, CheckCircle, Package, Tag, ShieldCheck, Plus, Loader2, CheckCircle2, XCircle, SkipForward, Clock, Sparkles, AlertTriangle } from 'lucide-react';

const STAGE_ORDER = ['CONSTRAINED_CALL', 'SCHEMA_VALIDATION', 'GROUNDING_CHECK', 'BOUNDED_EXECUTION'];
const STAGE_LABELS = {
  CONSTRAINED_CALL:  'Groq Constrained Call',
  SCHEMA_VALIDATION: 'Pydantic Schema Validation',
  GROUNDING_CHECK:   'Grounding Check (anti-hallucination)',
  BOUNDED_EXECUTION: 'Bounded Execution Allow-List',
};

function HarnessStageRow({ stage, label, status, detail }) {
  const Icon = status === 'running'  ? Loader2
             : status === 'passed'   ? CheckCircle2
             : status === 'failed'   ? XCircle
             : status === 'skipped'  ? SkipForward
             : Clock; // pending

  const iconClass = status === 'running'  ? 'text-blue-400 animate-spin'
                  : status === 'passed'   ? 'text-emerald-400'
                  : status === 'failed'   ? 'text-rose-400'
                  : status === 'skipped'  ? 'text-slate-500'
                  : 'text-slate-600'; // pending

  const rowClass = status === 'running'  ? 'border-blue-500/30 bg-blue-950/20'
                 : status === 'passed'   ? 'border-emerald-500/20 bg-emerald-950/10'
                 : status === 'failed'   ? 'border-rose-500/30 bg-rose-950/20'
                 : status === 'skipped'  ? 'border-slate-700/30 opacity-50'
                 : 'border-slate-700/30'; // pending

  return (
    <div className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all duration-300 ${rowClass}`}>
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-semibold ${status === 'skipped' ? 'text-slate-500' : 'text-slate-200'}`}>
          {label}
        </p>
        {detail && (
          <p className="text-[10px] text-slate-400 mt-0.5 break-words leading-relaxed">{detail}</p>
        )}
      </div>
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function MerchantHub({ catalogData, onCatalogUpdate }) {
  const [activeTab, setActiveTab] = useState('products');

  // Onboarding state
  const [productId, setProductId] = useState('');
  const [rawText, setRawText] = useState('');
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardStages, setOnboardStages] = useState({}); // { stage: {status, detail} }
  const [onboardResult, setOnboardResult] = useState(null); // final result
  const readerRef = useRef(null);

  const products = catalogData?.products || [];
  const mcpSchema = catalogData?.mcpSchema || {};
  const merchantName = catalogData?.merchant || 'Demo Merchant';

  const handleOnboard = async () => {
    if (!productId.trim() || !rawText.trim()) return;
    setIsOnboarding(true);
    setOnboardResult(null);
    setOnboardStages({});

    try {
      const response = await fetch(`${API_BASE}/api/catalog/agentify/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId.trim(), raw_text: rawText.trim() }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          try {
            const ev = JSON.parse(line.slice('data:'.length).trim());

            if (ev.event === 'done') {
              setOnboardResult(ev.data);
              setIsOnboarding(false);
              // Refetch catalog so new product shows immediately
              if (ev.data?.success && onCatalogUpdate) {
                onCatalogUpdate();
              }
              continue;
            }
            if (ev.event === 'error') {
              setOnboardResult({ success: false, failure_reason: ev.data?.error || 'Unknown error' });
              setIsOnboarding(false);
              continue;
            }
            // Stage event
            if (ev.stage) {
              setOnboardStages(prev => ({
                ...prev,
                [ev.stage]: { status: ev.status, detail: ev.detail || '' },
              }));
            }
          } catch {}
        }
      }
    } catch (err) {
      setOnboardResult({ success: false, failure_reason: err.message });
      setIsOnboarding(false);
    }
  };

  const resetOnboard = () => {
    setProductId('');
    setRawText('');
    setOnboardResult(null);
    setOnboardStages({});
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col h-full space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Merchant Hub: {merchantName}</h2>
            <p className="text-[11px] text-slate-400">Layer 2 Catalog Agentification & Machine-Readable Feed</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-semibold text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>AEGIS Agent-Ready</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'products' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Catalog ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('onboard')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'onboard'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Onboard Product</span>
        </button>

        <button
          onClick={() => setActiveTab('mcp')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'mcp' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>MCP Schema</span>
        </button>
      </div>

      {/* Tab: Catalog */}
      {activeTab === 'products' && (
        <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[360px] pr-1">
          {products.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-700 rounded-xl">
              No products yet. Use "Onboard Product" to add one.
            </div>
          )}
          {products.map(p => (
            <div key={p.id} className={`rounded-xl p-3 border transition-all hover:border-slate-700 ${
              p.onboarded_at ? 'border-indigo-500/30 bg-indigo-950/10' : 'bg-slate-900/60 border-slate-800/80'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-100">{p.name}</h4>
                    {p.onboarded_at && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                        <Sparkles className="w-2.5 h-2.5" /> Just Onboarded
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{p.description}</p>
                </div>
                <div className="text-right ml-2 shrink-0">
                  <div className="text-sm font-extrabold text-blue-400">₹{p.price}</div>
                  <span className="text-[10px] text-emerald-400 font-medium">Stock ({p.stock})</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                <div className="flex gap-1 flex-wrap">
                  {(p.tags || []).map((t, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">#{t}</span>
                  ))}
                  {(!p.tags || p.tags.length === 0) && (
                    <span className="px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">{p.category}</span>
                  )}
                </div>
                <span className="text-slate-500 font-mono">{p.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Onboard Product */}
      {activeTab === 'onboard' && (
        <div className="flex-1 flex flex-col space-y-3 overflow-y-auto">
          {onboardResult?.success ? (
            /* ─── Success State ─── */
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-300">Product Published to Live Catalog!</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {onboardResult.published_product?.name} is now agent-queryable
                  </p>
                </div>
              </div>

              {onboardResult.entry && (
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Extracted Fields</p>
                  {Object.entries(onboardResult.entry).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 text-[11px]">
                      <span className="text-slate-400 font-mono">{k}</span>
                      <span className="text-slate-200 text-right truncate max-w-[60%]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={resetOnboard}
                className="w-full py-2 text-xs font-semibold text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Onboard Another Product
              </button>
            </div>
          ) : onboardResult && !onboardResult.success ? (
            /* ─── Failure State ─── */
            <div className="space-y-3">
              {/* Stages that ran */}
              {Object.keys(onboardStages).length > 0 && (
                <div className="space-y-1.5">
                  {STAGE_ORDER.map(stage => {
                    const s = onboardStages[stage];
                    if (!s) return null;
                    return (
                      <HarnessStageRow key={stage} stage={stage} label={STAGE_LABELS[stage]} status={s.status} detail={s.detail} />
                    );
                  })}
                </div>
              )}
              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-rose-300">Extraction Failed</p>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed break-words">
                      {onboardResult.failure_reason}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={resetOnboard}
                className="w-full py-2 text-xs font-semibold text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            /* ─── Input Form / In-Progress ─── */
            <div className="space-y-3 flex-1">
              {/* Harness progress (shown during & after submission) */}
              {(isOnboarding || Object.keys(onboardStages).length > 0) && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    4-Stage LLM Harness Progress
                  </p>
                  {STAGE_ORDER.map(stage => {
                    const s = onboardStages[stage];
                    return (
                      <HarnessStageRow
                        key={stage}
                        stage={stage}
                        label={STAGE_LABELS[stage]}
                        status={s?.status || 'pending'}
                        detail={s?.detail || ''}
                      />
                    );
                  })}
                </div>
              )}

              {!isOnboarding && Object.keys(onboardStages).length === 0 && (
                <>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Product ID / SKU <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={productId}
                      onChange={e => setProductId(e.target.value)}
                      placeholder="e.g. prod_rose_candle_01"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Raw Product Description <span className="text-rose-400">*</span>
                    </label>
                    <p className="text-[10px] text-slate-500 mb-1.5">
                      Paste any messy merchant text — the harness will extract and validate structured fields
                    </p>
                    <textarea
                      value={rawText}
                      onChange={e => setRawText(e.target.value)}
                      placeholder="e.g. Rose & Oud candle, handmade, 250g, INR 899, 30 units in stock, ships 2-3 days, 7 day return..."
                      rows={5}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
                    />
                  </div>

                  <button
                    onClick={handleOnboard}
                    disabled={!productId.trim() || !rawText.trim()}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Agentify & Publish via Layer 2 Harness</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: MCP Schema */}
      {activeTab === 'mcp' && (
        <div className="flex-1 bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto max-h-[360px]">
          <pre className="text-[11px] font-mono text-cyan-300 leading-relaxed">
            {JSON.stringify(mcpSchema, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
