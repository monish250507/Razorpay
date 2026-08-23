import React, { useState } from 'react';
import { X, CheckCircle, ExternalLink, ShieldCheck, Zap, Copy, CreditCard } from 'lucide-react';

export default function RazorpayModal({ execution, onClose }) {
  const [isCopied, setIsCopied] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  if (!execution) return null;

  const copyLink = () => {
    navigator.clipboard.writeText(execution.paymentShortUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#0c162c] border border-blue-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Razorpay Branded Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                Razorpay Test Mode Checkout
              </h3>
              <p className="text-[11px] text-blue-200">Layer 5 Execution Gateway</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          
          {paymentDone ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mx-auto animate-bounce">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-white">Payment Authorized & Captured!</h4>
              <p className="text-xs text-slate-400">
                Razorpay Test-Mode settlement completed for Order <span className="font-mono text-blue-400">{execution.orderId}</span>
              </p>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 font-mono">
                SMS sent to Meera: "Sale completed via AI buyer agent. Trust score verified."
              </div>
            </div>
          ) : (
            <>
              {/* Amount Display */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold block">Total Amount Due</span>
                  <span className="text-2xl font-extrabold text-white">₹{execution.amount}</span>
                  <span className="text-[10px] text-slate-500 block font-mono">({execution.amount * 100} Paise)</span>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg font-mono">
                  {execution.currency}
                </span>
              </div>

              {/* Transaction Metadata Grid */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Razorpay Order ID:</span>
                  <span className="font-mono text-blue-400 font-bold">{execution.orderId}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Payment Link ID:</span>
                  <span className="font-mono text-slate-300">{execution.paymentLinkId}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Merchant Account:</span>
                  <span className="font-semibold text-slate-200">Meera's Handmade Candles</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Execution Mode:</span>
                  <span className="text-emerald-400 font-medium">{execution.executionType}</span>
                </div>
              </div>

              {/* Payment Link URL Box */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Razorpay Generated Payment Link:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={execution.paymentShortUrl}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-blue-400 focus:outline-none"
                  />
                  <button
                    onClick={copyLink}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Simulate Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setPaymentDone(true)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>Simulate Test Payment Authorization</span>
                </button>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}
