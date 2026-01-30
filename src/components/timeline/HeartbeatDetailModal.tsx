/**
 * HeartbeatDetailModal Component
 * Displays detailed information about a completed heartbeat
 */

'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

interface MicroDecision {
  interval: string;
  action: string;
  confidence: number;
  reasoning: string;
  technicalSignals?: {
    trend?: string;
    momentum?: string;
    volumeAnalysis?: string;
    keyLevels?: string;
  };
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
}

interface FinalDecision {
  action: string;
  confidence: number;
  reasoning: string;
  intervalAnalysis: Array<{
    interval: string;
    weight: number;
    decision: string;
    keyFactors: string;
  }>;
  positionSize?: number;
  leverage?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  riskAssessment: {
    level: string;
    riskRewardRatio: number;
    positionSizePercent: number;
  };
}

interface ReaderExecution {
  readerId: number;
  success: boolean;
  executionTime: number;
}

interface HeartbeatDetail {
  id: number;
  traderId: number;
  status: string;
  triggeredAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  wasWithinActiveHours: boolean;
  microDecisions: MicroDecision[] | null;
  finalDecision: FinalDecision | null;
  executionAction?: string;
  executionResult: {
    success: boolean;
    action: string;
    positionId?: number;
    message?: string;
    error?: string;
  } | null;
  readersExecuted: ReaderExecution[] | null;
  errorMessage?: string;
}

interface HeartbeatDetailModalProps {
  heartbeatId: string;
  traderId: number;
  traderName: string;
  onClose: () => void;
}

export function HeartbeatDetailModal({
  heartbeatId,
  traderId,
  traderName,
  onClose,
}: HeartbeatDetailModalProps) {
  const [detail, setDetail] = useState<HeartbeatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/timeline/heartbeats/${heartbeatId}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch heartbeat details');
        }
        const data = await response.json();
        if (data.success) {
          setDetail(data.data);
        } else {
          setError(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [heartbeatId]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'open_long':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'open_short':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'hold':
        return <Minus className="w-5 h-5 text-gray-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      open_long: 'Open Long',
      open_short: 'Open Short',
      hold: 'Hold',
      close_position: 'Close Position',
      close_all: 'Close All Positions',
      modify_sl_tp: 'Modify SL/TP',
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'open_long':
        return 'text-green-500';
      case 'open_short':
        return 'text-red-500';
      case 'hold':
        return 'text-gray-400';
      case 'close_position':
      case 'close_all':
        return 'text-yellow-500';
      default:
        return 'text-gray-400';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-sky-500 animate-spin" />
          <p className="text-white">Loading heartbeat details...</p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div
          className="relative z-10 w-full max-w-md rounded-2xl p-8 shadow-2xl"
          style={{ backgroundColor: '#2D2D2D' }}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <h3 className="text-xl font-bold text-white">Error Loading Details</h3>
            <p className="text-gray-300">{error || 'Unknown error'}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg bg-gray-700 px-6 py-2 text-white hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ backgroundColor: '#2D2D2D' }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 border-b border-gray-700 p-6 backdrop-blur-sm"
          style={{ backgroundColor: '#2D2D2D' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Heartbeat Details</h2>
              <p className="text-sm text-gray-400 mt-1">
                {traderName} • Trader ID: {traderId}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg bg-gray-800/50 p-4">
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <p
                className={`text-sm font-semibold ${
                  detail.status === 'completed'
                    ? 'text-green-500'
                    : detail.status === 'failed'
                      ? 'text-red-500'
                      : 'text-yellow-500'
                }`}
              >
                {detail.status.charAt(0).toUpperCase() + detail.status.slice(1)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-800/50 p-4">
              <p className="text-xs text-gray-400 mb-1">Duration</p>
              <p className="text-sm font-semibold text-white">{formatDuration(detail.duration)}</p>
            </div>
            <div className="rounded-lg bg-gray-800/50 p-4">
              <p className="text-xs text-gray-400 mb-1">Triggered At</p>
              <p className="text-sm font-semibold text-white">
                {formatTimestamp(detail.triggeredAt)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-800/50 p-4">
              <p className="text-xs text-gray-400 mb-1">Active Hours</p>
              <p className="text-sm font-semibold text-white">
                {detail.wasWithinActiveHours ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          {/* Execution Result */}
          {detail.executionResult && (
            <div className="rounded-lg bg-gray-800/50 p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Execution Result</h3>
              <div className="flex items-center gap-3">
                {getActionIcon(detail.executionResult.action)}
                <div>
                  <p
                    className={`text-sm font-semibold ${getActionColor(detail.executionResult.action)}`}
                  >
                    {getActionLabel(detail.executionResult.action)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {detail.executionResult.success
                      ? detail.executionResult.message || 'Success'
                      : detail.executionResult.error || 'Failed'}
                  </p>
                </div>
              </div>
              {detail.executionResult.positionId && (
                <p className="text-xs text-gray-400 mt-2">
                  Position ID: {detail.executionResult.positionId}
                </p>
              )}
            </div>
          )}

          {/* Final Decision */}
          {detail.finalDecision && (
            <div className="rounded-lg bg-gray-800/50 p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Comprehensive Decision</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {getActionIcon(detail.finalDecision.action)}
                  <div>
                    <p
                      className={`text-sm font-semibold ${getActionColor(detail.finalDecision.action)}`}
                    >
                      {getActionLabel(detail.finalDecision.action)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Confidence: {(detail.finalDecision.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
                <div className="rounded bg-gray-900/50 p-3">
                  <p className="text-xs text-gray-400 mb-1">Reasoning:</p>
                  <p className="text-sm text-gray-200">{detail.finalDecision.reasoning}</p>
                </div>
                {detail.finalDecision.leverage && (
                  <p className="text-xs text-gray-400">
                    Leverage: {detail.finalDecision.leverage}x
                  </p>
                )}
                {detail.finalDecision.positionSize && (
                  <p className="text-xs text-gray-400">
                    Position Size: ${detail.finalDecision.positionSize.toFixed(2)}
                  </p>
                )}
                <div className="text-xs text-gray-400">
                  <p>Risk Level: {detail.finalDecision.riskAssessment.level}</p>
                  <p>
                    Risk/Reward Ratio:{' '}
                    {detail.finalDecision.riskAssessment.riskRewardRatio.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Interval Analysis */}
          {detail.finalDecision?.intervalAnalysis &&
            detail.finalDecision.intervalAnalysis.length > 0 && (
              <div className="rounded-lg bg-gray-800/50 p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Interval Analysis</h3>
                <div className="space-y-2">
                  {detail.finalDecision.intervalAnalysis.map((analysis, idx) => (
                    <div key={idx} className="rounded bg-gray-900/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-sky-400">{analysis.interval}</p>
                        <p className="text-xs text-gray-400">
                          Weight: {analysis.weight.toFixed(2)}
                        </p>
                      </div>
                      <p className="text-xs text-gray-300 mb-1">{analysis.decision}</p>
                      <p className="text-xs text-gray-500">{analysis.keyFactors}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Micro Decisions */}
          {detail.microDecisions && detail.microDecisions.length > 0 && (
            <div className="rounded-lg bg-gray-800/50 p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Micro Decisions by Interval</h3>
              <div className="space-y-3">
                {detail.microDecisions.map((decision, idx) => (
                  <div key={idx} className="rounded-lg bg-gray-900/50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-sky-400">{decision.interval}</p>
                      <div className="flex items-center gap-2">
                        {getActionIcon(decision.action)}
                        <p className="text-xs text-gray-400">
                          Confidence: {(decision.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <p className={`text-xs font-semibold mb-2 ${getActionColor(decision.action)}`}>
                      {getActionLabel(decision.action)}
                    </p>
                    <div className="rounded bg-gray-800/50 p-2 mb-2">
                      <p className="text-xs text-gray-300">{decision.reasoning}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Trend:</p>
                        <p className="text-gray-300">{decision.technicalSignals?.trend ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Momentum:</p>
                        <p className="text-gray-300">
                          {decision.technicalSignals?.momentum ?? '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Readers Executed */}
          {detail.readersExecuted && detail.readersExecuted.length > 0 && (
            <div className="rounded-lg bg-gray-800/50 p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Data Readers Executed</h3>
              <div className="space-y-2">
                {detail.readersExecuted.map((reader, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <p className="text-gray-300">Reader ID: {reader.readerId}</p>
                    <div className="flex items-center gap-3">
                      <p className="text-gray-400">{reader.executionTime}ms</p>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          reader.success
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {reader.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {detail.errorMessage && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
              <p className="text-sm text-red-300">{detail.errorMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
