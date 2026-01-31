/**
 * TimelineControls Component
 * Control bar for timeline visualization with enable/disable toggle and status display
 */

'use client';

import { useState } from 'react';
import { Activity, Clock } from 'lucide-react';

interface TimelineControlsProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  activeTraderCount?: number;
  readonly?: boolean;
}

export function TimelineControls({
  enabled,
  onToggle,
  activeTraderCount,
  readonly = false,
}: TimelineControlsProps) {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (newEnabled: boolean) => {
    setIsToggling(true);
    try {
      onToggle(newEnabled);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between rounded-2xl p-5 mb-4"
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 40px rgba(99, 102, 241, 0.1)',
      }}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Activity className={`h-5 w-5 ${enabled ? 'text-green-500' : 'text-gray-400'}`} />
          <span className="text-white font-semibold text-lg">Timeline</span>
        </div>

        {enabled && (
          <div className="flex items-center gap-6 text-sm">
            {activeTraderCount !== undefined && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-gray-300">
                  {activeTraderCount} {activeTraderCount === 1 ? 'trader' : 'traders'} active
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-400">
              <Clock className="h-4 w-4" />
              <span>12h window</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">
          {enabled ? 'Auto-scheduling' : 'Manual scheduling'}
        </span>
        <label
          className={`relative inline-flex items-center ${readonly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => !isToggling && !readonly && handleToggle(e.target.checked)}
            disabled={isToggling || readonly}
            className="peer sr-only"
          />
          <div
            className={`peer h-6 w-11 rounded-full bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-sky-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-800 ${isToggling || readonly ? 'opacity-50 cursor-not-allowed' : ''}`}
          ></div>
        </label>
      </div>
    </div>
  );
}
