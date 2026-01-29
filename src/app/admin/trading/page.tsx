'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin-sidebar';
import AdminHeader from '@/components/admin-header';
import TradingControls from './components/trading-controls';
import TradingChart from './components/trading-chart';
import ConnectionStatus from './components/connection-status';
import type {
  TradingPair,
  KlineInterval,
  ConnectionStatus as StatusType,
} from '@/lib/trading/types';

export default function TradingPage() {
  const [isRunning, setIsRunning] = useState(true); // Default to running
  const [selectedPair, setSelectedPair] = useState('BTCUSDT');
  const [selectedInterval, setSelectedInterval] = useState('1m');
  const [pairs, setPairs] = useState<TradingPair[]>([]);
  const [intervals, setIntervals] = useState<KlineInterval[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<StatusType>('disconnected');
  const [loading, setLoading] = useState(true);

  // Fetch trading pairs and intervals on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
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
      } catch (error) {
        console.error('Error fetching trading data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handlePairChange = (pair: string) => {
    setSelectedPair(pair);
  };

  const handleIntervalChange = (interval: string) => {
    setSelectedInterval(interval);
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
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Trading View</h1>
              <p className="mt-2 text-sm text-gray-400">Real-time cryptocurrency market data</p>
            </div>
            <ConnectionStatus status={connectionStatus} />
          </div>

          {/* Controls */}
          <TradingControls
            isRunning={isRunning}
            selectedPair={selectedPair}
            selectedInterval={selectedInterval}
            pairs={pairs}
            intervals={intervals}
            onStart={handleStart}
            onStop={handleStop}
            onPairChange={handlePairChange}
            onIntervalChange={handleIntervalChange}
          />

          {/* Chart */}
          <TradingChart
            symbol={selectedPair}
            interval={selectedInterval}
            isRunning={isRunning}
            onStatusChange={setConnectionStatus}
          />
        </main>
      </div>
    </div>
  );
}
