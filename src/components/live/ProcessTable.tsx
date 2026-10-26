import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Filter, Shield, Layers } from 'lucide-react';
import { ProcessLiveStats } from '../../types/network';
import { formatSpeed, formatBytes, formatRelativeTime } from '../../utils/formatters';
import { AppIcon } from '../common/AppIcon';

interface ProcessTableProps {
  processes: ProcessLiveStats[];
}

type SortField = 'speed' | 'total' | 'name';

export const ProcessTable: React.FC<ProcessTableProps> = ({ processes }) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'user' | 'system'>('all');
  const [sortField, setSortField] = useState<SortField>('speed');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    return processes.filter((proc) => {
      // Search filter
      const matchesSearch =
        proc.display_name.toLowerCase().includes(search.toLowerCase()) ||
        proc.exe_name.toLowerCase().includes(search.toLowerCase()) ||
        proc.pid.toString().includes(search);

      if (!matchesSearch) return false;

      // Category filter
      if (filterType === 'user') return !proc.is_system_component;
      if (filterType === 'system') return proc.is_system_component;
      return true;
    });
  }, [processes, search, filterType]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'speed') {
        const speedA = a.download_speed_bps + a.upload_speed_bps;
        const speedB = b.download_speed_bps + b.upload_speed_bps;
        comparison = speedB - speedA;
      } else if (sortField === 'total') {
        const totalA = a.session_download_bytes + a.session_upload_bytes;
        const totalB = b.session_download_bytes + b.session_upload_bytes;
        comparison = totalB - totalA;
      } else {
        comparison = a.display_name.localeCompare(b.display_name);
      }
      return sortAsc ? -comparison : comparison;
    });
  }, [filtered, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col flex-1">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 bg-[#0a0f1d]/50">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Active Processes
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/5 text-slate-400">
            {sorted.length} shown
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-white/5 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterType === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('user')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                filterType === 'user'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              User Apps
            </button>
            <button
              onClick={() => setFilterType('system')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                filterType === 'system'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3 h-3" />
              Windows OS
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search process or PID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-44 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all font-sans"
            />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto flex-1 max-h-[340px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#0f172a]/70 text-[11px] uppercase tracking-wider text-slate-400 sticky top-0 z-10 backdrop-blur-md border-b border-white/5">
            <tr>
              <th
                onClick={() => toggleSort('name')}
                className="py-2.5 px-4 font-semibold cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Application</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-4 font-semibold">Category</th>
              <th
                onClick={() => toggleSort('speed')}
                className="py-2.5 px-4 font-semibold cursor-pointer hover:text-white transition-colors text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Current Speed</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('total')}
                className="py-2.5 px-4 font-semibold cursor-pointer hover:text-white transition-colors text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Session Usage</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-4 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Filter className="w-6 h-6 text-slate-600" />
                    <span>No matching active processes transmitting data</span>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((proc) => {
                const isTransmitting =
                  proc.download_speed_bps > 0 || proc.upload_speed_bps > 0;
                const totalSession =
                  proc.session_download_bytes + proc.session_upload_bytes;

                return (
                  <tr
                    key={proc.pid}
                    className="hover:bg-white/[0.03] transition-colors group"
                  >
                    {/* Application Info */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-3">
                        <AppIcon
                          name={proc.exe_name}
                          isSystem={proc.is_system_component}
                          iconBase64={proc.icon_base64}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate max-w-[200px] flex items-center gap-2">
                            <span>{proc.display_name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              PID {proc.pid}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate max-w-[220px]">
                            {proc.exe_name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-4">
                      {proc.is_system_component ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          <Shield className="w-2.5 h-2.5" />
                          Windows OS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          <Layers className="w-2.5 h-2.5" />
                          User App
                        </span>
                      )}
                    </td>

                    {/* Current Live Speed */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="font-mono text-xs">
                        <div className="text-cyan-400 font-medium">
                          ↓ {formatSpeed(proc.download_speed_bps)}
                        </div>
                        <div className="text-emerald-400 font-medium text-[11px]">
                          ↑ {formatSpeed(proc.upload_speed_bps)}
                        </div>
                      </div>
                    </td>

                    {/* Session Total Usage */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="font-mono text-xs font-semibold text-slate-200">
                        {formatBytes(totalSession)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        ↓ {formatBytes(proc.session_download_bytes)} · ↑{' '}
                        {formatBytes(proc.session_upload_bytes)}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isTransmitting
                              ? 'bg-emerald-400 animate-pulse glow-emerald'
                              : 'bg-slate-600'
                          }`}
                        />
                        <span className="text-[11px] text-slate-400">
                          {formatRelativeTime(proc.last_active_secs_ago)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
