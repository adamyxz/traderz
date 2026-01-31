'use client';

import { useState, useMemo } from 'react';
import type { TradingPair, KlineInterval } from '@/lib/trading/types';

interface AddChartModalProps {
  isOpen: boolean;
  pairs: TradingPair[];
  intervals: KlineInterval[];
  defaultSymbol: string;
  defaultInterval: string;
  onClose: () => void;
  onConfirm: (symbol: string, interval: string) => void;
}

export default function AddChartModal({
  isOpen,
  pairs,
  intervals,
  defaultSymbol,
  defaultInterval,
  onClose,
  onConfirm,
}: AddChartModalProps) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [interval, setInterval] = useState(defaultInterval);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPairs = useMemo(() => {
    if (!searchQuery) return pairs;
    const query = searchQuery.toLowerCase();
    return pairs.filter((pair) => pair.symbol.toLowerCase().includes(query));
  }, [pairs, searchQuery]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(symbol, interval);
    // Reset for next time
    setSymbol(defaultSymbol);
    setInterval(defaultInterval);
    setSearchQuery('');
    onClose();
  };

  const handleCancel = () => {
    // Reset
    setSymbol(defaultSymbol);
    setInterval(defaultInterval);
    setSearchQuery('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[400px] rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-medium text-white">Add Chart</h3>

        <div className="space-y-4">
          {/* Trading Pair Search */}
          <div>
            <label className="mb-2 block text-sm text-gray-400">Trading Pair</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search trading pair..."
              className="
                mb-2 w-full rounded border border-gray-700 bg-gray-800
                px-3 py-2 text-sm text-white placeholder-gray-500
                focus:border-sky-500 focus:outline-none
              "
            />
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="
                w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white
                focus:border-sky-500 focus:outline-none
              "
            >
              {filteredPairs.length > 0 ? (
                filteredPairs.map((pair) => (
                  <option key={pair.id} value={pair.symbol}>
                    {pair.symbol}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No matching results
                </option>
              )}
            </select>
          </div>

          {/* Interval Selector */}
          <div>
            <label className="mb-2 block text-sm text-gray-400">Interval</label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="
                w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white
                focus:border-sky-500 focus:outline-none
              "
            >
              {intervals.map((interval) => (
                <option key={interval.id} value={interval.code}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
