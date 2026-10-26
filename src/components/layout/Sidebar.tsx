import React from 'react';
import {
  Activity,
  BarChart3,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  HardDrive,
  Settings,
} from 'lucide-react';
import { formatSpeed } from '../../utils/formatters';

export type TabType = 'live' | 'analytics' | 'caps' | 'settings';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  downloadSpeed: number;
  uploadSpeed: number;
  isElevated: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  downloadSpeed,
  uploadSpeed,
  isElevated,
}) => {
  const navItems = [
    {
      id: 'live' as TabType,
      label: 'Live Monitor',
      icon: Activity,
      badge: downloadSpeed + uploadSpeed > 1024 ? 'Active' : undefined,
    },
    {
      id: 'analytics' as TabType,
      label: '45-Day Analytics',
      icon: BarChart3,
    },
    {
      id: 'caps' as TabType,
      label: 'Data Caps & Alerts',
      icon: Sliders,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings & Storage',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-white/5 flex flex-col justify-between select-none">
      <div>
        {/* App Branding */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
              <Wifi className="w-5 h-5 text-white animate-pulse-subtle" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                Network Monitor
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Windows Kernel ETW</p>
            </div>
          </div>
        </div>

        {/* Live Mini Speed Pill */}
        <div className="px-4 py-3 mx-3 my-4 rounded-xl bg-slate-900/80 border border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 flex items-center justify-between">
            <span>Live Throughput</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-medium">
              <span>↓</span>
              <span>{formatSpeed(downloadSpeed)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-medium">
              <span>↑</span>
              <span>{formatSpeed(uploadSpeed)}</span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Elevation Status */}
      <div className="p-4 border-t border-white/5 space-y-2.5">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
            isElevated
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}
        >
          {isElevated ? (
            <>
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="text-[11px] leading-tight">
                <span className="font-semibold block">Kernel Mode Active</span>
                <span className="text-emerald-400/80 text-[10px]">100% Traffic Tracked</span>
              </div>
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="text-[11px] leading-tight">
                <span className="font-semibold block">Standard User</span>
                <span className="text-amber-400/80 text-[10px]">Connection Polling</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5" />
            SQLite 45-Day Rolling
          </span>
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
