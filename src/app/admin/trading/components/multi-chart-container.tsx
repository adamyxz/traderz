'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ChartCard from './chart-card';
import type { ChartConfig, ChartLayout, TradingPair, KlineInterval } from '@/lib/trading/types';

interface MultiChartContainerProps {
  pairs: TradingPair[];
  intervals: KlineInterval[];
  defaultSymbol: string;
  defaultInterval: string;
}

interface TradingLayoutConfig {
  layout: ChartLayout;
  charts: Array<{
    id: string;
    symbol: string;
    interval: string;
    isRunning: boolean;
  }>;
}

const MAX_CHARTS: Record<ChartLayout, number> = {
  '1x1': 1,
  '2x1': 2,
  '1x2': 2,
  '2x2': 4,
};

export default function MultiChartContainer({
  pairs,
  intervals,
  defaultSymbol,
  defaultInterval,
}: MultiChartContainerProps) {
  const [layout, setLayout] = useState<ChartLayout>('1x1');
  const [charts, setCharts] = useState<ChartConfig[]>([
    {
      id: 'chart-1',
      symbol: defaultSymbol,
      interval: defaultInterval,
      isRunning: true,
      connectionStatus: 'disconnected',
    },
  ]);
  const [fullscreenChartId, setFullscreenChartId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use ref to track if we're loading initial config to avoid saving during load
  const isLoadingRef = useRef(true);
  // Debounce timer for auto-save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxCharts = MAX_CHARTS[layout];

  // Load configuration from database on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/trading/config');
        if (response.ok) {
          const config: TradingLayoutConfig = await response.json();

          // Validate and set layout
          if (config.layout && MAX_CHARTS[config.layout]) {
            setLayout(config.layout);
          }

          // Validate and set charts
          if (config.charts && Array.isArray(config.charts) && config.charts.length > 0) {
            const validCharts = config.charts
              .filter((chart) => chart.symbol && chart.interval)
              .map((chart) => ({
                ...chart,
                connectionStatus: 'disconnected' as const,
              }));

            if (validCharts.length > 0) {
              setCharts(validCharts);
            }
          }
        }
      } catch (error) {
        console.error('Error loading trading config:', error);
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    };

    loadConfig();
  }, []);

  // Auto-save configuration to database whenever it changes
  // Use refs to track current values for the save function
  const layoutRef = useRef(layout);
  const chartsRef = useRef(charts);

  // Update refs when values change
  useEffect(() => {
    layoutRef.current = layout;
    chartsRef.current = charts;
  }, [layout, charts]);

  const saveConfig = useCallback(async () => {
    try {
      const configToSave: TradingLayoutConfig = {
        layout: layoutRef.current,
        charts: chartsRef.current.map((chart) => ({
          id: chart.id,
          symbol: chart.symbol,
          interval: chart.interval,
          isRunning: chart.isRunning,
        })),
      };

      await fetch('/api/trading/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSave),
      });
    } catch (error) {
      console.error('Error saving trading config:', error);
    }
  }, []);

  useEffect(() => {
    // Don't save during initial load
    if (isLoadingRef.current) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save to avoid too frequent updates
    saveTimeoutRef.current = setTimeout(() => {
      saveConfig();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [layout, charts, saveConfig]);

  const getGridClass = () => {
    switch (layout) {
      case '2x1':
        return 'grid-cols-2';
      case '1x2':
        return 'grid-rows-2';
      case '2x2':
        return 'grid-cols-2 grid-rows-2';
      default:
        return 'grid-cols-1';
    }
  };

  const handleLayoutChange = (newLayout: ChartLayout) => {
    setLayout(newLayout);
    const newMax = MAX_CHARTS[newLayout];

    // Trim charts if new layout has fewer slots
    if (charts.length > newMax) {
      setCharts((prev) => prev.slice(0, newMax));
    }
  };

  const handleAddChart = () => {
    if (charts.length >= maxCharts) return;

    const newChart: ChartConfig = {
      id: `chart-${Date.now()}`,
      symbol: defaultSymbol,
      interval: defaultInterval,
      isRunning: true,
      connectionStatus: 'disconnected',
    };

    setCharts((prev) => [...prev, newChart]);
  };

  const handleDeleteChart = (id: string) => {
    setCharts((prev) => prev.filter((chart) => chart.id !== id));
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

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-gray-800/50 p-12">
        <div className="flex items-center gap-3 text-white">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          <span>加载配置中...</span>
        </div>
      </div>
    );
  }

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
      {/* Layout Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-gray-800/50 p-3">
        {/* Layout Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">布局:</span>
          <div className="flex gap-1">
            {(['1x1', '2x1', '1x2', '2x2'] as ChartLayout[]).map((layoutOption) => (
              <button
                key={layoutOption}
                onClick={() => handleLayoutChange(layoutOption)}
                className={`
                  rounded px-3 py-1.5 text-sm font-medium transition-colors
                  ${
                    layout === layoutOption
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                  }
                `}
              >
                {layoutOption}
              </button>
            ))}
          </div>
        </div>

        {/* Add Chart Button */}
        <button
          onClick={handleAddChart}
          disabled={charts.length >= maxCharts}
          className={`
            flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
            ${
              charts.length >= maxCharts
                ? 'cursor-not-allowed bg-gray-700/30 text-gray-500'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            }
          `}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加图表 ({charts.length}/{maxCharts})
        </button>

        {/* Chart Count Info */}
        <div className="ml-auto text-xs text-gray-500">
          {charts.length} 个图表 · {layout} 布局
        </div>
      </div>

      {/* Charts Grid */}
      <div className={`grid gap-4 ${getGridClass()}`}>
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
      </div>
    </div>
  );
}
