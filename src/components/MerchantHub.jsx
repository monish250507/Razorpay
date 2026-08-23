import React, { useState } from 'react';
import { Store, Code, CheckCircle, Package, Tag, ShieldCheck } from 'lucide-react';

export default function MerchantHub({ catalogData }) {
  const [activeTab, setActiveTab] = useState('products');

  const products = catalogData?.products || [];
  const mcpSchema = catalogData?.mcpSchema || {};

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col h-full space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Store className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Merchant Hub: Meera's Handmade Candles</h2>
            <p className="text-[11px] text-slate-400">Layer 2 Catalog Agentification & Machine-Readable Feed</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-semibold text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>AEGIS Agent-Ready</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'products'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Agent-Queryable Catalog ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('mcp')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'mcp'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>Exposed MCP Tool Schema</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'products' ? (
        <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-1">
          {products.map(p => (
            <div key={p.id} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-100">{p.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{p.description}</p>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <div className="text-sm font-extrabold text-blue-400">₹{p.price}</div>
                  <span className="text-[10px] text-emerald-400 font-medium">In Stock ({p.stock})</span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                <div className="flex gap-1 flex-wrap">
                  {p.tags.map((t, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">
                      #{t}
                    </span>
                  ))}
                </div>
                <span className="text-slate-500 font-mono">{p.id}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto max-h-[300px]">
          <pre className="text-[11px] font-mono text-cyan-300 leading-relaxed">
            {JSON.stringify(mcpSchema, null, 2)}
          </pre>
        </div>
      )}

    </div>
  );
}
