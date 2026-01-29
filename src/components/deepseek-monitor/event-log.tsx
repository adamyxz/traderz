/**
 * Event log component - Chat style display
 * Left side: User prompts, Right side: LLM responses
 */

import React, { useState } from 'react';
import type { DeepSeekCallEvent } from '@/lib/deepseek/monitor-types';

export interface EventLogProps {
  events: DeepSeekCallEvent[];
}

export function EventLog({ events }: EventLogProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleExpanded = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const getStatusColor = (status: DeepSeekCallEvent['status']) => {
    switch (status) {
      case 'started':
        return 'text-blue-400';
      case 'streaming':
        return 'text-yellow-400';
      case 'completed':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: DeepSeekCallEvent['status']) => {
    switch (status) {
      case 'started':
        return '●';
      case 'streaming':
        return '◉';
      case 'completed':
        return '✓';
      case 'error':
        return '✕';
      default:
        return '•';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Events are already deduplicated in the hook, just use them directly
  // Keep original order (newest at bottom)
  const groupedEvents = events;

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No events yet</p>
          <p className="text-sm">Make a DeepSeek API call to see the conversation here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedEvents.map((event) => {
        const isExpanded = expandedEvents.has(event.eventId);
        const isStreaming = event.status === 'streaming';
        const hasError = event.status === 'error';

        return (
          <div key={event.eventId} className="space-y-3">
            {/* User Message (Left) */}
            <div className="flex gap-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                  U
                </div>
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-300">User</span>
                  <span className="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</span>
                  {event.metadata?.duration && (
                    <span className="text-xs text-gray-500">
                      {formatDuration(event.metadata.duration)}
                    </span>
                  )}
                  <span className={`text-xs ${getStatusColor(event.status)}`}>
                    {getStatusIcon(event.status)} {event.status}
                  </span>
                </div>

                {/* System Prompt (if exists) */}
                {event.systemPrompt && !isExpanded && (
                  <div className="text-xs text-gray-500 mb-2 italic">
                    System: {event.systemPrompt.substring(0, 80)}...
                  </div>
                )}

                {/* User Prompt */}
                <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                    {event.userPrompt}
                  </p>
                </div>

                {/* Expand button for system prompt */}
                {event.systemPrompt && (
                  <button
                    onClick={() => toggleExpanded(event.eventId)}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {isExpanded ? 'Hide' : 'Show'} System Prompt
                  </button>
                )}
              </div>
            </div>

            {/* System Prompt Expanded */}
            {isExpanded && event.systemPrompt && (
              <div className="flex gap-3">
                <div className="w-8 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-2">System Prompt:</div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                      {event.systemPrompt}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* LLM Response (Right) */}
            <div className="flex gap-3 flex-row-reverse">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
                    event.modelType === 'deepseek-reasoner'
                      ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                      : 'bg-gradient-to-br from-green-500 to-green-600'
                  }`}
                >
                  AI
                </div>
              </div>

              {/* Response Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 justify-end">
                  <span className="text-xs font-mono text-gray-500">{event.modelType}</span>
                  <span className="text-sm font-medium text-gray-300">Assistant</span>
                  {event.temperature && (
                    <span className="text-xs text-gray-500">T: {event.temperature.toFixed(1)}</span>
                  )}
                </div>

                {/* Response or Error */}
                {hasError ? (
                  <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-red-400 text-lg">✕</span>
                      <div className="flex-1">
                        <p className="text-sm text-red-300 font-medium mb-1">Error</p>
                        <p className="text-sm text-red-200 whitespace-pre-wrap break-words">
                          {event.error || 'Unknown error occurred'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : event.content || isStreaming ? (
                  <div
                    className={`bg-gray-800 border rounded-lg p-3 ${
                      isStreaming ? 'border-yellow-700 animate-pulse' : 'border-gray-700'
                    }`}
                  >
                    {isStreaming && !event.content && (
                      <div className="flex items-center gap-2 text-yellow-400 text-sm mb-2">
                        <span className="animate-pulse">◉</span>
                        <span>Thinking...</span>
                      </div>
                    )}

                    {/* Reasoning Content (for reasoner) */}
                    {event.metadata?.reasoningContent && (
                      <div className="mb-3 pb-3 border-b border-gray-700">
                        <div className="text-xs text-purple-400 mb-2 flex items-center gap-2">
                          <span>💭</span>
                          <span>Reasoning</span>
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                          {event.metadata.reasoningContent}
                        </p>
                      </div>
                    )}

                    {/* Main Response */}
                    {event.content && (
                      <>
                        {event.modelType === 'deepseek-reasoner' && (
                          <div className="text-xs text-green-400 mb-2 flex items-center gap-2">
                            <span>💡</span>
                            <span>Answer</span>
                          </div>
                        )}
                        <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                          {event.content}
                        </p>
                      </>
                    )}

                    {/* Metadata footer */}
                    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-700 text-xs text-gray-500">
                      {event.metadata?.duration && (
                        <span>⏱ {formatDuration(event.metadata.duration)}</span>
                      )}
                      {event.metadata?.tokensUsed && (
                        <span>📊 {event.metadata.tokensUsed} tokens</span>
                      )}
                      {event.maxTokens && <span>🔢 Max: {event.maxTokens}</span>}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800/50 border border-dashed border-gray-700 rounded-lg p-4 text-center text-gray-500 text-sm">
                    Waiting for response...
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-800"></div>
          </div>
        );
      })}
    </div>
  );
}
