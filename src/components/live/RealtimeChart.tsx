import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { formatSpeed } from '../../utils/formatters';

interface RealtimeChartProps {
  historyData: {
    time: string;
    download: number;
    upload: number;
  }[];
}

export const RealtimeChart: React.FC<RealtimeChartProps> = ({ historyData }) => {
  const option = useMemo(() => {
    const times = historyData.map((d) => d.time);
    const downloadSpeeds = historyData.map((d) => d.download);
    const uploadSpeeds = historyData.map((d) => d.upload);

    return {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          if (!params || !params.length) return '';
          let res = `<div style="font-weight:600;margin-bottom:4px;color:#94a3b8">${params[0].axisValue}</div>`;
          params.forEach((item: any) => {
            const color = item.seriesName === 'Download' ? '#06b6d4' : '#10b981';
            const val = formatSpeed(item.value);
            res += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin:2px 0;">
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
                ${item.seriesName}
              </span>
              <strong style="font-family:monospace;color:${color}">${val}</strong>
            </div>`;
          });
          return res;
        },
      },
      legend: {
        right: 16,
        top: 0,
        textStyle: { color: '#94a3b8', fontSize: 11 },
        icon: 'circle',
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
        boundaryGap: false,
        data: times,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.08)' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          interval: 9, // show roughly every 10 seconds
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (value: number) => formatSpeed(value),
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
          type: 'line',
          smooth: 0.35,
          showSymbol: false,
          data: downloadSpeeds,
          lineStyle: {
            width: 2.5,
            color: '#06b6d4',
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(6, 182, 212, 0.35)' },
              { offset: 1, color: 'rgba(6, 182, 212, 0.0)' },
            ]),
          },
        },
        {
          name: 'Upload',
          type: 'line',
          smooth: 0.35,
          showSymbol: false,
          data: uploadSpeeds,
          lineStyle: {
            width: 2.5,
            color: '#10b981',
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.35)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
            ]),
          },
        },
      ],
    };
  }, [historyData]);

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Real-Time Bandwidth Stream
          </h3>
          <p className="text-[11px] text-slate-500">60-second live scrolling throughput</p>
        </div>
      </div>
      <div className="h-48 w-full">
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  );
};
