import React, { useState, useEffect } from 'react';
import { Activity, ShoppingCart, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import MerchantHub from './MerchantHub';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function MerchantView({ catalogData, onCatalogUpdate }) {
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({ 
    today: 0, 
    allTime: 0,
    totalRevenue: 0,
    distinctAgents: 0,
    avgTrustScore: 0,
    blockedAttempts: 0
  });
  const [toast, setToast] = useState(null);

  const fetchLedger = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ledger`);
      if (res.ok) {
        const data = await res.json();
        const ledgerData = Array.isArray(data) ? data : data.ledger;
        
        // Parse ledger to find webhook events and reconstruct activity feed
        const webhookEvents = ledgerData.filter(e => e.type === "WEBHOOK_EVENT" && e.eventType === "payment.captured");
        
        const feed = webhookEvents.map(e => {
          // Find matching approval for details
          const orderId = e.orderId;
          const approvedEvent = [...ledgerData].reverse().find(x => x.decision === "APPROVED" && x.execution?.orderId === orderId);
          const initiatedEvent = approvedEvent ? [...ledgerData].reverse().find(x => x.type === "TRANSACTION_INITIATED" && x.intentId === approvedEvent.intentId) : null;
          
          return {
            id: e.entryId,
            timestamp: e.timestamp,
            amount: approvedEvent?.execution?.amount || 0,
            trustScore: approvedEvent?.trustScore || 0,
            buyerAgent: initiatedEvent?.intentData?.buyerAgentName || 'Unknown Agent',
            orderId: orderId,
            paymentId: e.paymentId
          };
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        setActivities(feed);
        
        // Calculate stats
        const todayStr = new Date().toISOString().split('T')[0];
        
        const allDecisionTx = ledgerData.filter(e => e.decision);
        const approvedTx = allDecisionTx.filter(e => e.decision === "APPROVED");
        const rejectedTx = allDecisionTx.filter(e => e.decision === "REJECTED");
        
        const totalRevenue = webhookEvents.reduce((sum, e) => {
           const app = approvedTx.find(x => x.orderId === e.payload?.payload?.payment?.entity?.order_id || x.orderId === e.orderId);
           return sum + (app?.totalAmount || 0);
        }, 0);
        
        const agents = new Set(allDecisionTx.map(e => e.buyerAgent).filter(Boolean));
        const totalTrust = allDecisionTx.reduce((sum, e) => sum + (e.trustScore || 0), 0);
        const avgTrust = allDecisionTx.length ? Math.round(totalTrust / allDecisionTx.length) : 0;
        
        setStats({
          allTime: feed.length,
          today: feed.filter(f => f.timestamp.startsWith(todayStr)).length,
          totalRevenue: totalRevenue,
          distinctAgents: agents.size,
          avgTrustScore: avgTrust,
          blockedAttempts: rejectedTx.length
        });
      }
    } catch (err) {
      console.error("Failed to fetch ledger for backfill", err);
    }
  };

  useEffect(() => {
    // Initial backfill
    fetchLedger();

    let eventSource = null;
    let reconnectTimeout = null;

    const connectSSE = () => {
      console.log('Connecting to Merchant SSE...');
      eventSource = new EventSource(`${API_BASE}/api/merchant/notifications/stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received Merchant Notification:', data);
          
          if (data.event === 'payment.captured') {
            const newActivity = {
              id: `live-${Date.now()}`,
              timestamp: data.timestamp,
              amount: data.amount,
              trustScore: data.trustScore,
              buyerAgent: data.buyerAgent,
              orderId: data.orderId,
              paymentId: data.paymentId
            };
            
            // Add to feed
            setActivities(prev => {
              // Avoid duplicates if SSE and backfill race
              if (prev.some(a => a.orderId === data.orderId)) return prev;
              return [newActivity, ...prev];
            });
            
            // Update stats
            setStats(prev => ({
              allTime: prev.allTime + 1,
              today: prev.today + 1
            }));
            
            // Show toast
            setToast({
              title: "Payment Captured",
              message: `Received ₹${data.amount} from ${data.buyerAgent}`,
              label: "Confirmed via Razorpay webhook",
              id: Date.now()
            });
            
            setTimeout(() => setToast(null), 5000);
          }
        } catch (err) {
          console.error("Error parsing merchant SSE data:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("Merchant SSE connection error. Reconnecting in 3s...", err);
        eventSource.close();
        reconnectTimeout = setTimeout(() => {
          fetchLedger(); // Backfill anything missed while disconnected
          connectSSE();
        }, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-[1500px] mx-auto p-4 sm:p-6 lg:p-8">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-24 right-4 z-[9999] animate-in slide-in-from-top-10 fade-in duration-300">
          <div className="bg-[#1a2332] border border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)] rounded-xl p-4 flex flex-col gap-2 max-w-sm">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2 rounded-full">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">{toast.title}</h3>
                <p className="text-gray-400 text-sm">{toast.message}</p>
              </div>
            </div>
            <div className="bg-[#070d19] rounded px-3 py-1.5 flex items-center justify-center border border-gray-800">
              <span className="text-emerald-400 text-xs font-mono">{toast.label}</span>
            </div>
          </div>
        </div>
      )}

      {/* Left Column: Onboarding / Catalog */}
      <div className="lg:col-span-6 flex flex-col gap-8">
        <div className="bg-[#0a1120] border border-gray-800/50 rounded-2xl p-0 shadow-xl flex flex-col min-h-[500px]">
          <MerchantHub 
            catalogData={catalogData}
            onCatalogUpdate={onCatalogUpdate}
          />
        </div>
      </div>

      {/* Right Column: Live Feed & Stats */}
      <div className="lg:col-span-6 flex flex-col gap-8">
        
        {/* Merchant Profile Header */}
        <div className="bg-[#0a1120] border border-gray-800/50 rounded-xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Meera's Artisanal Market</h2>
            <div className="flex items-center gap-3 mt-2 text-xs font-medium">
              <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">Category: Home Goods</span>
              <span className="text-blue-400 bg-blue-400/10 px-2 py-1 rounded border border-blue-400/20">Agent-Ready Since: Jan 2026</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
            M
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-[#0a1120] border border-gray-800/50 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider">Total Revenue</h3>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-2xl text-white font-bold relative z-10 mt-2">₹{stats.totalRevenue.toLocaleString()}</span>
          </div>
          <div className="bg-[#0a1120] border border-gray-800/50 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider">Orders Today</h3>
              <ShoppingCart className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-2xl text-white font-bold relative z-10 mt-2">{stats.today}</span>
          </div>
          <div className="bg-[#0a1120] border border-gray-800/50 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider">All Time Orders</h3>
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-2xl text-white font-bold relative z-10 mt-2">{stats.allTime}</span>
          </div>
          
          <div className="bg-[#0a1120] border border-gray-800/50 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider">Distinct Agents</h3>
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-2xl text-white font-bold relative z-10 mt-2">{stats.distinctAgents}</span>
          </div>
          <div className="bg-[#0a1120] border border-gray-800/50 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider">Avg Trust Score</h3>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-2xl text-white font-bold relative z-10 mt-2">{stats.avgTrustScore}</span>
          </div>
          <div className="bg-[#0a1120] border border-rose-900/30 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-rose-400/80 text-xs font-medium uppercase tracking-wider">Blocked Attempts</h3>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <span className="text-2xl text-rose-500 font-bold relative z-10 mt-2">{stats.blockedAttempts}</span>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="bg-[#0a1120] border border-gray-800/50 rounded-2xl p-6 flex flex-col flex-1 h-[400px] shadow-xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800/50">
            <h2 className="text-xl text-white font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Live Activity Feed
            </h2>
            <a 
              href="https://dashboard.razorpay.com/app/payments" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs bg-[#111827] hover:bg-gray-800 text-gray-300 py-1.5 px-3 rounded-lg transition-colors border border-gray-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Razorpay Dashboard
            </a>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-3">
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                <AlertCircle className="w-8 h-8 opacity-20" />
                <p>Waiting for live webhook events...</p>
              </div>
            ) : (
              activities.map((act) => (
                <div key={act.id} className="bg-[#111827] border border-gray-800 rounded-lg p-4 flex items-center justify-between hover:border-gray-700 transition-colors group">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">₹{act.amount}</span>
                      <span className="text-gray-400 text-sm">from</span>
                      <span className="text-white font-medium bg-gray-800/50 px-2 py-0.5 rounded text-sm">{act.buyerAgent}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
                      <span>Order: {act.orderId}</span>
                      <span>•</span>
                      <span>Payment: {act.paymentId}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Captured
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(act.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
