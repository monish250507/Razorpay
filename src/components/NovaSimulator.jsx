import React, { useState } from 'react';
import { Search, Package, Zap, ChevronDown, RefreshCw, Terminal, CheckCircle2, ShieldCheck, Tag, Box, ArrowRight, MessageSquare, Bot, Play, AlertTriangle, Loader2, XCircle, Sparkles } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function NovaSimulator({ onRunSimulation, presets, isProcessing, catalogData }) {
  const [activeTab, setActiveTab] = useState('manual');

  // Manual form state
  const [protocol, setProtocol] = useState('AP2');
  const [agentName, setAgentName] = useState('Nova AI Assistant');
  const [productTitle, setProductTitle] = useState('Handmade Sandalwood Soy Candle');
  const [productPrice, setProductPrice] = useState(550);
  const [quantity, setQuantity] = useState(1);
  const [spendLimit, setSpendLimit] = useState(600);
  const [expiryMinutes, setExpiryMinutes] = useState(10);
  const [signatureStatus, setSignatureStatus] = useState('valid');

  // NL conversational state
  const [nlQuery, setNlQuery] = useState('');
  const [nlBuyerName, setNlBuyerName] = useState('Nova AI Assistant');
  const [nlProtocol, setNlProtocol] = useState('AP2');
  const [nlParsing, setNlParsing] = useState(false);
  const [nlResult, setNlResult] = useState(null); // { success, payload, matched_product, failure_reason, model_used, latency_ms }
  const [nlConfirmed, setNlConfirmed] = useState(false);

  const handleExecuteManual = () => {
    const expiresAt = new Date(Date.now() + (expiryMinutes * 60 * 1000)).toISOString();
    const sigToken = signatureStatus === 'valid' ? 'ap2_ecdsa_valid_signature_token_2026' : 'ap2_ecdsa_invalid_forged_token';

    let payload = {};
    if (protocol === 'AP2') {
      payload = {
        protocol: 'AP2',
        buyer_agent_id: 'agent_nova_01',
        buyer_agent_name: agentName,
        merchant_id: 'merchant_meera_candles',
        items: [{ id: 'prod_candle_01', title: productTitle, price: Number(productPrice), quantity: Number(quantity) }],
        mandate: {
          spend_limit: Number(spendLimit),
          signature: sigToken,
          purpose: `Purchase of ${productTitle}`,
          expires_at: expiresAt
        }
      };
    } else if (protocol === 'ACP') {
      payload = {
        protocol: 'ACP',
        buyer_agent_id: 'agent_acp_buyer',
        buyer_agent_name: agentName,
        merchant_id: 'merchant_meera_candles',
        line_items: [{ product_id: 'prod_candle_01', name: productTitle, amount: Number(productPrice), qty: Number(quantity) }],
        amount_total: Number(productPrice) * Number(quantity),
        authorization: {
          max_amount: Number(spendLimit),
          token: sigToken,
          valid_until: expiresAt
        }
      };
    } else if (protocol === 'UCP') {
      payload = {
        protocol: 'UCP',
        buyer_agent_id: 'agent_ucp_buyer',
        buyer_agent_name: agentName,
        merchant_id: 'merchant_meera_candles',
        cart: [{ item_id: 'prod_candle_01', item_name: productTitle, price: Number(productPrice), count: Number(quantity) }],
        cart_total: Number(productPrice) * Number(quantity),
        user_mandate: {
          cap: Number(spendLimit),
          proof: sigToken,
          expiry: expiresAt
        }
      };
    } else {
      payload = {
        protocol: 'NPCI_UAP',
        buyer_agent_id: 'npci_bharat_agent',
        buyer_agent_name: agentName,
        merchant_id: 'merchant_meera_candles',
        product_code: 'prod_candle_01',
        product_desc: productTitle,
        mandate_amount: Number(productPrice) * Number(quantity),
        upi_mandate_limit: Number(spendLimit),
        npci_token: sigToken,
        mandate_expiry: expiresAt
      };
    }
    onRunSimulation(payload);
  };

  const loadPreset = (presetId) => {
    const p = presets.find(item => item.id === presetId);
    if (p) onRunSimulation(p.payload);
  };

  /** Parse the NL query into a structured AP2 payload via /api/nova/parse-intent */
  const handleNLParse = async () => {
    if (!nlQuery.trim()) return;
    setNlParsing(true);
    setNlResult(null);
    setNlConfirmed(false);

    try {
      const res = await fetch(`${API_BASE}/api/nova/parse-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: nlQuery.trim(), buyer_agent_name: nlBuyerName, protocol: nlProtocol }),
      });
      const data = await res.json();
      setNlResult(data);
    } catch (err) {
      setNlResult({ success: false, failure_reason: err.message });
    } finally {
      setNlParsing(false);
    }
  };

  /** Fire the matched payload into the real pipeline */
  const handleNLConfirm = () => {
    if (!nlResult?.payload) return;
    setNlConfirmed(true);
    onRunSimulation(nlResult.payload);
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col h-full">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Nova AI Buyer Agent Simulator</h2>
            <p className="text-[11px] text-slate-400">Configure & send inbound agent purchase mandates</p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
          Layer 1 Ingress
        </span>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1.5 mb-4">
        <button
          onClick={() => setActiveTab('nl')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'nl'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
              : 'text-slate-400 bg-slate-900/60 border border-slate-700/50 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Natural Language</span>
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'manual'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 bg-slate-900/60 border border-slate-700/50 hover:text-slate-200'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Manual / Presets</span>
        </button>
      </div>

      {/* ─── NL TAB ─── */}
      {activeTab === 'nl' && (
        <div className="flex flex-col gap-3 flex-1">
          <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl p-3 text-[11px] text-blue-300/80 leading-relaxed">
            <strong className="text-blue-300">How it works:</strong> Type a plain shopping request → Groq converts it to a structured AP2 intent grounded in the live catalog → review the match → fire it through the real 6-layer pipeline.
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Shopping Request:</label>
            <textarea
              value={nlQuery}
              onChange={e => setNlQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleNLParse(); }}
              placeholder='e.g. "find me a candle under 600 rupees that smells like sandalwood"'
              rows={3}
              disabled={nlParsing || isProcessing}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none transition-colors disabled:opacity-50"
            />
            <p className="text-[10px] text-slate-500 mt-1">Ctrl+Enter to submit</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Buyer Agent Name:</label>
              <input
                type="text"
                value={nlBuyerName}
                onChange={e => setNlBuyerName(e.target.value)}
                disabled={nlParsing || isProcessing}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Send As Protocol:</label>
              <select
                value={nlProtocol}
                onChange={e => setNlProtocol(e.target.value)}
                disabled={nlParsing || isProcessing}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                <option value="AP2">AP2 Mandate</option>
                <option value="ACP">ACP Checkout Session</option>
                <option value="UCP">UCP Request</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleNLParse}
            disabled={!nlQuery.trim() || nlParsing || isProcessing}
            className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
          >
            {nlParsing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Parsing with Groq…</span></>
            ) : (
              <><Sparkles className="w-4 h-4" /><span>Parse & Match to Catalog</span></>
            )}
          </button>

          {/* NL Result */}
          {nlResult && !nlParsing && (
            <div className={`rounded-xl border p-3 space-y-3 ${nlResult.success ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-rose-500/30 bg-rose-950/10'}`}>
              
              {/* Meta */}
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                  {nlResult.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                  <span className={nlResult.success ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>
                    {nlResult.success ? 'Product Matched' : 'No Match Found'}
                  </span>
                </div>
                {nlResult.model_used && (
                  <span className="font-mono text-slate-500">
                    {nlResult.model_used?.split('/').pop()} · {nlResult.latency_ms}ms
                  </span>
                )}
              </div>

              {nlResult.success && nlResult.matched_product && (
                <div className="bg-slate-900/70 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <Package className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-200">{nlResult.matched_product.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{nlResult.matched_product.description?.slice(0, 80)}…</p>
                    </div>
                    <div className="ml-auto text-right shrink-0">
                      <p className="text-sm font-extrabold text-blue-400">₹{nlResult.matched_product.price}</p>
                      <p className="text-[10px] text-emerald-400">Stock: {nlResult.matched_product.stock}</p>
                    </div>
                  </div>
                  <div className="pt-1.5 border-t border-slate-700/50 text-[10px] text-slate-400 space-y-0.5">
                    <div>Mandate cap: <span className="text-blue-300 font-semibold">₹{nlResult.payload?.mandate?.spend_limit || nlResult.payload?.authorization?.max_amount || nlResult.payload?.payment_auth?.limit}</span> (price + buffer)</div>
                    <div>Protocol: <span className="font-mono text-slate-300">{nlResult.payload?.protocol}</span> · Signature: valid</div>
                  </div>
                </div>
              )}

              {!nlResult.success && (
                <p className="text-[11px] text-rose-300/80 leading-relaxed">{nlResult.failure_reason}</p>
              )}

              {nlResult.success && (
                <button
                  onClick={handleNLConfirm}
                  disabled={isProcessing || nlConfirmed}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                >
                  {nlConfirmed || isProcessing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>Running Pipeline…</span></>
                  ) : (
                    <><ArrowRight className="w-4 h-4" /><span>Send Through AEGIS RAIL Pipeline</span></>
                  )}
                </button>
              )}

              {/* Reset */}
              <button
                onClick={() => { setNlResult(null); setNlQuery(''); setNlConfirmed(false); }}
                className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                ↩ New request
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── MANUAL TAB ─── */}
      {activeTab === 'manual' && (
        <div className="flex flex-col gap-3 flex-1">
          {/* Quick presets */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-2">⚡ Quick Vectors:</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => loadPreset('valid_ap2_purchase')}
                className="flex items-center gap-1.5 px-2.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 font-medium transition-all text-left">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Valid AP2 (₹550)</span>
              </button>
              <button onClick={() => loadPreset('over_budget_blocked')}
                className="flex items-center gap-1.5 px-2.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs text-rose-300 font-medium transition-all text-left">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">Over-Budget Block</span>
              </button>
              <button onClick={() => loadPreset('forged_signature_blocked')}
                className="flex items-center gap-1.5 px-2.5 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300 font-medium transition-all text-left">
                <AlertTriangle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">Forged Signature</span>
              </button>
              <button onClick={() => loadPreset('npci_uap_simulated')}
                className="flex items-center gap-1.5 px-2.5 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-xs text-cyan-300 font-medium transition-all text-left">
                <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">NPCI UAP</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3 text-xs flex-1">
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Protocol:</label>
              <div className="grid grid-cols-4 gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                {['AP2', 'ACP', 'UCP', 'NPCI_UAP'].map(p => (
                  <button key={p} type="button" onClick={() => setProtocol(p)}
                    className={`py-1.5 rounded text-[11px] font-semibold transition-all ${protocol === p ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Agent Name:</label>
                <input type="text" value={agentName} onChange={e => setAgentName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Product:</label>
                <input type="text" value={productTitle} onChange={e => setProductTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Price (₹):</label>
                <input type="number" value={productPrice} onChange={e => setProductPrice(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Qty:</label>
                <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Cap (₹):</label>
                <input type="number" value={spendLimit} onChange={e => setSpendLimit(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-blue-400 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Validity:</label>
                <select value={expiryMinutes} onChange={e => setExpiryMinutes(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value={10}>Valid (10 mins)</option>
                  <option value={0.5}>Near Expiry (30s)</option>
                  <option value={-5}>Expired (-5 mins)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Signature:</label>
                <select value={signatureStatus} onChange={e => setSignatureStatus(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="valid">Valid ECDSA</option>
                  <option value="invalid">Forged / Tampered</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleExecuteManual}
            disabled={isProcessing}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isProcessing ? 'Processing Intent...' : 'Transmit Intent to AEGIS RAIL Gateway'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
