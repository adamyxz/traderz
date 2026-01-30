'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin-sidebar';
import AdminHeader from '@/components/admin-header';
import MultiChartContainer from './components/multi-chart-container';
import { TimelineVisualization } from '@/components/timeline/TimelineVisualization';
import type { TradingPair, KlineInterval } from '@/lib/trading/types';

export default function TradingPage() {
  const [selectedPair, setSelectedPair] = useState('BTCUSDT');
  const [selectedInterval, setSelectedInterval] = useState('1m');
  const [pairs, setPairs] = useState<TradingPair[]>([]);
  const [intervals, setIntervals] = useState<KlineInterval[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineEnabled, setTimelineEnabled] = useState(false);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);

  // Auto-update is always enabled when timeline is enabled
  useEffect(() => {
    setAutoUpdateEnabled(timelineEnabled);
  }, [timelineEnabled]);

  // Fetch timeline config on mount
  useEffect(() => {
    const fetchTimelineConfig = async () => {
      try {
        const response = await fetch('/api/admin/timeline/config');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTimelineEnabled(data.data.enabled);
          }
        }
      } catch (error) {
        console.error('Error fetching timeline config:', error);
      }
    };

    fetchTimelineConfig();
  }, []);

  // Fetch trading pairs and intervals on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Sync trading pairs from Binance on first load
        await fetch('/api/trading/sync-pairs', { method: 'POST' });

        // Fetch pairs and intervals
        const [pairsRes, intervalsRes] = await Promise.all([
          fetch('/api/trading/pairs'),
          fetch('/api/trading/intervals'),
        ]);

        if (!pairsRes.ok || !intervalsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const pairsData = await pairsRes.json();
        const intervalsData = await intervalsRes.json();

        setPairs(pairsData);
        setIntervals(intervalsData);

        // Set default to first pair if available
        if (pairsData.length > 0) {
          setSelectedPair(pairsData[0].symbol);
        }
        // Set default to first interval if available
        if (intervalsData.length > 0) {
          setSelectedInterval(intervalsData[0].code);
        }
      } catch (error) {
        console.error('Error fetching trading data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
          {/* Timeline Visualization */}
          <TimelineVisualization enabled={timelineEnabled} onToggle={setTimelineEnabled} />

          {/* Multi-Chart Container */}
          <MultiChartContainer
            pairs={pairs}
            intervals={intervals}
            defaultSymbol={selectedPair}
            defaultInterval={selectedInterval}
            autoUpdateEnabled={autoUpdateEnabled}
          />
        </main>
      </div>
    </div>
  );
}
