'use client';

import {
  X,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
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

interface PositionHistory {
  id: number;
  positionId: number;
  action: string;
  price: string;
  quantity: string;
  pnl: string;
  fee: string;
  metadata: string;
  createdAt: string;
}

interface PositionDetailsModalProps {
  position: PositionWithRelations;
  history: PositionHistory[];
  onClose: () => void;
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

const actionConfig: Record<string, { label: string; color: string; icon: string }> = {
  open: { label: 'Opened', color: 'text-emerald-400', icon: '🚀' },
  close: { label: 'Closed', color: 'text-gray-400', icon: '📍' },
  liquidate: { label: 'Liquidated', color: 'text-red-400', icon: '💥' },
  price_update: { label: 'Price Update', color: 'text-blue-400', icon: '📊' },
  stop_loss_triggered: { label: 'Stop Loss', color: 'text-red-400', icon: '🛑' },
  take_profit_triggered: { label: 'Take Profit', color: 'text-emerald-400', icon: '🎯' },
  margin_added: { label: 'Margin Added', color: 'text-sky-400', icon: '➕' },
  margin_removed: { label: 'Margin Removed', color: 'text-orange-400', icon: '➖' },
};

export default function PositionDetailsModal({
  position,
  history,
  onClose,
}: PositionDetailsModalProps) {
  const status = statusConfig[position.status];
  const side = sideConfig[position.side];
  const SideIcon = side.icon;

  const entryPrice = parseFloat(position.entryPrice);
  const currentPrice = parseFloat(position.currentPrice);
  const stopLossPrice = position.stopLossPrice ? parseFloat(position.stopLossPrice) : null;
  const takeProfitPrice = position.takeProfitPrice ? parseFloat(position.takeProfitPrice) : null;
  const unrealizedPnl = parseFloat(position.unrealizedPnl);
  const realizedPnl = parseFloat(position.realizedPnl);
  const margin = parseFloat(position.margin);
  const leverage = parseFloat(position.leverage);
  const quantity = parseFloat(position.quantity);
  const positionSize = parseFloat(position.positionSize);
  const openFee = parseFloat(position.openFee);
  const closeFee = parseFloat(position.closeFee);

  const isProfit = unrealizedPnl >= 0;
  const pnlColor = isProfit ? 'text-emerald-400' : 'text-red-400';
  const pnlBgColor = isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10';

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl"
        style={{ backgroundColor: '#2D2D2D' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700/50 p-6">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">{position.tradingPair.symbol}</h2>
              <p className="text-sm text-gray-400">{position.trader.name}</p>
            </div>
            <div className="flex gap-2">
              <div
                className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm font-semibold ${side.bgColor} ${side.textColor}`}
              >
                <SideIcon className="h-4 w-4" />
                {side.label}
              </div>
              <span
                className={`rounded px-3 py-1.5 text-sm font-semibold ${status.bgColor} ${status.textColor}`}
              >
                {status.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Position Info */}
            <div className="space-y-4">
              {/* Price Information */}
              <div className="rounded-xl bg-gray-700/20 p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Price Information
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
                    <span className="text-sm text-gray-400">Entry Price</span>
                    <span className="text-sm font-semibold text-white">
                      ${entryPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
                    <span className="text-sm text-gray-400">Current Price</span>
                    <span
                      className={`text-sm font-semibold ${currentPrice >= entryPrice ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      ${currentPrice.toFixed(2)}
                    </span>
                  </div>
                  {stopLossPrice && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
                      <span className="text-sm text-gray-400 flex items-center gap-1">
                        <ArrowDownRight className="h-3 w-3 text-red-400" />
                        Stop Loss
                      </span>
                      <span className="text-sm font-semibold text-red-400">
                        ${stopLossPrice.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {takeProfitPrice && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
                      <span className="text-sm text-gray-400 flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                        Take Profit
                      </span>
                      <span className="text-sm font-semibold text-emerald-400">
                        ${takeProfitPrice.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Position Metrics */}
              <div className="rounded-xl bg-gray-700/20 p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Position Metrics
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-800/50 p-3">
                    <span className="text-xs text-gray-400">Position Size</span>
                    <p className="text-lg font-bold text-white">${positionSize.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-800/50 p-3">
                    <span className="text-xs text-gray-400">Quantity</span>
                    <p className="text-lg font-bold text-white">{quantity.toFixed(6)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-800/50 p-3">
                    <span className="text-xs text-gray-400">Leverage</span>
                    <p className="text-lg font-bold text-white">{leverage}x</p>
                  </div>
                  <div className="rounded-lg bg-gray-800/50 p-3">
                    <span className="text-xs text-gray-400">Margin</span>
                    <p className="text-lg font-bold text-white">${margin.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Fees */}
              <div className="rounded-xl bg-gray-700/20 p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Fees</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
                    <span className="text-sm text-gray-400">Open Fee</span>
                    <span className="text-sm font-semibold text-white">${openFee.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
                    <span className="text-sm text-gray-400">Close Fee</span>
                    <span className="text-sm font-semibold text-white">${closeFee.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-400">Total Fees</span>
                    <span className="text-sm font-semibold text-white">
                      ${(openFee + closeFee).toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - PnL and History */}
            <div className="space-y-4">
              {/* PnL Information */}
              <div className={`rounded-xl ${pnlBgColor} p-4`}>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Profit & Loss</h3>
                <div className="space-y-3">
                  <div className="rounded-lg bg-black/20 p-4">
                    <span className="text-xs text-gray-400">Unrealized PnL</span>
                    <p className={`text-2xl font-bold ${pnlColor}`}>
                      {isProfit ? '+' : ''}
                      {unrealizedPnl.toFixed(2)} USDT
                    </p>
                  </div>
                  <div className="rounded-lg bg-black/20 p-4">
                    <span className="text-xs text-gray-400">Realized PnL</span>
                    <p
                      className={`text-2xl font-bold ${realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {realizedPnl >= 0 ? '+' : ''}
                      {realizedPnl.toFixed(2)} USDT
                    </p>
                  </div>
                  <div className="rounded-lg bg-black/20 p-4">
                    <span className="text-xs text-gray-400">Net PnL</span>
                    <p
                      className={`text-2xl font-bold ${unrealizedPnl + realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {unrealizedPnl + realizedPnl >= 0 ? '+' : ''}
                      {(unrealizedPnl + realizedPnl - openFee - closeFee).toFixed(2)} USDT
                    </p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="rounded-xl bg-gray-700/20 p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time Information
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
                    <span className="text-sm text-gray-400">Opened At</span>
                    <span className="text-xs font-semibold text-white">
                      {formatDate(position.openedAt)}
                    </span>
                  </div>
                  {position.closedAt && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-400">Closed At</span>
                      <span className="text-xs font-semibold text-white">
                        {formatDate(position.closedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* History Timeline */}
          <div className="mt-6 rounded-xl bg-gray-700/20 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Position History</h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No history available</p>
            ) : (
              <div className="space-y-3">
                {history.map((item, index) => {
                  const action = actionConfig[item.action] || {
                    label: item.action,
                    color: 'text-gray-400',
                    icon: '📌',
                  };
                  const price = parseFloat(item.price);
                  const pnl = parseFloat(item.pnl);
                  const fee = parseFloat(item.fee);

                  return (
                    <div key={item.id} className="relative pl-6 pb-3">
                      {/* Timeline connector */}
                      {index !== history.length - 1 && (
                        <div className="absolute left-2 top-6 bottom-0 w-0.5 bg-gray-700" />
                      )}
                      {/* Timeline dot */}
                      <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full bg-gray-700 border-2 border-gray-600" />

                      <div className="rounded-lg bg-gray-800/50 p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{action.icon}</span>
                            <span className={`text-sm font-semibold ${action.color}`}>
                              {action.label}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-gray-400">Price:</span>
                            <span className="ml-1 text-white">${price.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Quantity:</span>
                            <span className="ml-1 text-white">
                              {parseFloat(item.quantity).toFixed(6)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Fee:</span>
                            <span className="ml-1 text-white">${fee.toFixed(4)}</span>
                          </div>
                          {pnl !== 0 && (
                            <div className="col-span-3">
                              <span className="text-gray-400">PnL:</span>
                              <span
                                className={`ml-1 ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                              >
                                {pnl >= 0 ? '+' : ''}
                                {pnl.toFixed(2)} USDT
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
