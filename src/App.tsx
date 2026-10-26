import { useState, useEffect } from 'react';
import { Sidebar, TabType } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { SpeedStatCards } from './components/live/SpeedStatCards';
import { RealtimeChart } from './components/live/RealtimeChart';
import { ProcessTable } from './components/live/ProcessTable';
import { TimeFilterPills } from './components/analytics/TimeFilterPills';
import { DailyUsageChart } from './components/analytics/DailyUsageChart';
import { DonutBreakdown } from './components/analytics/DonutBreakdown';
import { Leaderboard } from './components/analytics/Leaderboard';
import { DataCapCard } from './components/caps/DataCapCard';
import { SettingsView } from './components/settings/SettingsView';
import { LiveSnapshot, AnalyticsSummary } from './types/network';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('live');

  // Live monitor state
  const [snapshot, setSnapshot] = useState<LiveSnapshot>({
    total_download_speed_bps: 0,
    total_upload_speed_bps: 0,
    today_download_bytes: 0,
    today_upload_bytes: 0,
    active_processes_count: 0,
    system_processes_count: 0,
    is_elevated: false,
    processes: [],
  });

  // 60-second live chart stream buffer
  const [chartHistory, setChartHistory] = useState<
    { time: string; download: number; upload: number }[]
  >(() => {
    const initial = [];
    const now = new Date();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 1000);
      initial.push({
        time: d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        download: 0,
        upload: 0,
      });
    }
    return initial;
  });

  // Analytics state
  const [analyticsDays, setAnalyticsDays] = useState<number>(7);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);
  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch initial snapshot on mount
  useEffect(() => {
    invoke<LiveSnapshot>('get_live_snapshot')
      .then((data) => {
        setSnapshot(data);
      })
      .catch((err) => console.error('Failed to get initial snapshot:', err));

    // Listen to 1-second live ticks from Rust
    let unlistenFn: (() => void) | undefined;
    listen<LiveSnapshot>('network-tick', (event) => {
      const data = event.payload;
      setSnapshot(data);

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setChartHistory((prev) => {
        const next = [
          ...prev.slice(1),
          {
            time: timeStr,
            download: data.total_download_speed_bps,
            upload: data.total_upload_speed_bps,
          },
        ];
        return next;
      });
    }).then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // Fetch analytics summary when tab is 'analytics' or range changes
  useEffect(() => {
    if (currentTab === 'analytics') {
      fetchAnalytics(analyticsDays);
    }
  }, [currentTab, analyticsDays]);

  const fetchAnalytics = async (days: number) => {
    setLoadingAnalytics(true);
    try {
      const data = await invoke<AnalyticsSummary>('get_analytics_summary', { days });
      setAnalyticsData(data);
    } catch (err) {
      console.error('Failed to load analytics summary:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const getHeaderInfo = () => {
    switch (currentTab) {
      case 'live':
        return {
          title: 'Real-Time Network Dashboard',
          subtitle: 'Live throughput per process and device total',
        };
      case 'analytics':
        return {
          title: 'Historical Network Analytics',
          subtitle: '45-day rolling usage patterns and top consumers',
        };
      case 'caps':
        return {
          title: 'Data Caps & Quota Management',
          subtitle: 'Configure bandwidth limits and spike warnings',
        };
      case 'settings':
        return {
          title: 'System Settings & Storage Engine',
          subtitle: 'Rolling SQLite database details and privileges',
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#080c14] text-slate-100 select-none">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        downloadSpeed={snapshot.total_download_speed_bps}
        uploadSpeed={snapshot.total_upload_speed_bps}
        isElevated={snapshot.is_elevated}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          activeAppsCount={snapshot.active_processes_count}
          isElevated={snapshot.is_elevated}
        />

        <main className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* VIEW 1: LIVE MONITOR */}
          {currentTab === 'live' && (
            <div className="space-y-5">
              <SpeedStatCards
                downloadSpeed={snapshot.total_download_speed_bps}
                uploadSpeed={snapshot.total_upload_speed_bps}
                todayDownload={snapshot.today_download_bytes}
                todayUpload={snapshot.today_upload_bytes}
                activeAppsCount={snapshot.active_processes_count}
                systemProcessesCount={snapshot.system_processes_count}
              />

              <RealtimeChart historyData={chartHistory} />

              <ProcessTable processes={snapshot.processes} />
            </div>
          )}

          {/* VIEW 2: 45-DAY ANALYTICS */}
          {currentTab === 'analytics' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <TimeFilterPills
                  selectedDays={analyticsDays}
                  onSelectDays={setAnalyticsDays}
                />
                <button
                  onClick={() => fetchAnalytics(analyticsDays)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/5 hover:border-cyan-500/30 text-xs font-semibold text-slate-300 hover:text-white transition-all"
                >
                  {loadingAnalytics ? 'Refreshing...' : 'Refresh History'}
                </button>
              </div>

              {/* Upper row: Daily Bar Chart + Donut Breakdown */}
              <div className="flex flex-col lg:flex-row gap-5">
                <DailyUsageChart data={analyticsData?.daily_history || []} />
                <DonutBreakdown
                  breakdown={
                    analyticsData?.breakdown || {
                      user_apps_bytes: 0,
                      windows_os_bytes: 0,
                      total_bytes: 0,
                      user_apps_percentage: 0,
                      windows_os_percentage: 0,
                    }
                  }
                />
              </div>

              {/* Lower row: Top Data Consumers Leaderboard */}
              <Leaderboard
                topApps={analyticsData?.top_apps || []}
                selectedDate={todayStr}
              />
            </div>
          )}

          {/* VIEW 3: DATA CAPS & ALERTS */}
          {currentTab === 'caps' && <DataCapCard />}

          {/* VIEW 4: SETTINGS & STORAGE */}
          {currentTab === 'settings' && (
            <SettingsView isElevated={snapshot.is_elevated} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
