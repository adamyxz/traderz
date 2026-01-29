'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Trader } from '@/db/schema';

interface EditTraderModalProps {
  trader: Trader;
  onClose: () => void;
  onUpdate?: (trader: Trader) => void;
}

export default function EditTraderModal({ trader, onClose, onUpdate }: EditTraderModalProps) {
  const [formData, setFormData] = useState<{
    // 基础信息
    name: string;
    description: string;
    status: 'enabled' | 'paused' | 'disabled';

    // 交易参数
    aggressivenessLevel: number;
    maxLeverage: number;
    minLeverage: number;
    maxPositions: number;
    maxPositionSize: number;
    minTradeAmount: number;
    positionStrategy: 'none' | 'martingale' | 'pyramid';
    allowShort: boolean;

    // 风险控制
    maxDrawdown: number;
    stopLossThreshold: number;
    positionStopLoss: number;
    positionTakeProfit: number;
    maxConsecutiveLosses: number;
    dailyMaxLoss: number;
    riskPreferenceScore: number;

    // 交易行为
    heartbeatInterval: number;
    activeTimeStart: string;
    activeTimeEnd: string;
    tradingStrategy: 'trend' | 'oscillation' | 'arbitrage' | 'market_making' | 'scalping' | 'swing';
    holdingPeriod: 'intraday' | 'short_term' | 'medium_term' | 'long_term';
  }>({
    // 基础信息
    name: trader.name,
    description: trader.description || '',
    status: trader.status,

    // 交易参数
    aggressivenessLevel: trader.aggressivenessLevel,
    maxLeverage: Number(trader.maxLeverage),
    minLeverage: Number(trader.minLeverage),
    maxPositions: trader.maxPositions,
    maxPositionSize: Number(trader.maxPositionSize),
    minTradeAmount: Number(trader.minTradeAmount),
    positionStrategy: trader.positionStrategy,
    allowShort: trader.allowShort,

    // 风险控制
    maxDrawdown: Number(trader.maxDrawdown),
    stopLossThreshold: Number(trader.stopLossThreshold),
    positionStopLoss: Number(trader.positionStopLoss),
    positionTakeProfit: Number(trader.positionTakeProfit),
    maxConsecutiveLosses: trader.maxConsecutiveLosses,
    dailyMaxLoss: Number(trader.dailyMaxLoss),
    riskPreferenceScore: trader.riskPreferenceScore,

    // 交易行为
    heartbeatInterval: trader.heartbeatInterval,
    activeTimeStart: trader.activeTimeStart,
    activeTimeEnd: trader.activeTimeEnd,
    tradingStrategy: trader.tradingStrategy,
    holdingPeriod: trader.holdingPeriod,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Please enter trader name';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Convert numeric string fields to numbers
    const traderData = {
      ...formData,
      maxLeverage: String(formData.maxLeverage),
      minLeverage: String(formData.minLeverage),
      maxPositionSize: String(formData.maxPositionSize),
      minTradeAmount: String(formData.minTradeAmount),
      maxDrawdown: String(formData.maxDrawdown),
      stopLossThreshold: String(formData.stopLossThreshold),
      positionStopLoss: String(formData.positionStopLoss),
      positionTakeProfit: String(formData.positionTakeProfit),
      dailyMaxLoss: String(formData.dailyMaxLoss),
    };

    onUpdate?.({ ...trader, ...traderData });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl p-5"
        style={{ backgroundColor: '#2D2D2D' }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-4 pr-8">
          <h2 className="text-xl font-bold text-white">Edit Trader</h2>
          <p className="mt-1 text-sm text-gray-400">Modify trader configuration and strategies</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基础信息 */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-white flex items-center gap-2">
              <div className="h-0.5 w-4 rounded-full bg-sky-500"></div>
              Basic Info
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full rounded-md bg-gray-700/50 px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
                    errors.name ? 'focus:ring-red-500' : 'focus:ring-sky-500'
                  }`}
                  placeholder="Enter trader name"
                />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md bg-gray-700/50 px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                  placeholder="Enter trader description"
                  rows={2}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'enabled' | 'paused' | 'disabled',
                    })
                  }
                  className="w-full appearance-none rounded-md bg-gray-700/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="enabled">Enabled</option>
                  <option value="paused">Paused</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'enabled' | 'paused' | 'disabled',
                    })
                  }
                  className="w-full appearance-none rounded-md bg-gray-700/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="enabled">Enabled</option>
                  <option value="paused">Paused</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
          </section>

          {/* 交易策略 */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-white flex items-center gap-2">
              <div className="h-0.5 w-4 rounded-full bg-purple-500"></div>
              Trading Strategy
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Strategy Type
                </label>
                <select
                  value={formData.tradingStrategy}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tradingStrategy: e.target.value as
                        | 'trend'
                        | 'oscillation'
                        | 'arbitrage'
                        | 'market_making'
                        | 'scalping'
                        | 'swing',
                    })
                  }
                  className="w-full appearance-none rounded-md bg-gray-700/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="trend">Trend</option>
                  <option value="oscillation">Oscillation</option>
                  <option value="arbitrage">Arbitrage</option>
                  <option value="market_making">Market Making</option>
                  <option value="scalping">Scalping</option>
                  <option value="swing">Swing</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Holding Period
                </label>
                <select
                  value={formData.holdingPeriod}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      holdingPeriod: e.target.value as
                        | 'intraday'
                        | 'short_term'
                        | 'medium_term'
                        | 'long_term',
                    })
                  }
                  className="w-full appearance-none rounded-md bg-gray-700/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="intraday">Intraday</option>
                  <option value="short_term">Short Term</option>
                  <option value="medium_term">Medium Term</option>
                  <option value="long_term">Long Term</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Position Strategy
                </label>
                <select
                  value={formData.positionStrategy}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      positionStrategy: e.target.value as 'none' | 'martingale' | 'pyramid',
                    })
                  }
                  className="w-full appearance-none rounded-md bg-gray-700/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="none">None</option>
                  <option value="martingale">Martingale</option>
                  <option value="pyramid">Pyramid</option>
                </select>
              </div>
            </div>
          </section>

          {/* 交易参数 */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-white flex items-center gap-2">
              <div className="h-0.5 w-4 rounded-full bg-blue-500"></div>
              Trading Parameters
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Aggressiveness
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.aggressivenessLevel}
                  onChange={(e) =>
                    setFormData({ ...formData, aggressivenessLevel: Number(e.target.value) })
                  }
                  className="w-full rounded-md bg-gray-700/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Leverage Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.minLeverage}
                    onChange={(e) =>
                      setFormData({ ...formData, minLeverage: Number(e.target.value) })
                    }
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={formData.maxLeverage}
                    onChange={(e) =>
                      setFormData({ ...formData, maxLeverage: Number(e.target.value) })
                    }
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Positions/Trade
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={formData.maxPositions}
                    onChange={(e) =>
                      setFormData({ ...formData, maxPositions: Number(e.target.value) })
                    }
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Max"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minTradeAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, minTradeAmount: Number(e.target.value) })
                    }
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Min Amount"
                  />
                </div>
              </div>
              <div className="flex items-center pt-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.allowShort}
                    onChange={(e) => setFormData({ ...formData, allowShort: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                  <span className="text-xs font-medium text-gray-300">Allow Short</span>
                </label>
              </div>
            </div>
          </section>

          {/* 风险控制 */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-white flex items-center gap-2">
              <div className="h-0.5 w-4 rounded-full bg-red-500"></div>
              Risk Control
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Max Drawdown/Stop Loss
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.maxDrawdown}
                    onChange={(e) =>
                      setFormData({ ...formData, maxDrawdown: Number(e.target.value) })
                    }
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.stopLossThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, stopLossThreshold: Number(e.target.value) })
                    }
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Position Stop Loss/Take Profit
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.positionStopLoss}
                    onChange={(e) =>
                      setFormData({ ...formData, positionStopLoss: Number(e.target.value) })
                    }
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.positionTakeProfit}
                    onChange={(e) =>
                      setFormData({ ...formData, positionTakeProfit: Number(e.target.value) })
                    }
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Consecutive Losses/Daily Loss
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="1"
                    value={formData.maxConsecutiveLosses}
                    onChange={(e) =>
                      setFormData({ ...formData, maxConsecutiveLosses: Number(e.target.value) })
                    }
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Count"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.dailyMaxLoss}
                    onChange={(e) =>
                      setFormData({ ...formData, dailyMaxLoss: Number(e.target.value) })
                    }
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Daily Loss"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Risk Score (1-10)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.riskPreferenceScore}
                  onChange={(e) =>
                    setFormData({ ...formData, riskPreferenceScore: Number(e.target.value) })
                  }
                  className="w-full rounded-md bg-gray-700/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </section>

          {/* 交易行为 */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-white flex items-center gap-2">
              <div className="h-0.5 w-4 rounded-full bg-emerald-500"></div>
              Trading Behavior
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">
                  Heartbeat Interval (sec)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.heartbeatInterval}
                  onChange={(e) =>
                    setFormData({ ...formData, heartbeatInterval: Number(e.target.value) })
                  }
                  className="w-full rounded-md bg-gray-700/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">Active Hours</label>
                <div className="flex gap-1">
                  <input
                    type="time"
                    value={formData.activeTimeStart}
                    onChange={(e) => setFormData({ ...formData, activeTimeStart: e.target.value })}
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <input
                    type="time"
                    value={formData.activeTimeEnd}
                    onChange={(e) => setFormData({ ...formData, activeTimeEnd: e.target.value })}
                    className="w-full rounded-md bg-gray-700/50 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-5 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-2 text-sm text-white font-medium hover:from-sky-600 hover:to-blue-700 transition-all shadow-lg shadow-sky-500/30"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
