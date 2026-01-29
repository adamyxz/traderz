/**
 * Monitor bubble button for toggling DeepSeek monitor
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface MonitorBubbleProps {
  isPanelOpen: boolean;
  eventCount: number;
  isActive: boolean;
  onClick: () => void;
}

export function MonitorBubble({ eventCount, isActive, onClick }: MonitorBubbleProps) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      animate={isActive ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
    >
      {/* Icon */}
      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>

      {/* Event count badge */}
      {eventCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
          {eventCount > 99 ? '99+' : eventCount}
        </span>
      )}

      {/* Active indicator */}
      {isActive && (
        <span className="absolute inset-0 rounded-full border-2 border-white opacity-50 animate-ping" />
      )}
    </motion.button>
  );
}
