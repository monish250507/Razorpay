import React, { useState, useEffect } from 'react';
import { X, CheckCircle, ExternalLink, ShieldCheck, Zap, Copy, CreditCard, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function RazorpayModal({ execution, onClose, onFallback }) {
  const [isCopied, setIsCopied] = useState(false);
  const [paymentState, setPaymentState] = useState('initial'); // 'initial' | 'checkout_open' | 'confirming_webhook' | 'confirmed' | 'failed'
  const [webhookError, setWebhookError] = useState(null);

  if (!execution) return null;

  const copyLink = () => {
    navigator.clipboard.writeText(execution.paymentShortUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Dynamically load Razorpay Checkout script
  useEffect(() => {
    if (!document.getElementById('razorpay-checkout-js')) {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const openRazorpayCheckout = () => {
    if (!window.Razorpay) {
      alert("Razorpay SDK not loaded yet.");
      return;
    }

    setPaymentState('checkout_open');

    const options = {
      key: execution.keyId || "rzp_test_simulated_key", // Use real key if provided, else fallback string
      name: "Hallucion Gateway",
      description: "Secure Agentic Checkout",
      order_id: execution.orderId,
      handler: function (response) {
        // Payment authorized by client. Now we wait for the webhook to confirm.
        setPaymentState('confirming_webhook');
        pollWebhookStatus(execution.orderId);
      },
      prefill: {
        name: "Test User",
        email: "test@example.com",
        contact: "9876543210"
      },
      theme: {
        color: "#2563EB" // blue-600
      },
      modal: {
        ondismiss: function() {
          setPaymentState('initial');
          if (onFallback) {
             onFallback("User dismissed the Razorpay Checkout widget. Triggering graceful fallback.");
          }
        }
      }
    };

    const rzp1 = new window.Razorpay(options);
    
    rzp1.on('payment.failed', function (response) {
      setPaymentState('failed');
      setWebhookError(response.error.description || "Payment failed");
      if (onFallback) {
          onFallback(`Razorpay Checkout failed: ${response.error.description}`);
      }
    });

    rzp1.open();
  };

  // Poll the backend until status is "confirmed" or "failed"
  const pollWebhookStatus = async (orderId) => {
    const maxAttempts = 30; // 30 seconds
    let attempts = 0;

    const intervalId = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        setPaymentState('failed');
        setWebhookError("Timed out waiting for webhook confirmation. Check: (a) ngrok tunnel is running & dashboard URL matches, (b) RAZORPAY_WEBHOOK_SECRET in .env matches the Razorpay dashboard exactly.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/transactions/${orderId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'confirmed') {
            clearInterval(intervalId);
            setPaymentState('confirmed');
          } else if (data.status === 'failed') {
            clearInterval(intervalId);
            setPaymentState('failed');
            setWebhookError("Webhook reported payment failure.");
          }
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 1500); // Check every 1.5s
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
          
          {paymentState === 'confirmed' ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mx-auto animate-bounce">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-white">Payment Authorized & Webhook Confirmed!</h4>
              <p className="text-xs text-slate-400">
                Razorpay Test-Mode settlement completed for Order <span className="font-mono text-blue-400">{execution.orderId}</span>
              </p>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 font-mono">
                SMS sent to Merchant: "Sale completed via AI buyer agent. Webhook verified."
              </div>
            </div>
          ) : paymentState === 'confirming_webhook' ? (
            <div className="text-center py-8 space-y-4">
               <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
               <h4 className="text-lg font-bold text-white">Confirming with Razorpay...</h4>
               <p className="text-xs text-slate-400">
                 Client success received. Waiting for secure server-to-server webhook confirmation from Razorpay before completing order.
               </p>
            </div>
          ) : paymentState === 'failed' ? (
             <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 bg-rose-500/20 border border-rose-500/30 rounded-full flex items-center justify-center text-rose-400 mx-auto">
                <X className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-white">Payment Failed</h4>
              <p className="text-xs text-rose-400">
                {webhookError}
              </p>
              <button onClick={() => setPaymentState('initial')} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded">Retry</button>
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

              {/* Real Checkout Button */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={openRazorpayCheckout}
                  disabled={paymentState === 'checkout_open'}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Open Real Razorpay Checkout Widget</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  <strong>Demo Info:</strong> Use UPI ID <code className="text-emerald-400 bg-emerald-400/10 px-1 rounded">success@razorpay</code> for instant success.
                </p>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}
