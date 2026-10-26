export function formatSpeed(bps: number): string {
  if (bps >= 1_048_576) {
    return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  }
  if (bps >= 1024) {
    return `${(bps / 1024).toFixed(1)} KB/s`;
  }
  return `${Math.round(bps)} B/s`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(i >= 3 ? 2 : 1)} ${sizes[i]}`;
}

export function formatRelativeTime(seconds: number): string {
  if (seconds < 2) return 'Active now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}
