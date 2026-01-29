'use client';

import { useState } from 'react';
import type { Trader } from '@/db/schema';
import { Edit, Trash2, TrendingUp, AlertCircle } from 'lucide-react';
import EditTraderModal from './edit-trader-modal';

interface TraderListProps {
  traders: Trader[];
}

const statusLabels = {
  enabled: '运行中',
  disabled: '已禁用',
  paused: '已暂停',
};

const statusStyles = {
  enabled: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  disabled: 'bg-red-500/10 text-red-400 border-red-500/20',
  paused: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const strategyLabels = {
  trend: '趋势',
  oscillation: '震荡',
  arbitrage: '套利',
  market_making: '做市',
  scalping: '剥头皮',
  swing: '波段',
};

export default function TraderList({ traders }: TraderListProps) {
  const [selectedTrader, setSelectedTrader] = useState<Trader | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEdit = (trader: Trader) => {
    setSelectedTrader(trader);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个交易员吗？')) return;

    try {
      const response = await fetch(`/api/traders/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        window.location.reload();
      } else {
        alert('删除失败');
      }
    } catch (error) {
      console.error('Error deleting trader:', error);
      alert('删除失败');
    }
  };

  if (traders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 p-12">
        <div className="mb-4 rounded-full bg-slate-800 p-4">
          <AlertCircle className="h-12 w-12 text-slate-600" />
        </div>
        <p className="text-lg font-medium text-white">暂无交易员数据</p>
        <p className="mt-2 text-slate-400">点击右上角&ldquo;新建交易员&rdquo;开始创建</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {traders.map((trader) => (
          <div
            key={trader.id}
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-6 transition-all hover:border-slate-700 hover:shadow-2xl hover:shadow-indigo-500/10"
          >
            {/* Status Badge */}
            <div className="absolute right-4 top-4">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusStyles[trader.status]}`}
              >
                {statusLabels[trader.status]}
              </span>
            </div>

            {/* Header */}
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white">{trader.name}</h3>
              <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                {trader.description || '暂无描述'}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-800/50 p-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">激进程度</span>
                </div>
                <p className="mt-1 text-lg font-semibold text-white">
                  {trader.aggressivenessLevel}
                  <span className="text-sm font-normal text-slate-400">/10</span>
                </p>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">风险偏好</span>
                </div>
                <p className="mt-1 text-lg font-semibold text-white">
                  {trader.riskPreferenceScore}
                  <span className="text-sm font-normal text-slate-400">/10</span>
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2 border-t border-slate-800 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">最大杠杆</span>
                <span className="font-medium text-white">{trader.maxLeverage}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">最大回撤</span>
                <span className="font-medium text-white">{trader.maxDrawdown}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">交易策略</span>
                <span className="font-medium text-white">
                  {strategyLabels[trader.tradingStrategy]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">心跳频率</span>
                <span className="font-medium text-white">{trader.heartbeatInterval}s</span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2 border-t border-slate-800 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => handleEdit(trader)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                <Edit className="h-4 w-4" />
                编辑
              </button>
              <button
                onClick={() => handleDelete(trader.id)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </div>
          </div>
        ))}
      </div>

      {isEditModalOpen && selectedTrader && (
        <EditTraderModal trader={selectedTrader} onClose={() => setIsEditModalOpen(false)} />
      )}
    </>
  );
}
