import React from 'react';
import { ShieldCheck, Cpu, Zap, Activity } from 'lucide-react';

export default function Header({ onSelectPreset, presets }) {
  return (
    <header className="border-b border-slate-800 bg-[#070d19]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-[#070d19] rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight text-white flex items-center gap-1.5">
                RAZORPAY <span className="text-blue-500 font-extrabold">AEGIS RAIL</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full uppercase">
                Track 01
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Universal Trust & Translation Gateway for AI Buyer Agents
            </p>
          </div>
        </div>

        {/* Middle/Right: Preset Scenario Selector & Server Status */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Preset Selector */}
          <div className="relative">
            <select
              onChange={(e) => {
                const selected = presets.find(p => p.id === e.target.value);
                if (selected) onSelectPreset(selected);
              }}
              defaultValue=""
              className="bg-slate-900/90 border border-slate-700/80 hover:border-blue-500/50 text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer shadow-sm"
            >
              <option value="" disabled>⚡ Load Preset Simulation Scenario...</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Test Mode Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs font-medium text-indigo-300">
            <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Test-Mode APIs</span>
          </div>

          {/* System Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs font-medium text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping-slow"></span>
            <span>Gateway Active</span>
          </div>
        </div>

      </div>
    </header>
  );
}
