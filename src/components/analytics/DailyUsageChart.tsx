import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { DailyChartPoint } from '../../types/network';
import { formatBytes } from '../../utils/formatters';

interface DailyUsageChartProps {
  data: DailyChartPoint[];
}

export const DailyUsageChart: React.FC<DailyUsageChartProps> = ({ data }) => {
  const option = useMemo(() => {
    const dates = data.map((d) => d.date);
    const downloads = data.map((d) => d.bytes_download);
    const uploads = data.map((d) => d.bytes_upload);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          if (!params || !params.length) return '';
          let total = 0;
          let res = `<div style="font-weight:700;margin-bottom:6px;color:#cbd5e1">${params[0].axisValue}</div>`;
          params.forEach((item: any) => {
            total += item.value;
            const color = item.seriesName === 'Download' ? '#06b6d4' : '#10b981';
            res += `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;margin:3px 0;">
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color}"></span>
                ${item.seriesName}
              </span>
              <strong style="font-family:monospace;color:${color}">${formatBytes(item.value)}</strong>
            </div>`;
          });
          res += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;">
            <span style="color:#94a3b8">Daily Total:</span>
            <strong style="font-family:monospace;color:#f1f5f9">${formatBytes(total)}</strong>
          </div>`;
          return res;
        },
      },
      legend: {
        right: 16,
        top: 0,
        textStyle: { color: '#94a3b8', fontSize: 11 },
        icon: 'roundRect',
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: '8%',
        top: '16%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.08)' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          rotate: data.length > 15 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (value: number) => formatBytes(value),
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.04)',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'Download',
          type: 'bar',
          stack: 'total',
          emphasis: { focus: 'series' },
          data: downloads,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#06b6d4' },
              { offset: 1, color: '#0284c7' },
            ]),
            borderRadius: [0, 0, 0, 0],
          },
        },
        {
          name: 'Upload',
          type: 'bar',
          stack: 'total',
          emphasis: { focus: 'series' },
          data: uploads,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#10b981' },
              { offset: 1, color: '#059669' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }, [data]);

  return (
    <div className="glass-card rounded-2xl p-4 flex-1">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Daily Traffic Volume
          </h3>
          <p className="text-[11px] text-slate-500">
            Aggregated daily download & upload consumption
          </p>
        </div>
      </div>

      <div className="h-60 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No historical records yet for this range. Traffic will aggregate every 60 seconds.
          </div>
        ) : (
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        )}
      </div>
    </div>
  );
};
