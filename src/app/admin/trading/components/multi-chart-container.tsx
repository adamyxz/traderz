'use client';

import { useState, useEffect, useCallback } from 'react';
import ChartCard from './chart-card';
import AddChartModal from './add-chart-modal';
import { usePositionEvents } from '@/hooks/use-position-events';
import type { ChartConfig, TradingPair, KlineInterval } from '@/lib/trading/types';
import type { PositionEvent } from '@/lib/trading/position-events';

interface MultiChartContainerProps {
  pairs: TradingPair[];
  intervals: KlineInterval[];
  defaultSymbol: string;
  defaultInterval: string;
  autoUpdateEnabled: boolean;
}

export default function MultiChartContainer({
  pairs,
  intervals,
  defaultSymbol,
  defaultInterval,
  autoUpdateEnabled,
}: MultiChartContainerProps) {
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [fullscreenChartId, setFullscreenChartId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch auto-charts from API
  const fetchAutoCharts = useCallback(async () => {
    try {
      const response = await fetch('/api/trading/auto-charts');
      if (!response.ok) {
        console.error('[MultiChartContainer] Failed to fetch auto-charts');
        return;
      }

      const result = await response.json();
      if (!result.success) {
        console.error('[MultiChartContainer] API returned error:', result.error);
        return;
      }

      const autoCharts = result.data || [];

      // Create chart configs from auto-charts
      const newChartConfigs: ChartConfig[] = autoCharts.map(
        (item: {
          symbol: string;
          interval: string;
          positions: Array<{
            positionId: number;
            traderId: number;
            traderName: string;
            entryPrice: number;
            stopLossPrice: number | null;
            takeProfitPrice: number | null;
            positionSize: number;
            returnRate: number;
            side: 'long' | 'short';
          }>;
        }) => ({
          id: `auto-${item.symbol}-${item.interval}`,
          symbol: item.symbol,
          interval: item.interval,
          isRunning: true,
          connectionStatus: 'disconnected' as const,
          positions: item.positions,
        })
      );

      // Merge with existing charts, deduplicating by symbol+interval
      setCharts((prevCharts) => {
        // Keep only manual charts, remove ALL old auto-charts
        const manualCharts = prevCharts.filter((c) => !c.id.startsWith('auto-'));

        // Get existing symbol:interval keys from manual charts
        const existingKeySet = new Set(manualCharts.map((c) => `${c.symbol}:${c.interval}`));

        // Add new auto-charts only if they don't conflict with manual charts
        let chartsToAdd = newChartConfigs.filter(
          (c) => !existingKeySet.has(`${c.symbol}:${c.interval}`)
        );

        // Limit auto-charts to maximum 4
        const maxAutoCharts = 4;
        if (chartsToAdd.length > maxAutoCharts) {
          console.log(
            `[MultiChartContainer] Limiting auto-charts from ${chartsToAdd.length} to ${maxAutoCharts}`
          );
          chartsToAdd = chartsToAdd.slice(0, maxAutoCharts);
        }

        return [...manualCharts, ...chartsToAdd];
      });
    } catch (error) {
      console.error('[MultiChartContainer] Error fetching auto-charts:', error);
    }
  }, []);

  // Handle position change events
  const handlePositionChange = useCallback(
    (event: PositionEvent) => {
      if (autoUpdateEnabled) {
        console.log('[MultiChartContainer] Position changed, refreshing auto-charts:', event);
        fetchAutoCharts();
      }
    },
    [autoUpdateEnabled, fetchAutoCharts]
  );

  // SSE connection for position events
  usePositionEvents({
    enabled: autoUpdateEnabled,
    onPositionChange: handlePositionChange,
  });

  // Fetch auto-charts when auto-update is enabled
  useEffect(() => {
    if (!autoUpdateEnabled) {
      // When disabled, defer removal of auto-generated charts
      const timeoutId = setTimeout(() => {
        setCharts((prev) => prev.filter((c) => !c.id.startsWith('auto-')));
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    // When enabled, fetch auto-charts (synchronizes with external API)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAutoCharts().catch((error) => {
      console.error('[MultiChartContainer] Error in fetchAutoCharts:', error);
    });

    // Set up periodic refresh to update rankings (every 30 seconds)
    const intervalId = setInterval(() => {
      console.log('[MultiChartContainer] Periodic refresh: fetching auto-charts');
      fetchAutoCharts().catch((error) => {
        console.error('[MultiChartContainer] Error in periodic fetchAutoCharts:', error);
      });
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [autoUpdateEnabled, fetchAutoCharts]);

  const getGridCols = () => {
    const count = charts.length;
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-3';
    return 'grid-cols-4'; // 4+ charts
  };

  const handleAddChart = (symbol: string, interval: string) => {
    const newChart: ChartConfig = {
      id: `chart-${Date.now()}`,
      symbol,
      interval,
      isRunning: true, // Auto-start connection
      connectionStatus: 'disconnected',
    };

    setCharts((prev) => [...prev, newChart]);
  };

  const handleDeleteChart = (id: string) => {
    // Stop connection before deleting (will be handled by TradingChart cleanup)
    setCharts((prev) =>
      prev
        .map((chart) => (chart.id === id ? { ...chart, isRunning: false } : chart))
        .filter((chart) => chart.id !== id)
    );
    if (fullscreenChartId === id) {
      setFullscreenChartId(null);
    }
  };

  const handleConfigChange = (id: string, updates: Partial<ChartConfig>) => {
    setCharts((prev) => prev.map((chart) => (chart.id === id ? { ...chart, ...updates } : chart)));
  };

  const handleFullscreen = (id: string) => {
    setFullscreenChartId(id);
  };

  const handleExitFullscreen = () => {
    setFullscreenChartId(null);
  };

  // If a chart is in fullscreen mode, only show that chart
  if (fullscreenChartId) {
    const fullscreenChart = charts.find((c) => c.id === fullscreenChartId);
    if (!fullscreenChart) {
      setFullscreenChartId(null);
    } else {
      return (
        <ChartCard
          key={fullscreenChart.id}
          config={fullscreenChart}
          pairs={pairs}
          intervals={intervals}
          isFullscreen={true}
          onConfigChange={handleConfigChange}
          onDelete={handleDeleteChart}
          onFullscreen={handleFullscreen}
          onExitFullscreen={handleExitFullscreen}
        />
      );
    }
  }

  return (
    <div>
      {/* Charts Grid */}
      <div className={`grid gap-4 ${getGridCols()}`}>
        {charts.map((chart) => (
          <ChartCard
            key={chart.id}
            config={chart}
            pairs={pairs}
            intervals={intervals}
            isFullscreen={false}
            onConfigChange={handleConfigChange}
            onDelete={handleDeleteChart}
            onFullscreen={handleFullscreen}
            onExitFullscreen={handleExitFullscreen}
          />
        ))}

        {/* Add Chart Placeholder */}
        <button
          onClick={() => setShowAddModal(true)}
          className="
            group relative flex min-h-[200px] flex-col items-center justify-center
            rounded-lg border-2 border-dashed border-gray-700/50
            bg-gray-800/30 transition-all
            hover:border-sky-500/50 hover:bg-gray-800/50
          "
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700/50 text-gray-500 transition-colors group-hover:bg-sky-500/20 group-hover:text-sky-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <span className="mt-3 text-sm text-gray-500 transition-colors group-hover:text-gray-400">
            Add Chart
          </span>
        </button>
      </div>

      {/* Add Chart Modal */}
      <AddChartModal
        isOpen={showAddModal}
        pairs={pairs}
        intervals={intervals}
        defaultSymbol={defaultSymbol}
        defaultInterval={defaultInterval}
        onClose={() => setShowAddModal(false)}
        onConfirm={handleAddChart}
      />
    </div>
  );
}
