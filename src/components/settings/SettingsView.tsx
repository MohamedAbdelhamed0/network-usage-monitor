import { useState } from 'react';
import { HardDrive, Shield, RefreshCw, Database, Info } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface SettingsViewProps {
  isElevated: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isElevated }) => {
  const [restarting, setRestarting] = useState(false);

  const handleRestartAdmin = async () => {
    try {
      setRestarting(true);
      await invoke('restart_as_admin');
    } catch (err) {
      console.error('Failed to restart as admin:', err);
      setRestarting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Storage Architecture Info */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              3-Tier Rolling Storage Architecture
            </h3>
            <p className="text-xs text-slate-400">
              Preserves 45 days of rich analytics under 5 MB of local disk space
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
              Tier 1: Live RAM Buffer
            </span>
            <div className="text-sm font-semibold text-white">1-Second Tick</div>
            <p className="text-[11px] text-slate-400">
              Tracks live speeds in memory. Powers live scrolling charts with zero disk writes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
              Tier 2: Hourly Buckets
            </span>
            <div className="text-sm font-semibold text-white">60-Second Flush</div>
            <p className="text-[11px] text-slate-400">
              Flushes minute deltas into SQLite using SQL Upsert to track hourly peak times.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
              Tier 3: Daily Summary
            </span>
            <div className="text-sm font-semibold text-white">45-Day Rolling Rollup</div>
            <p className="text-[11px] text-slate-400">
              Stores daily totals per app. Automatically prunes rows older than 45 days.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            %APPDATA%\NetworkUsageMonitor\traffic.db
          </span>
          <span className="text-emerald-400 font-semibold">Active · WAL Mode</span>
        </div>
      </div>

      {/* Privileges & Background Service */}
      <div className="glass-card rounded-2xl p-6">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-cyan-400" />
          Windows Kernel & Security Privileges
        </h4>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">ETW Kernel Tracing</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isElevated
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isElevated ? 'Admin Privileges Active' : 'Standard User Mode'}
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              {isElevated
                ? 'Your app is capturing 100% of PC network packets directly from the Windows Kernel TCP/IP stack.'
                : 'Running in connection-polling fallback mode. To enable 100% kernel packet accuracy, restart with Administrator rights.'}
            </p>
          </div>

          {!isElevated && (
            <button
              onClick={handleRestartAdmin}
              disabled={restarting}
              className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
              <span>{restarting ? 'Relaunching...' : 'Restart as Admin'}</span>
            </button>
          )}
        </div>
      </div>

      {/* About Box */}
      <div className="glass-card rounded-2xl p-6 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <Info className="w-5 h-5 text-slate-500" />
          <div>
            <div className="font-semibold text-slate-200">Modern PC Network Usage Monitor</div>
            <div className="text-[11px] text-slate-500">
              Built with Tauri v2 + Rust + React 19 + Tailwind CSS + Apache ECharts
            </div>
          </div>
        </div>

        <div className="text-right text-[11px] font-mono text-slate-500">
          <span>Memory Footprint: ~15 MB RAM</span>
        </div>
      </div>
    </div>
  );
};
