import { useState } from 'react';
import { ShieldAlert, RefreshCw, Radio } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface HeaderProps {
  title: string;
  subtitle: string;
  activeAppsCount: number;
  isElevated: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  activeAppsCount,
  isElevated,
}) => {
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
    <header className="h-16 px-6 border-b border-white/5 bg-[#080c14]/80 backdrop-blur-md flex items-center justify-between select-none">
      <div>
        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          {title}
        </h2>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Active apps pulse pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/5 text-xs text-slate-300">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>
            <strong className="text-cyan-300 font-mono">{activeAppsCount}</strong> processes active
          </span>
        </div>

        {/* Elevation Banner / Action */}
        {!isElevated && (
          <button
            onClick={handleRestartAdmin}
            disabled={restarting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold transition-all shadow-sm"
            title="Administrator privileges are required for 100% kernel ETW packet capture"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>{restarting ? 'Elevating...' : 'Restart as Administrator'}</span>
            <RefreshCw className={`w-3 h-3 text-amber-400 ${restarting ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
};
