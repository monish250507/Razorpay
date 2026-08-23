import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import LayerArchitectureDiagram from './components/LayerArchitectureDiagram.jsx';
import NovaSimulator from './components/NovaSimulator.jsx';
import TrustInspector from './components/TrustInspector.jsx';
import MerchantHub from './components/MerchantHub.jsx';
import AuditLedgerView from './components/AuditLedgerView.jsx';
import RazorpayModal from './components/RazorpayModal.jsx';

export default function App() {
  const [presets, setPresets] = useState([]);
  const [catalogData, setCatalogData] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [healthRes, presetsRes, catalogRes, ledgerRes] = await Promise.all([
        fetch('/api/health').catch(() => null),
        fetch('/api/simulations').catch(() => null),
        fetch('/api/catalog').catch(() => null),
        fetch('/api/ledger').catch(() => null)
      ]);

      if (healthRes?.ok) setSystemHealth(await healthRes.json());
      if (presetsRes?.ok) setPresets(await presetsRes.json());
      if (catalogRes?.ok) setCatalogData(await catalogRes.json());
      if (ledgerRes?.ok) setLedgerData(await ledgerRes.json());
    } catch (err) {
      console.error("Failed to fetch initial data", err);
    }
  };

  const handleRunSimulation = async (payload) => {
    setIsProcessing(true);
    setActiveResult(null); // Reset UI state

    try {
      const res = await fetch('/api/process-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      // Artificial delay to make UI animation feel "process-heavy" for demo purposes
      setTimeout(async () => {
        setActiveResult(data);
        setIsProcessing(false);
        // Refresh ledger
        const ledgerRes = await fetch('/api/ledger');
        if (ledgerRes.ok) setLedgerData(await ledgerRes.json());
      }, 800);
      
    } catch (err) {
      console.error("Simulation failed", err);
      setIsProcessing(false);
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
        <Header presets={presets} onSelectPreset={(p) => handleRunSimulation(p.payload)} />
      </div>

      <main className="flex-1 max-w-[1500px] w-full mx-auto p-4 sm:p-6 lg:p-8 relative z-10 flex flex-col gap-8">
        
        {/* Top: Architecture Pipeline Visualization */}
        <LayerArchitectureDiagram currentStep={isProcessing ? 'processing' : activeResult ? 'done' : 'idle'} activeResult={activeResult} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Nova Simulator & Merchant Hub */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-8">
            <div className="flex-1 min-h-[480px]">
              <NovaSimulator onRunSimulation={handleRunSimulation} presets={presets} isProcessing={isProcessing} />
            </div>
            <div className="h-[400px]">
              <MerchantHub catalogData={catalogData} />
            </div>
          </div>

          {/* Right Column: Trust Inspector & Audit Ledger */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-8">
            <div className="flex-1 min-h-[480px]">
              <TrustInspector 
                result={activeResult} 
                isProcessing={isProcessing}
                onOpenRazorpayModal={() => setShowRazorpayModal(true)} 
              />
            </div>
            <div className="h-[400px]">
              <AuditLedgerView ledgerData={ledgerData} />
            </div>
          </div>

        </div>

      </main>

      {/* Razorpay Execution Modal */}
      {showRazorpayModal && activeResult?.execution && (
        <RazorpayModal 
          execution={activeResult.execution} 
          onClose={() => setShowRazorpayModal(false)} 
        />
      )}
      
    </div>
  );
}
