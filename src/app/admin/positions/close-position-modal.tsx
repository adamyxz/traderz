'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { Position } from '@/db/schema';

interface TradingPair {
  id: number;
  symbol: string;
}

interface Trader {
  id: number;
  name: string;
}

interface PositionWithRelations extends Position {
  trader: Trader;
  tradingPair: TradingPair;
}

interface ClosePositionModalProps {
  positionId: number;
  onClose: () => void;
  onClosed: () => void;
}

export default function ClosePositionModal({
  positionId,
  onClose,
  onClosed,
}: ClosePositionModalProps) {
  const [position, setPosition] = useState<PositionWithRelations | null>(null);
  const [closePrice, setClosePrice] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPosition();
  }, [positionId]);

  const fetchPosition = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/positions/${positionId}`);
      if (!response.ok) throw new Error('Failed to fetch position');

      const data = await response.json();
      // Transform API response
      const transformed: PositionWithRelations = {
        ...data.position,
        trader: data.trader,
        tradingPair: data.tradingPair,
      };
      setPosition(transformed);
      setClosePrice(data.position.currentPrice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load position');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!position || !closePrice) return;

    try {
      setClosing(true);
      setError(null);

      const price = parseFloat(closePrice);
      if (isNaN(price) || price <= 0) {
        throw new Error('Invalid close price');
      }

      const response = await fetch(`/api/positions/${positionId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closePrice: price }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to close position');
      }

      const result = await response.json();
      console.log('Position closed:', result);

      onClosed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close position');
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="rounded-2xl p-8 text-white" style={{ backgroundColor: '#2D2D2D' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="rounded-2xl p-8 text-red-400" style={{ backgroundColor: '#2D2D2D' }}>
          Failed to load position
        </div>
      </div>
    );
  }

  const entryPrice = parseFloat(position.entryPrice);
  const price = parseFloat(closePrice);
  const positionSize = parseFloat(position.positionSize);
  const openFee = parseFloat(position.openFee);
  const leverage = parseFloat(position.leverage);

  // Calculate estimated PnL
  let estimatedPnl = 0;
  if (position.side === 'long') {
    estimatedPnl = ((price - entryPrice) / entryPrice) * positionSize * leverage;
  } else {
    estimatedPnl = ((entryPrice - price) / entryPrice) * positionSize * leverage;
  }

  // Estimate close fee (0.04% of position size)
  const estimatedCloseFee = positionSize * 0.0004;
  const netPnl = estimatedPnl - openFee - estimatedCloseFee;

  const isProfit = netPnl >= 0;
  const pnlColor = isProfit ? 'text-emerald-400' : 'text-red-400';
  const pnlBgColor = isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl" style={{ backgroundColor: '#2D2D2D' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700/50 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/20 p-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Close Position</h2>
          </div>
          <button
            onClick={onClose}
            disabled={closing}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Position Info */}
          <div className="mb-6 rounded-xl bg-gray-700/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-white">{position.tradingPair.symbol}</h3>
                <p className="text-sm text-gray-400">{position.trader.name}</p>
              </div>
              <div
                className={`rounded px-3 py-1.5 text-sm font-semibold ${
                  position.side === 'long'
                    ? 'bg-sky-500/10 text-sky-400'
                    : 'bg-orange-500/10 text-orange-400'
                }`}
              >
                {position.side.toUpperCase()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Entry Price:</span>
                <span className="text-white font-semibold">${entryPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Position Size:</span>
                <span className="text-white font-semibold">${positionSize.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Leverage:</span>
                <span className="text-white font-semibold">{leverage}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Open Fee:</span>
                <span className="text-white font-semibold">${openFee.toFixed(4)}</span>
              </div>
            </div>
          </div>

          {/* Close Price Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Close Price (USDT)
            </label>
            <input
              type="number"
              step="0.01"
              value={closePrice}
              onChange={(e) => setClosePrice(e.target.value)}
              className="w-full rounded-lg bg-gray-700/50 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Enter close price"
              disabled={closing}
            />
            <p className="mt-2 text-xs text-gray-500">
              Current market price: ${parseFloat(position.currentPrice).toFixed(2)}
            </p>
          </div>

          {/* Estimated PnL */}
          <div className={`mb-6 rounded-xl ${pnlBgColor} p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Estimated PnL</span>
              <span className={`text-lg font-bold ${pnlColor}`}>
                {isProfit ? '+' : ''}
                {estimatedPnl.toFixed(2)} USDT
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Gross PnL:</span>
                <span className="text-white">
                  {isProfit ? '+' : ''}
                  {estimatedPnl.toFixed(2)} USDT
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Open Fee:</span>
                <span className="text-white">-{openFee.toFixed(4)} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Est. Close Fee:</span>
                <span className="text-white">-{estimatedCloseFee.toFixed(4)} USDT</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-600/50">
                <span className="text-gray-300 font-semibold">Net PnL:</span>
                <span className={`font-semibold ${pnlColor}`}>
                  {isProfit ? '+' : ''}
                  {netPnl.toFixed(2)} USDT
                </span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
          )}

          {/* Warning */}
          <div className="mb-6 rounded-lg bg-amber-500/10 p-3 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200">
              This action will close the position immediately. The PnL will be realized and cannot
              be undone.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={closing}
              className="flex-1 rounded-lg bg-gray-700 px-4 py-3 text-gray-300 hover:bg-gray-600 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleClose}
              disabled={closing || !closePrice || parseFloat(closePrice) <= 0}
              className="flex-1 rounded-lg bg-red-500 px-4 py-3 text-white hover:bg-red-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {closing ? 'Closing...' : 'Confirm Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
