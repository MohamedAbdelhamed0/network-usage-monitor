export interface ProcessLiveStats {
  pid: number;
  exe_name: string;
  exe_path: string;
  display_name: string;
  is_system_component: boolean;
  icon_base64: string | null;
  download_speed_bps: number;
  upload_speed_bps: number;
  session_download_bytes: number;
  session_upload_bytes: number;
  last_active_secs_ago: number;
}

export interface LiveSnapshot {
  total_download_speed_bps: number;
  total_upload_speed_bps: number;
  today_download_bytes: number;
  today_upload_bytes: number;
  active_processes_count: number;
  system_processes_count: number;
  is_elevated: boolean;
  processes: ProcessLiveStats[];
}

export interface DailyChartPoint {
  date: string;
  bytes_download: number;
  bytes_upload: number;
  total_bytes: number;
}

export interface HourlyChartPoint {
  hour: number;
  bytes_download: number;
  bytes_upload: number;
}

export interface TopAppItem {
  app_id: number;
  exe_name: string;
  display_name: string;
  icon_base64: string | null;
  is_system_component: boolean;
  bytes_download: number;
  bytes_upload: number;
  total_bytes: number;
  percentage: number;
}

export interface CategoryBreakdown {
  user_apps_bytes: number;
  windows_os_bytes: number;
  total_bytes: number;
  user_apps_percentage: number;
  windows_os_percentage: number;
}

export interface AnalyticsSummary {
  daily_history: DailyChartPoint[];
  top_apps: TopAppItem[];
  breakdown: CategoryBreakdown;
}

export interface DataCapSettings {
  cap_gb: number | null;
  alert_at_percent: number;
  spike_alert: boolean;
  current_month_bytes: number;
}
