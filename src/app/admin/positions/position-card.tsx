'use client';

import { TrendingUp, TrendingDown, Eye, XCircle } from 'lucide-react';
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

interface PositionCardProps {
  position: PositionWithRelations;
  onViewDetails: () => void;
  onClosePosition: () => void;
}

const statusConfig = {
  open: { label: 'Open', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-400' },
  closed: { label: 'Closed', bgColor: 'bg-gray-500/10', textColor: 'text-gray-400' },
  liquidated: { label: 'Liquidated', bgColor: 'bg-red-500/10', textColor: 'text-red-400' },
};

const sideConfig = {
  long: {
    label: 'Long',
    bgColor: 'bg-sky-500/10',
    textColor: 'text-sky-400',
    icon: TrendingUp,
  },
  short: {
    label: 'Short',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    icon: TrendingDown,
  },
};

export default function PositionCard({
  position,
  onViewDetails,
  onClosePosition,
}: PositionCardProps) {
  const status = statusConfig[position.status];
  const side = sideConfig[position.side];
  const SideIcon = side.icon;

  const entryPrice = parseFloat(position.entryPrice);
  const currentPrice = parseFloat(position.currentPrice);
  const unrealizedPnl = parseFloat(position.unrealizedPnl);
  const margin = parseFloat(position.margin);
  const leverage = parseFloat(position.leverage);
  const positionSize = parseFloat(position.positionSize);

  // Calculate price change
  const priceChange = currentPrice - entryPrice;
  const priceChangePercent = (priceChange / entryPrice) * 100;

  // Determine PnL color
  const isProfit = unrealizedPnl >= 0;
  const pnlColor = isProfit ? 'text-emerald-400' : 'text-red-400';
  const pnlBgColor = isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10';

  // Format date
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="group relative overflow-hidden rounded-xl p-4 transition-all hover:scale-[1.02] hover:shadow-xl"
      style={{ backgroundColor: '#2D2D2D' }}
    >
      {/* Trading Pair and Status */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">{position.tradingPair.symbol}</h3>
          <p className="text-xs text-gray-400">{position.trader.name}</p>
        </div>
        <div className="flex flex-col gap-1">
          {/* Side Badge */}
          <div
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${side.bgColor} ${side.textColor}`}
          >
            <SideIcon className="h-3 w-3" />
            {side.label}
          </div>
          {/* Status Badge */}
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ${status.bgColor} ${status.textColor}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Price Information */}
      <div className="mb-3 rounded-lg bg-gray-700/20 p-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-400">Entry:</span>
            <span className="ml-1 text-white">${entryPrice.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-400">Current:</span>
            <span className={`ml-1 ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${currentPrice.toFixed(2)}
            </span>
          </div>
        </div>
        {/* Price Change Bar */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>{entryPrice.toFixed(2)}</span>
            <span className={priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {priceChangePercent >= 0 ? '+' : ''}
              {priceChangePercent.toFixed(2)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
            <div
              className={`h-full transition-all ${priceChange >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(Math.abs(priceChangePercent), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Position Details */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col items-center rounded bg-gray-700/30 p-2">
          <span className="text-gray-400">Size</span>
          <span className="text-sm font-semibold text-white">${positionSize.toFixed(0)}</span>
        </div>
        <div className="flex flex-col items-center rounded bg-gray-700/30 p-2">
          <span className="text-gray-400">Leverage</span>
          <span className="text-sm font-semibold text-white">{leverage}x</span>
        </div>
        <div className="flex flex-col items-center rounded bg-gray-700/30 p-2">
          <span className="text-gray-400">Margin</span>
          <span className="text-sm font-semibold text-white">${margin.toFixed(2)}</span>
        </div>
      </div>

      {/* PnL Display */}
      <div className={`mb-3 rounded-lg ${pnlBgColor} p-3`}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-300">Unrealized PnL</span>
          <span className={`text-sm font-bold ${pnlColor}`}>
            {isProfit ? '+' : ''}
            {unrealizedPnl.toFixed(2)} USDT
          </span>
        </div>
        {margin > 0 && (
          <div className="mt-1 text-[10px] text-gray-400">
            ROI: {isProfit ? '+' : ''}
            {((unrealizedPnl / margin) * 100).toFixed(2)}%
          </div>
        )}
      </div>

      {/* Opened At */}
      <div className="mb-2 flex items-center justify-between text-[10px] text-gray-500">
        <span>Opened</span>
        <span>{formatDate(position.openedAt)}</span>
      </div>

      {/* Action Buttons on Hover */}
      <div className="absolute inset-x-0 bottom-0 z-10 max-h-0 overflow-hidden rounded-b-xl bg-gray-900/98 backdrop-blur-sm transition-all duration-300 group-hover:max-h-[40%] group-hover:p-3 flex flex-col">
        <div className="flex items-center justify-between mt-auto">
          <button
            onClick={onViewDetails}
            className="flex h-8 items-center gap-1.5 rounded bg-sky-500/20 px-3 text-sky-400 hover:bg-sky-500/30 transition-colors text-xs font-medium"
          >
            <Eye className="h-3.5 w-3.5" />
            View Details
          </button>
          {position.status === 'open' && (
            <button
              onClick={onClosePosition}
              className="flex h-8 items-center gap-1.5 rounded bg-red-500/20 px-3 text-red-400 hover:bg-red-500/30 transition-colors text-xs font-medium"
            >
              <XCircle className="h-3.5 w-3.5" />
              Close Position
            </button>
          )}
        </div>
      </div>

      {/* Hover Effect Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-blue-500/5 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
    </div>
  );
}
