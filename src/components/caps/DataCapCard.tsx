import React, { useState, useEffect } from 'react';
import { Sliders, Bell, AlertTriangle, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { invoke } from '@tauri-apps/api/core';
import { DataCapSettings } from '../../types/network';

export const DataCapCard: React.FC = () => {
  const [capGb, setCapGb] = useState<string>('500');
  const [alertAtPercent, setAlertAtPercent] = useState<number>(80);
  const [spikeAlert, setSpikeAlert] = useState<boolean>(true);
  const [currentUsageBytes, setCurrentUsageBytes] = useState<number>(0);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await invoke<DataCapSettings>('get_data_cap_settings');
      if (settings.cap_gb) {
        setCapGb(settings.cap_gb.toString());
      }
      setAlertAtPercent(settings.alert_at_percent);
      setSpikeAlert(settings.spike_alert);
      setCurrentUsageBytes(settings.current_month_bytes);
    } catch (err) {
      console.error('Failed to load data cap settings:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsed = parseFloat(capGb);
      await invoke('save_data_cap_settings', {
        capGb: isNaN(parsed) || parsed <= 0 ? null : parsed,
        alertAtPercent,
        spikeAlert,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save data cap settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const capBytes = (parseFloat(capGb) || 0) * 1024 * 1024 * 1024;
  const usagePercentage = capBytes > 0 ? Math.min(100, (currentUsageBytes / capBytes) * 100) : 0;
  const isNearLimit = usagePercentage >= alertAtPercent;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Quota Progress Overview */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Monthly Data Plan & Quota
              </h3>
              <p className="text-xs text-slate-400">
                Track bandwidth consumption against your ISP limit
              </p>
            </div>
          </div>

          {isNearLimit && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              Threshold Warning ({alertAtPercent}%)
            </span>
          )}
        </div>

        {/* Big Progress Bar */}
        <div className="space-y-2 my-4">
          <div className="flex justify-between items-baseline text-xs">
            <span className="font-semibold text-slate-300">
              Current Usage:{' '}
              <strong className="text-cyan-400 font-mono text-sm ml-1">
                {formatBytes(currentUsageBytes)}
              </strong>
            </span>
            <span className="font-semibold text-slate-400">
              Limit:{' '}
              <strong className="text-white font-mono text-sm ml-1">
                {capGb ? `${capGb} GB` : 'No Limit'}
              </strong>
            </span>
          </div>

          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                usagePercentage >= alertAtPercent
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                  : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
              }`}
              style={{ width: `${Math.max(2, usagePercentage)}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>{usagePercentage.toFixed(1)}% consumed</span>
            <span>
              {capBytes > currentUsageBytes
                ? `${formatBytes(capBytes - currentUsageBytes)} remaining`
                : 'Quota exceeded'}
            </span>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cap Input Box */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Quota Configuration
          </h4>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Monthly Data Cap (Gigabytes)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100000"
                value={capGb}
                onChange={(e) => setCapGb(e.target.value)}
                placeholder="e.g. 500"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50"
              />
              <span className="text-xs font-semibold text-slate-400 font-mono">GB</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Leave blank or set 0 to disable data cap monitoring
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Alert Warning Threshold ({alertAtPercent}%)
            </label>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={alertAtPercent}
              onChange={(e) => setAlertAtPercent(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>50%</span>
              <span>75%</span>
              <span>80%</span>
              <span>90%</span>
              <span>95%</span>
            </div>
          </div>
        </div>

        {/* Alert Toggles */}
        <div className="glass-card rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              Notifications & Spikes
            </h4>

            <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  Sudden Bandwidth Spike Alerts
                </span>
                <span className="text-[11px] text-slate-400">
                  Notify if a background app suddenly transfers &gt; 200 MB in 60 seconds
                </span>
              </div>
              <input
                type="checkbox"
                checked={spikeAlert}
                onChange={(e) => setSpikeAlert(e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-400 mt-1 cursor-pointer"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 flex items-center gap-2.5 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>
                Desktop notifications are quiet and won't interrupt full-screen games or videos.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {savedSuccess && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Settings Saved!
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-500/20 active:scale-95"
            >
              {saving ? 'Saving...' : 'Save Cap Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
