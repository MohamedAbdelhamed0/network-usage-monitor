import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { CategoryBreakdown } from '../../types/network';
import { formatBytes } from '../../utils/formatters';
import { Layers, Shield } from 'lucide-react';

interface DonutBreakdownProps {
  breakdown: CategoryBreakdown;
}

export const DonutBreakdown: React.FC<DonutBreakdownProps> = ({ breakdown }) => {
  const option = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          return `<div style="font-weight:700;color:#cbd5e1;margin-bottom:4px;">${params.name}</div>
          <div style="font-family:monospace;color:#38bdf8;">${formatBytes(params.value)} (${params.percent}%)</div>`;
        },
      },
      legend: {
        show: false,
      },
      series: [
        {
          name: 'Traffic Source',
          type: 'pie',
          radius: ['55%', '80%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#0f172a',
            borderWidth: 3,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: false,
            },
          },
          data: [
            {
              value: breakdown.user_apps_bytes,
              name: 'User Applications',
              itemStyle: { color: '#06b6d4' },
            },
            {
              value: breakdown.windows_os_bytes,
              name: 'Windows OS & Services',
              itemStyle: { color: '#6366f1' },
            },
          ],
        },
      ],
    };
  }, [breakdown]);

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col justify-between w-full md:w-72">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Source Breakdown
        </h3>
        <p className="text-[11px] text-slate-500">Apps vs Windows System Services</p>
      </div>

      <div className="h-44 w-full relative my-1">
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] text-slate-400 font-medium">Total</span>
          <span className="text-sm font-bold font-mono text-white">
            {formatBytes(breakdown.total_bytes)}
          </span>
        </div>
      </div>

      {/* Breakdown Legend items */}
      <div className="space-y-2 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span className="flex items-center gap-1 font-medium">
              <Layers className="w-3 h-3 text-cyan-400" /> User Apps
            </span>
          </div>
          <div className="text-right font-mono">
            <span className="text-cyan-300 font-semibold mr-1.5">
              {breakdown.user_apps_percentage}%
            </span>
            <span className="text-[11px] text-slate-500">
              ({formatBytes(breakdown.user_apps_bytes)})
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span className="flex items-center gap-1 font-medium">
              <Shield className="w-3 h-3 text-indigo-400" /> Windows OS
            </span>
          </div>
          <div className="text-right font-mono">
            <span className="text-indigo-300 font-semibold mr-1.5">
              {breakdown.windows_os_percentage}%
            </span>
            <span className="text-[11px] text-slate-500">
              ({formatBytes(breakdown.windows_os_bytes)})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
