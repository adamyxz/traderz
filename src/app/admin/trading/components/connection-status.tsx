'use client';

import { ConnectionStatus as StatusType } from '@/lib/trading/types';

interface ConnectionStatusProps {
  status: StatusType;
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-emerald-500',
          text: '已连接',
          textColor: 'text-emerald-400',
        };
      case 'connecting':
        return {
          color: 'bg-yellow-500',
          text: '连接中',
          textColor: 'text-yellow-400',
        };
      case 'disconnected':
        return {
          color: 'bg-red-500',
          text: '未连接',
          textColor: 'text-red-400',
        };
      default:
        return {
          color: 'bg-gray-500',
          text: '未知',
          textColor: 'text-gray-400',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${config.color} ${status === 'connecting' ? 'animate-pulse' : ''}`}
      />
      <span className={`text-sm ${config.textColor}`}>{config.text}</span>
    </div>
  );
}
