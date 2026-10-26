import React from 'react';
import { ArrowDown, ArrowUp, Activity, Cpu } from 'lucide-react';
import { formatSpeed, formatBytes } from '../../utils/formatters';

interface SpeedStatCardsProps {
  downloadSpeed: number;
  uploadSpeed: number;
  todayDownload: number;
  todayUpload: number;
  activeAppsCount: number;
  systemProcessesCount: number;
}

export const SpeedStatCards: React.FC<SpeedStatCardsProps> = ({
  downloadSpeed,
  uploadSpeed,
  todayDownload,
  todayUpload,
  activeAppsCount,
  systemProcessesCount,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Download Speed Card */}
      <div className="glass-card rounded-2xl p-4 relative overflow-hidden group transition-all glass-card-hover">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
              <ArrowDown className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Download Speed
              </span>
              <span className="text-[10px] text-slate-500">Live Inbound Throughput</span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-cyan-400 glow-cyan animate-pulse" />
        </div>

        <div className="flex items-baseline justify-between mt-2">
          <span className="text-2xl font-extrabold font-mono tracking-tight text-white">
            {formatSpeed(downloadSpeed)}
          </span>
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-medium">Today Total</span>
            <span className="text-xs font-semibold font-mono text-cyan-300">
              {formatBytes(todayDownload)}
            </span>
          </div>
        </div>
      </div>

      {/* Upload Speed Card */}
      <div className="glass-card rounded-2xl p-4 relative overflow-hidden group transition-all glass-card-hover">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <ArrowUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Upload Speed
              </span>
              <span className="text-[10px] text-slate-500">Live Outbound Throughput</span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 glow-emerald animate-pulse" />
        </div>

        <div className="flex items-baseline justify-between mt-2">
          <span className="text-2xl font-extrabold font-mono tracking-tight text-white">
            {formatSpeed(uploadSpeed)}
          </span>
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-medium">Today Total</span>
            <span className="text-xs font-semibold font-mono text-emerald-300">
              {formatBytes(todayUpload)}
            </span>
          </div>
        </div>
      </div>

      {/* Active Processes Card */}
      <div className="glass-card rounded-2xl p-4 relative overflow-hidden group transition-all glass-card-hover">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Active Processes
              </span>
              <span className="text-[10px] text-slate-500">Device Traffic Breakdown</span>
            </div>
          </div>
          <Cpu className="w-4 h-4 text-slate-500" />
        </div>

        <div className="flex items-baseline justify-between mt-2">
          <div>
            <span className="text-2xl font-extrabold font-mono tracking-tight text-white">
              {activeAppsCount}
            </span>
            <span className="text-xs text-slate-400 ml-1.5 font-medium">transmitting</span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-medium">Windows Services</span>
            <span className="text-xs font-semibold font-mono text-indigo-300">
              {systemProcessesCount} tracked
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
