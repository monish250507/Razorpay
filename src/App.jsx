import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import LayerArchitectureDiagram from './components/LayerArchitectureDiagram.jsx';
import NovaSimulator from './components/NovaSimulator.jsx';
import TrustInspector from './components/TrustInspector.jsx';
import MerchantHub from './components/MerchantHub.jsx';
import AuditLedgerView from './components/AuditLedgerView.jsx';
import RazorpayModal from './components/RazorpayModal.jsx';
import AttackResultPanel from './components/AttackResultPanel.jsx';
import MerchantView from './components/MerchantView.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function App() {
  const [presets, setPresets] = useState([]);
  const [catalogData, setCatalogData] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [currentView, setCurrentView] = useState('buyer');

  // Per-layer streaming state: { [layerId]: { status, data } }
  // status: "started" | "completed" | "blocked" | "skipped"
  const [layerStatuses, setLayerStatuses] = useState({});

  // Attack result panel (Prompt Injection demo)
  const [attackResult, setAttackResult] = useState(null);

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [healthRes, presetsRes, catalogRes, ledgerRes] = await Promise.all([
        fetch(`${API_BASE}/api/health`).catch(() => null),
        fetch(`${API_BASE}/api/simulations`).catch(() => null),
        fetch(`${API_BASE}/api/catalog`).catch(() => null),
        fetch(`${API_BASE}/api/ledger`).catch(() => null)
      ]);

      if (healthRes?.ok) setSystemHealth(await healthRes.json());
      if (presetsRes?.ok) setPresets(await presetsRes.json());
      if (catalogRes?.ok) setCatalogData(await catalogRes.json());
      if (ledgerRes?.ok) setLedgerData(await ledgerRes.json());
    } catch (err) {
      console.error("Failed to fetch initial data", err);
    }
  };

  /**
   * Main simulation handler — switches to streaming SSE endpoint.
   * Payload may contain `_forceFailure: true` for the Groq Outage preset;
   * that flag is stripped from the body and sent as X-Force-LLM-Failure header.
   */
  const handleRunSimulation = async (payload) => {
    setIsProcessing(true);
    setActiveResult(null);
    setLayerStatuses({});
    setAttackResult(null);

    const forceFailure = payload?._forceFailure === true;
    // Clone payload and remove internal control flag
    const cleanPayload = { ...payload };
    delete cleanPayload._forceFailure;

    const headers = { 'Content-Type': 'application/json' };
    if (forceFailure) headers['X-Force-LLM-Failure'] = 'true';

    try {
      const response = await fetch(`${API_BASE}/api/process-intent/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(cleanPayload),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE lines are separated by "\n\n"
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // keep incomplete last chunk

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;

          try {
            const json = JSON.parse(line.slice('data:'.length).trim());

            // Final "done" event — set full result
            if (json.event === 'done') {
              setActiveResult(json.data);
              setIsProcessing(false);
              // Refresh ledger
              const ledgerRes = await fetch(`${API_BASE}/api/ledger`);
              if (ledgerRes.ok) setLedgerData(await ledgerRes.json());
              continue;
            }

            // Error event
            if (json.event === 'error') {
              console.error('Pipeline error:', json.data);
              setActiveResult({ success: false, error: json.data?.error || 'Pipeline error' });
              setIsProcessing(false);
              continue;
            }

            // Per-layer event: update layerStatuses incrementally
            if (json.layerId) {
              setLayerStatuses(prev => ({
                ...prev,
                [json.layerId]: { status: json.status, data: json.data }
              }));
            }
          } catch (parseErr) {
            console.warn('Failed to parse SSE line:', line, parseErr);
          }
        }
      }
    } catch (err) {
      console.error("Simulation failed", err);
      setActiveResult({ success: false, error: err.message || "Simulation failed" });
      setIsProcessing(false);
    }
  };

  /**
   * Prompt Injection attack handler — calls /api/catalog/agentify directly
   * and surfaces the rejection result in the AttackResultPanel.
   */
  const handleCatalogAttack = async (productId, rawText) => {
    setAttackResult({ loading: true });
    setActiveResult(null);
    setLayerStatuses({});

    try {
      const res = await fetch(`${API_BASE}/api/catalog/agentify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, raw_text: rawText }),
      });
      const data = await res.json();
      setAttackResult({
        loading: false,
        type: 'prompt_injection',
        ...data,
      });
    } catch (err) {
      setAttackResult({
        loading: false,
        type: 'prompt_injection',
        success: false,
        error: err.message,
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070d19] relative">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-grid-pattern opacity-50 z-0"></div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px] animate-float"></div>
      </div>

      <div className="relative z-50">
        <Header
          presets={presets}
          currentView={currentView}
          onViewChange={setCurrentView}
          onSelectPreset={(p) => handleRunSimulation(p.payload)}
          onAttackPreset={(type, payload) => {
            if (type === 'prompt_injection') {
              handleCatalogAttack(payload.product_id, payload.raw_text);
            } else {
              handleRunSimulation(payload);
            }
          }}
        />
      </div>

      <main className="flex-1 max-w-[1500px] w-full mx-auto p-4 sm:p-6 lg:p-8 relative z-10 flex flex-col gap-8">
        
        {currentView === 'merchant' ? (
          <MerchantView 
            catalogData={catalogData} 
            onCatalogUpdate={async () => {
              const res = await fetch(`${API_BASE}/api/catalog`);
              if (res.ok) setCatalogData(await res.json());
            }}
          />
        ) : (
          <>
            {/* Top: Architecture Pipeline Visualization */}
            <LayerArchitectureDiagram
              layerStatuses={layerStatuses}
              activeResult={activeResult}
              isProcessing={isProcessing}
            />

            {/* Attack Result Panel (Prompt Injection demo) */}
            {attackResult && (
              <AttackResultPanel
                result={attackResult}
                onClose={() => setAttackResult(null)}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Nova Simulator */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-8">
                <div className="flex-1 min-h-[480px]">
                  <NovaSimulator onRunSimulation={handleRunSimulation} presets={presets} isProcessing={isProcessing} catalogData={catalogData} />
                </div>
              </div>

              {/* Right Column: Trust Inspector & Audit Ledger */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-8">
                <div className="flex-1 min-h-[480px]">
                  <TrustInspector
                    result={activeResult}
                    isProcessing={isProcessing}
                    layerStatuses={layerStatuses}
                    onOpenRazorpayModal={() => setShowRazorpayModal(true)}
                  />
                </div>
                <div className="h-[400px]">
                  <AuditLedgerView ledgerData={ledgerData} />
                </div>
              </div>

            </div>
          </>
        )}

      </main>

      {/* Razorpay Execution Modal */}
      {showRazorpayModal && activeResult?.execution && (
        <RazorpayModal 
          execution={activeResult.execution} 
          onClose={() => {
            setShowRazorpayModal(false);
            // Refresh ledger in case webhook wrote something
            fetch(`${API_BASE}/api/ledger`).then(r => r.ok && r.json()).then(setLedgerData).catch(()=>{});
          }}
          onFallback={(reason) => {
            // Update the activeResult to show fallback UI in TrustInspector
            setActiveResult(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                fallback: { fallbackPaymentLink: prev.execution.paymentShortUrl, reason: reason }
              };
            });
            setShowRazorpayModal(false);
          }}
        />
      )}
      
    </div>
  );
}
