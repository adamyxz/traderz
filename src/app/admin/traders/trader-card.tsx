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
} from 'lucide-react';
import type { Trader } from '@/db/schema';

interface TraderCardProps {
  trader: Trader;
  onEdit: () => void;
  onDelete: () => void;
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

export default function TraderCard({ trader, onEdit, onDelete }: TraderCardProps) {
  const [isActive, setIsActive] = useState(false);

  // Update active status every minute
  useEffect(() => {
    const updateActiveStatus = () => {
      setIsActive(isTraderActive(trader.activeTimeStart, trader.activeTimeEnd));
    };

    updateActiveStatus();
    const interval = setInterval(updateActiveStatus, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [trader.activeTimeStart, trader.activeTimeEnd]);

  const status = statusConfig[trader.status];

  return (
    <div
      className="group relative overflow-hidden rounded-xl p-3 transition-all hover:scale-[1.02] hover:shadow-xl"
      style={{ backgroundColor: '#2D2D2D' }}
    >
      {/* Top Bar: Name and Actions */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="text-sm font-bold text-white truncate">{trader.name}</h3>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="flex h-6 w-6 items-center justify-center rounded bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 transition-colors"
            title="Edit"
          >
            <Edit className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="flex h-6 w-6 items-center justify-center rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Strategy Badge */}
      <div className="mb-2">
        <div className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-sky-500/20 to-blue-500/20 px-2 py-0.5">
          <TrendingUp className="h-3 w-3 text-sky-400" />
          <span className="text-[10px] font-medium text-sky-300">
            {strategyConfig[trader.tradingStrategy]}
          </span>
        </div>
      </div>

      {/* Metrics Grid - Compact with Icons */}
      <div className="mb-2 grid grid-cols-3 gap-1.5 text-[10px]">
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

        {/* Max Positions */}
        <div className="flex flex-col items-center rounded bg-gray-700/30 p-1.5">
          <Layers className="h-3 w-3 text-purple-400 mb-0.5" />
          <span className="text-white font-semibold">{trader.maxPositions}</span>
        </div>
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

      {/* Description Tooltip on Hover */}
      {trader.description && (
        <div className="absolute inset-x-0 bottom-0 z-10 max-h-0 overflow-hidden rounded-b-xl bg-gray-900/95 backdrop-blur-sm transition-all duration-300 group-hover:max-h-24 group-hover:py-2">
          <p className="px-3 text-[10px] text-gray-300 line-clamp-3">{trader.description}</p>
        </div>
      )}

      {/* Hover Effect Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-blue-500/5 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
    </div>
  );
}
