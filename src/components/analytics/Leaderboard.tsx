import React, { useState } from 'react';
import { TopAppItem, HourlyChartPoint } from '../../types/network';
import { formatBytes } from '../../utils/formatters';
import { AppIcon } from '../common/AppIcon';
import { Trophy, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface LeaderboardProps {
  topApps: TopAppItem[];
  selectedDate: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ topApps, selectedDate }) => {
  const [expandedAppId, setExpandedAppId] = useState<number | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyChartPoint[] | null>(null);
  const [loadingHourly, setLoadingHourly] = useState(false);

  const toggleExpand = async (appId: number) => {
    if (expandedAppId === appId) {
      setExpandedAppId(null);
      setHourlyData(null);
      return;
    }

    setExpandedAppId(appId);
    setLoadingHourly(true);
    try {
      const data = await invoke<HourlyChartPoint[]>('get_app_hourly_breakdown', {
        appId,
        date: selectedDate,
      });
      setHourlyData(data);
    } catch (err) {
      console.error('Failed to load hourly breakdown:', err);
      setHourlyData(null);
    } finally {
      setLoadingHourly(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Trophy className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Top Data Consumers Leaderboard
            </h3>
            <p className="text-[11px] text-slate-500">
              Ranked by total bandwidth in selected time window
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {topApps.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No top consumer data recorded in this period yet.
          </div>
        ) : (
          topApps.map((app, index) => {
            const isExpanded = expandedAppId === app.app_id;
            const rank = index + 1;

            return (
              <div
                key={app.app_id}
                className="rounded-xl border border-white/5 bg-[#0a0f1d]/60 hover:bg-[#0a0f1d]/90 transition-all overflow-hidden"
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(app.app_id)}
                  className="p-3 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                    {/* Rank Badge */}
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold font-mono ${
                        rank === 1
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : rank === 2
                          ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30'
                          : rank === 3
                          ? 'bg-amber-700/20 text-amber-400 border border-amber-700/30'
                          : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      {rank}
                    </div>

                    <AppIcon
                      name={app.exe_name}
                      isSystem={app.is_system_component}
                      iconBase64={app.icon_base64}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                          {app.display_name}
                        </span>
                        {app.is_system_component ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            OS
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            App
                          </span>
                        )}
                      </div>

                      {/* Percentage Bar */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(2, app.percentage))}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 font-semibold w-10 text-right">
                          {app.percentage}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side stats */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono text-white">
                        {formatBytes(app.total_bytes)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        ↓ {formatBytes(app.bytes_download)} · ↑ {formatBytes(app.bytes_upload)}
                      </div>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                    )}
                  </div>
                </div>

                {/* Expanded 24-Hour Distribution Histogram */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-white/5 bg-[#080c14]/50">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        24-Hour Activity Profile ({selectedDate})
                      </span>
                      <span className="text-[10px] text-slate-500">Hourly breakdown</span>
                    </div>

                    {loadingHourly ? (
                      <div className="py-4 text-center text-xs text-slate-500">
                        Loading hourly pattern...
                      </div>
                    ) : hourlyData ? (
                      <div className="space-y-1">
                        <div className="grid grid-cols-24 gap-1 h-14 items-end">
                          {hourlyData.map((point) => {
                            const total = point.bytes_download + point.bytes_upload;
                            // max height calculation
                            const maxVal = Math.max(...hourlyData.map((p) => p.bytes_download + p.bytes_upload), 1);
                            const heightPct = Math.round((total / maxVal) * 100);

                            return (
                              <div
                                key={point.hour}
                                className="flex flex-col items-center group/bar relative"
                                title={`${point.hour}:00 - ${formatBytes(total)} (Down: ${formatBytes(point.bytes_download)}, Up: ${formatBytes(point.bytes_upload)})`}
                              >
                                <div
                                  className="w-full rounded-t-sm bg-gradient-to-t from-cyan-600 to-cyan-400 group-hover/bar:from-cyan-400 group-hover/bar:to-white transition-all"
                                  style={{ height: `${Math.max(4, heightPct)}%` }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono px-0.5">
                          <span>00:00</span>
                          <span>06:00</span>
                          <span>12:00</span>
                          <span>18:00</span>
                          <span>23:00</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-xs text-slate-500">
                        No activity recorded on this date.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
