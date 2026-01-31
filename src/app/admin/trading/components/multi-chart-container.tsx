'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Derive visible charts based on autoUpdateEnabled
  const visibleCharts = useMemo(() => {
    if (autoUpdateEnabled) {
      return charts;
    }
    return charts.filter((c) => !c.id.startsWith('auto-'));
  }, [charts, autoUpdateEnabled]);

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
      console.log(
        '[MultiChartContainer] Received auto-charts:',
        JSON.stringify(autoCharts, null, 2)
      );

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
            unrealizedPnl: number;
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

      // 按交易对中最高未实现盈亏排序，确保显示盈亏最高的图表
      newChartConfigs.sort((a, b) => {
        const aMaxPnl = Math.max(...a.positions.map((p) => p.unrealizedPnl));
        const bMaxPnl = Math.max(...b.positions.map((p) => p.unrealizedPnl));
        console.log(
          `[MultiChartContainer] Sorting: ${a.symbol} maxPnl=${aMaxPnl.toFixed(2)}, ${b.symbol} maxPnl=${bMaxPnl.toFixed(2)}`
        );
        return bMaxPnl - aMaxPnl; // 降序排序
      });

      console.log(
        '[MultiChartContainer] Sorted charts:',
        newChartConfigs.map((c) => ({
          symbol: c.symbol,
          maxPnl: Math.max(...c.positions.map((p) => p.unrealizedPnl)),
          positionsCount: c.positions.length,
        }))
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
          console.log(
            '[MultiChartContainer] Charts to add BEFORE filtering:',
            chartsToAdd.map((c) => ({
              symbol: c.symbol,
              maxPnl: Math.max(...c.positions.map((p) => p.unrealizedPnl)),
            }))
          );
          chartsToAdd = chartsToAdd.slice(0, maxAutoCharts);
          console.log(
            '[MultiChartContainer] Charts to add AFTER filtering:',
            chartsToAdd.map((c) => ({
              symbol: c.symbol,
              maxPnl: Math.max(...c.positions.map((p) => p.unrealizedPnl)),
            }))
          );
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
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchAndSetCharts = async () => {
      await fetchAutoCharts().catch((error) => {
        console.error('[MultiChartContainer] Error in fetchAutoCharts:', error);
      });
    };

    if (!autoUpdateEnabled) {
      return;
    }

    // When enabled, fetch auto-charts (synchronizes with external API)
    fetchAndSetCharts();

    // Set up periodic refresh to update rankings (every 30 seconds)
    intervalId = setInterval(() => {
      console.log('[MultiChartContainer] Periodic refresh: fetching auto-charts');
      fetchAndSetCharts();
    }, 30000); // 30 seconds

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoUpdateEnabled, fetchAutoCharts]);

  const getGridCols = () => {
    // Responsive grid: 1 col on mobile, 2 on tablet, 3 on desktop, 4 on large screens
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
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
    const fullscreenChart = visibleCharts.find((c) => c.id === fullscreenChartId);
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
        {visibleCharts.map((chart) => (
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
            group relative flex min-h-[300px] md:min-h-[400px] lg:min-h-[500px] flex-col items-center justify-center
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
