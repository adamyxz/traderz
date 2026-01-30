/**
 * TimelineRuler Component
 * Displays the 12-hour time ruler with hour marks
 */

'use client';

import { useMemo } from 'react';

interface TimelineRulerProps {
  currentTime: Date;
}

export function TimelineRuler({ currentTime }: TimelineRulerProps) {
  // Generate hour marks from -6h to +6h
  const hourMarks = useMemo(() => {
    const marks: Array<{ hour: number; label: string; isPast: boolean; isCenter: boolean }> = [];

    for (let i = -6; i <= 6; i++) {
      const hourTime = new Date(currentTime.getTime() + i * 60 * 60 * 1000);
      const hours = hourTime.getUTCHours();
      const minutes = hourTime.getUTCMinutes();

      marks.push({
        hour: i,
        label: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        isPast: i < 0,
        isCenter: i === 0,
      });
    }

    return marks;
  }, [currentTime]);

  return (
    <div className="relative w-full h-12 mb-4 select-none">
      {/* Hour marks */}
      <div className="absolute inset-0 flex items-center">
        {hourMarks.map((mark) => {
          const position = ((mark.hour + 6) / 12) * 100;

          return (
            <div
              key={mark.hour}
              className="absolute flex flex-col items-center"
              style={{ left: `${position}%` }}
            >
              {/* Tick mark */}
              <div
                className={`
                  w-px transition-colors
                  ${mark.isCenter ? 'h-6 bg-sky-500' : 'h-3 ' + (mark.isPast ? 'bg-gray-600' : 'bg-gray-400')}
                `}
              />
              {/* Time label */}
              <span
                className={`
                  mt-1 text-xs font-mono transition-colors
                  ${mark.isCenter ? 'text-sky-500 font-bold' : mark.isPast ? 'text-gray-600' : 'text-gray-400'}
                `}
              >
                {mark.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Center line (current time) */}
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px bg-sky-500"
        style={{ transform: 'translateX(-50%)' }}
      >
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-sky-500" />
      </div>
    </div>
  );
}
