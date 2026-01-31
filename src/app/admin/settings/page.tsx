'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin-sidebar';
import AdminHeader from '@/components/admin-header';
import { Settings, Save, Clock, Layers, Database, Power, Brain } from 'lucide-react';

// Common interval presets
const INTERVAL_PRESETS = [
  { label: '1 minute', value: 60, code: '1m' },
  { label: '5 minutes', value: 300, code: '5m' },
  { label: '15 minutes', value: 900, code: '15m' },
  { label: '30 minutes', value: 1800, code: '30m' },
  { label: '1 hour', value: 3600, code: '1h' },
];

export default function SystemSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [minIntervalSeconds, setMinIntervalSeconds] = useState<number>(900);
  const [maxIntervalsPerTrader, setMaxIntervalsPerTrader] = useState<number>(4);
  const [maxOptionalReadersPerTrader, setMaxOptionalReadersPerTrader] = useState<number>(5);
  const [systemEnabled, setSystemEnabled] = useState<boolean>(false);
  const [optimizationCycleHeartbeatCount, setOptimizationCycleHeartbeatCount] =
    useState<number>(10);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/system-settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      console.log('[fetchSettings] Received data:', data);
      console.log('[fetchSettings] system_enabled value:', data.data.system_enabled?.value);
      setMinIntervalSeconds(Number(data.data.min_kline_interval_seconds.value));
      setMaxIntervalsPerTrader(Number(data.data.max_intervals_per_trader.value));
      setMaxOptionalReadersPerTrader(Number(data.data.max_optional_readers_per_trader.value));
      setOptimizationCycleHeartbeatCount(
        Number(data.data.optimization_cycle_heartbeat_count?.value || '10')
      );
      const enabled = data.data.system_enabled?.value === 'true';
      console.log(
        '[fetchSettings] Setting systemEnabled to:',
        enabled,
        'from value:',
        data.data.system_enabled?.value
      );
      setSystemEnabled(enabled);
    } catch (error) {
      console.error('Error fetching settings:', error);
      showSaveMessage('error', 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      console.log(
        '[handleSave] Sending systemEnabled:',
        systemEnabled,
        'type:',
        typeof systemEnabled
      );
      const response = await fetch('/api/admin/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minKlineIntervalSeconds: minIntervalSeconds,
          maxIntervalsPerTrader,
          maxOptionalReadersPerTrader,
          systemEnabled,
          optimizationCycleHeartbeatCount,
        }),
      });

      const data = await response.json();
      console.log('[handleSave] Response:', data);

      if (data.success) {
        showSaveMessage('success', 'System settings updated successfully');
        await fetchSettings(); // Refresh to get updated values
      } else {
        showSaveMessage('error', data.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showSaveMessage('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const showSaveMessage = (type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 5000);
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#1E1E1E' }}>
        <AdminSidebar />
        <div className="ml-20">
          <AdminHeader />
          <main className="flex items-center justify-center p-8">
            <div className="text-white">Loading...</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1E1E1E' }}>
      <AdminSidebar />
      <div className="ml-20">
        <AdminHeader />

        <main className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-sky-500/20 p-2.5">
              <Settings className="h-6 w-6 text-sky-400" />
            </div>
            <h1 className="text-3xl font-bold text-white">System Settings</h1>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div
              className={`mb-6 rounded-xl border p-4 ${
                saveMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  saveMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {saveMessage.text}
              </p>
            </div>
          )}

          {/* Settings Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* System On/Off */}
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Power
                  className={`h-4 w-4 ${systemEnabled ? 'text-green-400' : 'text-gray-400'}`}
                />
                <h2 className="text-sm font-semibold text-white">System</h2>
              </div>
              <div className="mb-3 text-2xl font-bold text-white">
                {systemEnabled ? 'ON' : 'OFF'}
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={systemEnabled}
                  onChange={(e) => setSystemEnabled(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-800"></div>
              </label>
            </div>

            {/* Minimum Kline Interval */}
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">Min Kline Interval</h2>
              </div>
              <div className="mb-3 text-2xl font-bold text-white">{minIntervalSeconds}s</div>
              <div className="flex flex-wrap gap-1.5">
                {INTERVAL_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setMinIntervalSeconds(preset.value)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                      minIntervalSeconds === preset.value
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {preset.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Intervals Per Trader */}
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-white">Max Intervals</h2>
              </div>
              <div className="mb-3 text-2xl font-bold text-white">{maxIntervalsPerTrader}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMaxIntervalsPerTrader(Math.max(1, maxIntervalsPerTrader - 1))}
                  disabled={maxIntervalsPerTrader <= 1}
                  className="rounded-lg bg-gray-700/50 px-3 py-1 text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <div className="flex-1 rounded-lg border border-gray-600 bg-gray-700/50 px-2 py-1 text-center text-sm font-medium text-white">
                  {maxIntervalsPerTrader}
                </div>
                <button
                  onClick={() => setMaxIntervalsPerTrader(Math.min(10, maxIntervalsPerTrader + 1))}
                  disabled={maxIntervalsPerTrader >= 10}
                  className="rounded-lg bg-gray-700/50 px-3 py-1 text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            {/* Max Optional Readers Per Trader */}
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Database className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-white">Max Readers</h2>
              </div>
              <div className="mb-3 text-2xl font-bold text-white">
                {maxOptionalReadersPerTrader}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setMaxOptionalReadersPerTrader(Math.max(1, maxOptionalReadersPerTrader - 1))
                  }
                  disabled={maxOptionalReadersPerTrader <= 1}
                  className="rounded-lg bg-gray-700/50 px-3 py-1 text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <div className="flex-1 rounded-lg border border-gray-600 bg-gray-700/50 px-2 py-1 text-center text-sm font-medium text-white">
                  {maxOptionalReadersPerTrader}
                </div>
                <button
                  onClick={() =>
                    setMaxOptionalReadersPerTrader(Math.min(20, maxOptionalReadersPerTrader + 1))
                  }
                  disabled={maxOptionalReadersPerTrader >= 20}
                  className="rounded-lg bg-gray-700/50 px-3 py-1 text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            {/* Optimization Cycle */}
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Brain className="h-4 w-4 text-pink-400" />
                <h2 className="text-sm font-semibold text-white">Auto Optimization</h2>
              </div>
              <div className="mb-3 text-2xl font-bold text-white">
                {optimizationCycleHeartbeatCount === 0
                  ? 'OFF'
                  : `${optimizationCycleHeartbeatCount} beats`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setOptimizationCycleHeartbeatCount(
                      Math.max(0, optimizationCycleHeartbeatCount - 1)
                    )
                  }
                  disabled={optimizationCycleHeartbeatCount <= 0}
                  className="rounded-lg bg-gray-700/50 px-3 py-1 text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <div className="flex-1 rounded-lg border border-gray-600 bg-gray-700/50 px-2 py-1 text-center text-sm font-medium text-white">
                  {optimizationCycleHeartbeatCount === 0 ? 'OFF' : optimizationCycleHeartbeatCount}
                </div>
                <button
                  onClick={() =>
                    setOptimizationCycleHeartbeatCount(
                      Math.min(100, optimizationCycleHeartbeatCount + 1)
                    )
                  }
                  disabled={optimizationCycleHeartbeatCount >= 100}
                  className="rounded-lg bg-gray-700/50 px-3 py-1 text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
              {optimizationCycleHeartbeatCount > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  Traders optimize every {optimizationCycleHeartbeatCount} heartbeats
                </p>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 p-3 text-white transition-all hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20"
            >
              {saving ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Save className="h-5 w-5" />
              )}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
