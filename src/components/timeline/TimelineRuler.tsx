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
    <div
      className="relative w-full h-14 mb-3 select-none rounded-xl"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(99, 102, 241, 0.15)',
      }}
    >
      {/* Hour marks */}
      <div className="absolute inset-0 flex items-center">
        {hourMarks.map((mark) => {
          const position = ((mark.hour + 6) / 12) * 100;

          return (
            <div
              key={mark.hour}
              className="absolute flex flex-col items-center"
              style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
            >
              {/* Tick mark */}
              <div
                className={`
                  w-px transition-all
                  ${mark.isCenter ? 'h-8' : 'h-4'}
                `}
                style={{
                  background: mark.isCenter
                    ? 'linear-gradient(180deg, transparent 0%, #38bdf8 50%, transparent 100%)'
                    : mark.isPast
                      ? 'rgba(75, 85, 99, 0.5)'
                      : 'rgba(156, 163, 175, 0.5)',
                  boxShadow: mark.isCenter ? '0 0 10px #38bdf880' : 'none',
                }}
              />
              {/* Time label */}
              <span
                className={`
                  mt-1.5 text-xs font-mono transition-all
                `}
                style={{
                  color: mark.isCenter
                    ? '#38bdf8'
                    : mark.isPast
                      ? 'rgba(107, 114, 128, 0.8)'
                      : 'rgba(156, 163, 175, 0.9)',
                  fontWeight: mark.isCenter ? '600' : '400',
                  textShadow: mark.isCenter ? '0 0 10px #38bdf880' : 'none',
                }}
              >
                {mark.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Center line (current time) */}
      <div
        className="absolute top-0 bottom-0 left-1/2"
        style={{
          width: '2px',
          background:
            'linear-gradient(180deg, transparent 0%, #38bdf8 20%, #38bdf8 80%, transparent 100%)',
          transform: 'translateX(-50%)',
          boxShadow: '0 0 15px #38bdf860',
        }}
      >
        <div
          className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: '10px',
            height: '10px',
            background: '#38bdf8',
            boxShadow: '0 0 12px #38bdf8, 0 0 24px #38bdf880',
          }}
        />
      </div>
    </div>
  );
}
