'use client';

import { useState, useEffect } from 'react';
import {
  Edit,
  Trash2,
  Activity,
  TrendingUp,
  Clock,
  Zap,
  Shield,
  DollarSign,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  BarChart3,
  CheckSquare,
  Square,
  Briefcase,
  Heart,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import type { Trader } from '@/db/schema';

interface TradingPair {
  id: number;
  symbol: string;
}

interface KlineInterval {
  id: number;
  code: string;
  label: string;
}

interface Reader {
  id: number;
  name: string;
  description: string | null;
}

interface TraderWithRelations extends Trader {
  preferredTradingPair?: TradingPair;
  preferredKlineIntervals?: KlineInterval[];
  readers?: Reader[];
  totalReturnRate?: number;
  totalPnl?: number;
}

interface TraderCardProps {
  trader: TraderWithRelations;
  onEdit: () => void;
  onDelete: () => void;
  onViewPositions?: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onOptimize?: () => void;
  isOptimizing?: boolean;
}

const statusConfig = {
  enabled: { label: 'Enabled', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-400' },
  paused: { label: 'Paused', bgColor: 'bg-amber-500/10', textColor: 'text-amber-400' },
  disabled: { label: 'Disabled', bgColor: 'bg-red-500/10', textColor: 'text-red-400' },
};

const strategyConfig = {
  trend: 'Trend',
  oscillation: 'Oscillation',
  arbitrage: 'Arbitrage',
  market_making: 'Market Making',
  scalping: 'Scalping',
  swing: 'Swing',
};

// Helper function to check if trader is currently active based on UTC time
const isTraderActive = (activeTimeStart: string, activeTimeEnd: string): boolean => {
  const now = new Date();
  const currentUTCHours = now.getUTCHours();
  const currentUTCMinutes = now.getUTCMinutes();
  const currentTimeInMinutes = currentUTCHours * 60 + currentUTCMinutes;

  const [startHours, startMinutes] = activeTimeStart.split(':').map(Number);
  const [endHours, endMinutes] = activeTimeEnd.split(':').map(Number);
  const startTimeInMinutes = startHours * 60 + startMinutes;
  const endTimeInMinutes = endHours * 60 + endMinutes;

  // Handle case where time range crosses midnight
  if (endTimeInMinutes < startTimeInMinutes) {
    return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
  }

  return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
};

export default function TraderCard({
  trader,
  onEdit,
  onDelete,
  onViewPositions,
  isSelected = false,
  onToggleSelect,
  onOptimize,
  isOptimizing = false,
}: TraderCardProps) {
  const [isActive, setIsActive] = useState(false);
  const [isHeartbeating, setIsHeartbeating] = useState(false);

  // Update active status every minute
  useEffect(() => {
    const updateActiveStatus = () => {
      setIsActive(isTraderActive(trader.activeTimeStart, trader.activeTimeEnd));
    };

    updateActiveStatus();
    const interval = setInterval(updateActiveStatus, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [trader.activeTimeStart, trader.activeTimeEnd]);

  // Handle heartbeat trigger
  const handleHeartbeat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHeartbeating(true);

    try {
      const response = await fetch(`/api/traders/${trader.id}/heartbeat`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        console.log('Heartbeat triggered:', result.data);
      } else {
        console.error('Heartbeat failed:', result.error);
      }
    } catch (error) {
      console.error('Heartbeat error:', error);
    } finally {
      setIsHeartbeating(false);
    }
  };

  const status = statusConfig[trader.status];

  // Calculate glow effect based on return rate
  const getGlowClass = () => {
    if (!trader.totalReturnRate) return '';
    if (trader.totalReturnRate > 0) {
      return 'shadow-lg shadow-emerald-500/50 hover:shadow-emerald-500/70';
    } else if (trader.totalReturnRate < 0) {
      return 'shadow-lg shadow-red-500/50 hover:shadow-red-500/70';
    }
    return '';
  };

  const getBorderColorClass = () => {
    if (!trader.totalReturnRate) return '';
    if (trader.totalReturnRate > 0) {
      return 'ring-2 ring-emerald-500/50';
    } else if (trader.totalReturnRate < 0) {
      return 'ring-2 ring-red-500/50';
    }
    return '';
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-xl p-3 transition-all hover:scale-[1.02] hover:shadow-xl ${
        isSelected ? 'ring-2 ring-sky-500' : ''
      } ${getGlowClass()} ${getBorderColorClass()}`}
      style={{ backgroundColor: '#2D2D2D' }}
    >
      {/* Top Bar: Name */}
      <div className="mb-2">
        <h3 className="text-base font-bold text-white truncate">{trader.name}</h3>
      </div>

      {/* Metrics Grid - Compact with Icons */}
      <div className="mb-2 grid grid-cols-3 gap-1.5 text-[10px]">
        {/* Total Return Rate */}
        <div className="flex flex-col items-center rounded bg-gray-700/30 p-1.5">
          <TrendingUp
            className={`h-3 w-3 mb-0.5 ${
              trader.totalReturnRate > 0
                ? 'text-emerald-400'
                : trader.totalReturnRate < 0
                  ? 'text-red-400'
                  : 'text-gray-400'
            }`}
          />
          <span
            className={`font-semibold ${
              trader.totalReturnRate > 0
                ? 'text-emerald-400'
                : trader.totalReturnRate < 0
                  ? 'text-red-400'
                  : 'text-gray-400'
            }`}
          >
            {trader.totalReturnRate !== undefined && trader.totalReturnRate !== null
              ? `${trader.totalReturnRate >= 0 ? '+' : ''}${trader.totalReturnRate.toFixed(2)}%`
              : 'N/A'}
          </span>
        </div>

        {/* Risk Score */}
        <div className="flex flex-col items-center rounded bg-gray-700/30 p-1.5">
          <Shield className="h-3 w-3 text-amber-400 mb-0.5" />
          <div className="flex gap-0.5 mb-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`h-1 w-1 rounded-full ${
                  i < Math.ceil(trader.riskPreferenceScore / 2) ? 'bg-amber-500' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
          <span className="text-white font-semibold">{trader.riskPreferenceScore}</span>
        </div>

        {/* Aggressiveness */}
        <div className="flex flex-col items-center rounded bg-gray-700/30 p-1.5">
          <Zap className="h-3 w-3 text-yellow-400 mb-0.5" />
          <span className="text-white font-semibold">{trader.aggressivenessLevel}</span>
        </div>
      </div>

      {/* Second Row - Max Positions and PnL */}
      <div className="mb-2 grid grid-cols-2 gap-1.5 text-[10px]">
        {/* Max Positions */}
        <div className="flex flex-col items-center rounded bg-gray-700/30 p-1.5">
          <Layers className="h-3 w-3 text-purple-400 mb-0.5" />
          <span className="text-white font-semibold">{trader.maxPositions} pos</span>
        </div>

        {/* Total PnL */}
        {trader.totalPnl !== undefined && trader.totalPnl !== null && (
          <div className="flex flex-col items-center rounded bg-gray-700/30 p-1.5">
            <DollarSign
              className={`h-3 w-3 mb-0.5 ${
                trader.totalPnl > 0
                  ? 'text-emerald-400'
                  : trader.totalPnl < 0
                    ? 'text-red-400'
                    : 'text-gray-400'
              }`}
            />
            <span
              className={`font-semibold ${
                trader.totalPnl > 0
                  ? 'text-emerald-400'
                  : trader.totalPnl < 0
                    ? 'text-red-400'
                    : 'text-gray-400'
              }`}
            >
              {trader.totalPnl >= 0 ? '+' : ''}
              {trader.totalPnl.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Risk Control - Inline */}
      <div className="mb-2 flex items-center gap-2 rounded bg-gray-700/20 px-2 py-1">
        <div className="flex items-center gap-1 text-[10px]">
          <ArrowDownRight className="h-3 w-3 text-red-400" />
          <span className="text-gray-400">{Number(trader.stopLossThreshold).toFixed(0)}%</span>
        </div>
        <div className="w-px h-3 bg-gray-600"></div>
        <div className="flex items-center gap-1 text-[10px]">
          <ArrowUpRight className="h-3 w-3 text-emerald-400" />
          <span className="text-gray-400">{Number(trader.positionTakeProfit).toFixed(0)}%</span>
        </div>
        <div className="flex-1"></div>
        <div className="flex items-center gap-1 text-[10px]">
          <DollarSign className="h-3 w-3 text-sky-400" />
          <span className="text-gray-400">{Number(trader.maxLeverage).toFixed(1)}x</span>
        </div>
      </div>

      {/* Active Hours - Compact */}
      <div className="mb-2 flex items-center justify-between rounded bg-gray-800/40 px-2 py-1">
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <Clock className="h-3 w-3" />
          <span>{trader.activeTimeStart}</span>
          <span className="text-gray-500">→</span>
          <span>{trader.activeTimeEnd}</span>
        </div>
        <span className="text-[9px] text-gray-500">UTC</span>
      </div>

      {/* Preferences - Compact with Strategy Badge */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {trader.preferredTradingPair && (
          <div className="inline-flex items-center gap-1 rounded bg-gray-700/30 px-2 py-1">
            <Coins className="h-3 w-3 text-orange-400" />
            <span className="text-[9px] font-medium text-gray-300">
              {trader.preferredTradingPair.symbol}
            </span>
          </div>
        )}
        {trader.preferredKlineIntervals && trader.preferredKlineIntervals.length > 0 && (
          <div className="inline-flex items-center gap-1 rounded bg-gray-700/30 px-2 py-1">
            <BarChart3 className="h-3 w-3 text-blue-400" />
            <span className="text-[9px] font-medium text-gray-300">
              {trader.preferredKlineIntervals.map((i) => i.code).join(', ')}
            </span>
          </div>
        )}
        {/* Readers */}
        {trader.readers && trader.readers.length > 0 && (
          <div className="inline-flex items-center gap-1 rounded bg-gray-700/30 px-2 py-1">
            <BookOpen className="h-3 w-3 text-green-400" />
            <span className="text-[9px] font-medium text-gray-300">
              {trader.readers.length} reader{trader.readers.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
        {/* Strategy Badge */}
        <div className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-sky-500/20 to-blue-500/20 px-2 py-0.5">
          <TrendingUp className="h-3 w-3 text-sky-400" />
          <span className="text-[9px] font-medium text-sky-300">
            {strategyConfig[trader.tradingStrategy]}
          </span>
        </div>
      </div>

      {/* Footer - Status Indicators */}
      <div className="flex items-center justify-between border-t border-gray-700/50 pt-2 mt-2">
        <div className="flex items-center gap-1.5">
          {/* Active Status */}
          <div
            className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/30 text-gray-400'
            }`}
          >
            <Activity className="h-2.5 w-2.5" />
            <span className="leading-none">{isActive ? 'ON' : 'OFF'}</span>
          </div>
          {/* Trader Status */}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${status.bgColor} ${status.textColor}`}
          >
            {status.label}
          </span>
        </div>
        <span className="text-[9px] text-gray-500">
          {new Date(trader.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>

      {/* Description Panel on Hover with Actions */}
      {trader.description && (
        <div className="absolute inset-x-0 bottom-0 z-20 max-h-0 overflow-hidden rounded-b-xl bg-gray-900/98 backdrop-blur-sm transition-all duration-300 group-hover:max-h-[40%] group-hover:p-3 flex flex-col pointer-events-auto">
          <p className="flex-1 text-[10px] text-gray-300 overflow-y-auto mb-3 line-clamp-6 scrollbar-thin">
            {trader.description}
          </p>

          {/* Action Buttons at Bottom */}
          <div className="flex items-center justify-between border-t border-gray-700/50 pt-3 mt-auto">
            {/* Selection Checkbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.();
              }}
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                isSelected
                  ? 'bg-sky-500 text-white hover:bg-sky-600'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}
              title={isSelected ? 'Deselect' : 'Select'}
            >
              {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </button>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              {/* Heartbeat Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleHeartbeat(e);
                }}
                disabled={isHeartbeating}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  isHeartbeating
                    ? 'bg-rose-500/30 text-rose-400 animate-pulse'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-rose-500/20 hover:text-rose-400'
                }`}
                title={isHeartbeating ? 'Heartbeat running...' : 'Trigger AI Heartbeat'}
              >
                <Heart className={`h-4 w-4 ${isHeartbeating ? 'animate-pulse' : ''}`} />
              </button>

              {/* Optimize Button */}
              {onOptimize && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOptimize();
                  }}
                  disabled={isOptimizing}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                    isOptimizing
                      ? 'bg-purple-500/30 text-purple-400 animate-pulse'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-purple-500/20 hover:text-purple-400'
                  }`}
                  title={isOptimizing ? 'Optimizing...' : 'AI Optimize Trader'}
                >
                  <Sparkles className={`h-4 w-4 ${isOptimizing ? 'animate-spin' : ''}`} />
                </button>
              )}

              {/* Positions Button */}
              {onViewPositions && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewPositions();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 text-gray-400 transition-all hover:bg-purple-500/20 hover:text-purple-400"
                  title="View Positions"
                >
                  <Briefcase className="h-4 w-4" />
                </button>
              )}

              {/* Edit Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 text-gray-400 transition-all hover:bg-sky-500/20 hover:text-sky-400"
                title="Edit Trader"
              >
                <Edit className="h-4 w-4" />
              </button>

              {/* Delete Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 text-gray-400 transition-all hover:bg-red-500/20 hover:text-red-400"
                title="Delete Trader"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hover Effect Gradient */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-sky-500/5 to-blue-500/5 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none z-0" />
    </div>
  );
}
