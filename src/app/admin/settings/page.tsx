'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin-sidebar';
import AdminHeader from '@/components/admin-header';
import { Settings, Save, Clock, Layers, Database } from 'lucide-react';

interface SystemSettings {
  min_kline_interval_seconds: {
    value: string;
    description: string | null;
  };
  max_intervals_per_trader: {
    value: string;
    description: string | null;
  };
  max_optional_readers_per_trader: {
    value: string;
    description: string | null;
  };
}

// Common interval presets
const INTERVAL_PRESETS = [
  { label: '1 minute', value: 60, code: '1m' },
  { label: '5 minutes', value: 300, code: '5m' },
  { label: '15 minutes', value: 900, code: '15m' },
  { label: '30 minutes', value: 1800, code: '30m' },
  { label: '1 hour', value: 3600, code: '1h' },
];

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [minIntervalSeconds, setMinIntervalSeconds] = useState<number>(900);
  const [maxIntervalsPerTrader, setMaxIntervalsPerTrader] = useState<number>(4);
  const [maxOptionalReadersPerTrader, setMaxOptionalReadersPerTrader] = useState<number>(5);
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
      setSettings(data.data);
      setMinIntervalSeconds(Number(data.data.min_kline_interval_seconds.value));
      setMaxIntervalsPerTrader(Number(data.data.max_intervals_per_trader.value));
      setMaxOptionalReadersPerTrader(Number(data.data.max_optional_readers_per_trader.value));
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
      const response = await fetch('/api/admin/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minKlineIntervalSeconds: minIntervalSeconds,
          maxIntervalsPerTrader,
          maxOptionalReadersPerTrader,
        }),
      });

      const data = await response.json();

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

  const getCurrentIntervalLabel = () => {
    const preset = INTERVAL_PRESETS.find((p) => p.value === minIntervalSeconds);
    return preset ? `${preset.label} (${preset.code})` : `${minIntervalSeconds} seconds`;
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
            <div>
              <h1 className="text-3xl font-bold text-white">System Settings</h1>
              <p className="text-sm text-gray-400">Configure system-wide parameters and defaults</p>
            </div>
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
          <div className="space-y-6">
            {/* Minimum Kline Interval Setting */}
            <div className="rounded-2xl border border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 p-6">
              <div className="mb-6 flex items-start gap-3">
                <div className="rounded-lg bg-emerald-500/20 p-2">
                  <Clock className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">Minimum Kline Interval</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Set the minimum time interval allowed for trader generation
                  </p>
                </div>
              </div>

              {/* Current Value Display */}
              <div className="mb-4 rounded-lg bg-gray-900/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Current Minimum</p>
                    <p className="text-2xl font-bold text-white">{getCurrentIntervalLabel()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Seconds</p>
                    <p className="text-lg font-semibold text-sky-400">{minIntervalSeconds}s</p>
                  </div>
                </div>
              </div>

              {/* Interval Presets */}
              <div className="mb-4">
                <label className="mb-3 block text-sm font-medium text-gray-300">
                  Quick Select Preset
                </label>
                <div className="flex flex-wrap gap-2">
                  {INTERVAL_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setMinIntervalSeconds(preset.value)}
                      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                        minIntervalSeconds === preset.value
                          ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              {settings?.min_kline_interval_seconds?.description && (
                <div className="rounded-lg bg-gray-900/30 p-3">
                  <p className="text-xs text-gray-500">
                    ℹ️ {settings.min_kline_interval_seconds.description}
                  </p>
                </div>
              )}
            </div>

            {/* Max Intervals Per Trader */}
            <div className="rounded-2xl border border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 p-6">
              <div className="mb-6 flex items-start gap-3">
                <div className="rounded-lg bg-purple-500/20 p-2">
                  <Layers className="h-5 w-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">Max Intervals Per Trader</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Maximum number of kline intervals each trader can use
                  </p>
                </div>
              </div>

              {/* Current Value Display */}
              <div className="mb-4 rounded-lg bg-gray-900/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Current Maximum</p>
                    <p className="text-2xl font-bold text-white">
                      {maxIntervalsPerTrader} intervals
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Range</p>
                    <p className="text-lg font-semibold text-purple-400">1-10</p>
                  </div>
                </div>
              </div>

              {/* Value Input with Buttons */}
              <div className="mb-4">
                <label className="mb-3 block text-sm font-medium text-gray-300">
                  Set Maximum Intervals
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setMaxIntervalsPerTrader(Math.max(1, maxIntervalsPerTrader - 1))}
                    disabled={maxIntervalsPerTrader <= 1}
                    className="rounded-lg bg-gray-700/50 px-4 py-2.5 text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <div className="flex-1 rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-2.5 text-center">
                    <span className="text-xl font-bold text-white">{maxIntervalsPerTrader}</span>
                  </div>
                  <button
                    onClick={() =>
                      setMaxIntervalsPerTrader(Math.min(10, maxIntervalsPerTrader + 1))
                    }
                    disabled={maxIntervalsPerTrader >= 10}
                    className="rounded-lg bg-gray-700/50 px-4 py-2.5 text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Description */}
              {settings?.max_intervals_per_trader?.description && (
                <div className="rounded-lg bg-gray-900/30 p-3">
                  <p className="text-xs text-gray-500">
                    ℹ️ {settings.max_intervals_per_trader.description}
                  </p>
                </div>
              )}
            </div>

            {/* Max Optional Readers Per Trader */}
            <div className="rounded-2xl border border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 p-6">
              <div className="mb-6 flex items-start gap-3">
                <div className="rounded-lg bg-orange-500/20 p-2">
                  <Database className="h-5 w-5 text-orange-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">Max Optional Readers Per Trader</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Maximum number of optional (non-mandatory) data readers each trader can connect
                    to
                  </p>
                </div>
              </div>

              {/* Current Value Display */}
              <div className="mb-4 rounded-lg bg-gray-900/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Current Maximum</p>
                    <p className="text-2xl font-bold text-white">
                      {maxOptionalReadersPerTrader} readers
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Range</p>
                    <p className="text-lg font-semibold text-orange-400">1-20</p>
                  </div>
                </div>
              </div>

              {/* Value Input with Buttons */}
              <div className="mb-4">
                <label className="mb-3 block text-sm font-medium text-gray-300">
                  Set Maximum Optional Readers
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() =>
                      setMaxOptionalReadersPerTrader(Math.max(1, maxOptionalReadersPerTrader - 1))
                    }
                    disabled={maxOptionalReadersPerTrader <= 1}
                    className="rounded-lg bg-gray-700/50 px-4 py-2.5 text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <div className="flex-1 rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-2.5 text-center">
                    <span className="text-xl font-bold text-white">
                      {maxOptionalReadersPerTrader}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setMaxOptionalReadersPerTrader(Math.min(20, maxOptionalReadersPerTrader + 1))
                    }
                    disabled={maxOptionalReadersPerTrader >= 20}
                    className="rounded-lg bg-gray-700/50 px-4 py-2.5 text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Description */}
              {settings?.max_optional_readers_per_trader?.description && (
                <div className="rounded-lg bg-gray-900/30 p-3">
                  <p className="text-xs text-gray-500">
                    ℹ️ {settings.max_optional_readers_per_trader.description}
                  </p>
                </div>
              )}
            </div>

            {/* Impact Warning */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
              <h3 className="text-lg font-semibold text-amber-400 mb-3">Impact & Considerations</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>
                    <strong className="text-white">Trader Generation:</strong> AI will respect these
                    limits when creating new trader configurations
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>
                    <strong className="text-white">Mandatory Readers:</strong> Readers marked as
                    mandatory are always included in heartbeats, regardless of trader association
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>
                    <strong className="text-white">Optional Readers:</strong> The limit above only
                    applies to optional (non-mandatory) readers that traders can choose to associate
                    with
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>
                    <strong className="text-white">Performance:</strong> More intervals and readers
                    increase data processing load and system resource usage
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>
                    <strong className="text-white">Strategy:</strong> Conservative limits (2-3
                    intervals, 2-4 optional readers) are typically sufficient for most trading
                    strategies
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 font-medium text-white transition-all hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
