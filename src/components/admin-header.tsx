'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function AdminHeader() {
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().split(' ')[4] + ' UTC');
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="sticky top-0 z-40 border-b border-gray-700/30 px-8 py-4"
      style={{ backgroundColor: '#1E1E1E' }}
    >
      <div className="flex items-center justify-between">
        {/* Breadcrumb */}
        <div className="text-sm text-white font-medium">Overview</div>

        {/* UTC Clock */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700/30">
          <Clock className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-mono text-white">{utcTime}</span>
        </div>
      </div>
    </header>
  );
}
