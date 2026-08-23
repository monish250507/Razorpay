import React, { useState } from 'react';
import { Play, RotateCcw, AlertTriangle, ShieldCheck, Zap, Sparkles } from 'lucide-react';

export default function NovaSimulator({ onRunSimulation, presets, isProcessing }) {
  const [protocol, setProtocol] = useState('AP2');
  const [agentName, setAgentName] = useState('Nova AI Assistant');
  const [productTitle, setProductTitle] = useState('Handmade Sandalwood Soy Candle');
  const [productPrice, setProductPrice] = useState(550);
  const [quantity, setQuantity] = useState(1);
  const [spendLimit, setSpendLimit] = useState(600);
  const [expiryMinutes, setExpiryMinutes] = useState(10);
  const [signatureStatus, setSignatureStatus] = useState('valid');

  const handleExecute = () => {
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
    } else { // NPCI UAP
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
    if (p) {
      onRunSimulation(p.payload);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col h-full">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles className="w-4.5 h-4.5" />
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

      {/* Quick Attack Vector / Demo Buttons */}
      <div className="mb-4">
        <label className="text-[11px] font-semibold text-slate-400 block mb-2">
          ⚡ Quick Test Attack / Verification Vectors:
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => loadPreset('valid_ap2_purchase')}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 font-medium transition-all text-left"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Valid AP2 Purchase (₹550)</span>
          </button>

          <button
            onClick={() => loadPreset('over_budget_blocked')}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs text-rose-300 font-medium transition-all text-left"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">Over-Budget (₹2,500 vs ₹600)</span>
          </button>

          <button
            onClick={() => loadPreset('forged_signature_blocked')}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300 font-medium transition-all text-left"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate">Forged Signature Test</span>
          </button>

          <button
            onClick={() => loadPreset('npci_uap_simulated')}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-xs text-cyan-300 font-medium transition-all text-left"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">Simulated NPCI UAP Mandate</span>
          </button>
        </div>
      </div>

      {/* Form Parameters */}
      <div className="space-y-3.5 text-xs flex-1">
        <div>
          <label className="text-slate-400 block mb-1 font-medium">1. Protocol Specification:</label>
          <div className="grid grid-cols-4 gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {['AP2', 'ACP', 'UCP', 'NPCI_UAP'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setProtocol(p)}
                className={`py-1.5 rounded text-[11px] font-semibold transition-all ${
                  protocol === p
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Buyer Agent Name:</label>
            <input
              type="text"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Target Product:</label>
            <input
              type="text"
              value={productTitle}
              onChange={e => setProductTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Price (₹):</label>
            <input
              type="number"
              value={productPrice}
              onChange={e => setProductPrice(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Qty:</label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Mandate Cap (₹):</label>
            <input
              type="number"
              value={spendLimit}
              onChange={e => setSpendLimit(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-blue-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Mandate Validity:</label>
            <select
              value={expiryMinutes}
              onChange={e => setExpiryMinutes(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={10}>Valid (Expires in 10 mins)</option>
              <option value={0.5}>Near Expiry (30 seconds remaining)</option>
              <option value={-5}>Expired (-5 minutes ago)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-medium">Crypto Signature:</label>
            <select
              value={signatureStatus}
              onChange={e => setSignatureStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="valid">Valid Verified ECDSA Signature</option>
              <option value="invalid">Invalid / Tampered Signature</option>
            </select>
          </div>
        </div>
      </div>

      {/* Execute Action Button */}
      <button
        onClick={handleExecute}
        disabled={isProcessing}
        className="w-full mt-4 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
      >
        <Play className="w-4 h-4 fill-white" />
        <span>{isProcessing ? 'Processing Intent...' : 'Transmit Intent to AEGIS RAIL Gateway'}</span>
      </button>

    </div>
  );
}
