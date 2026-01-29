export interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingPair {
  id: number;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  contractType: string;
  createdAt: Date;
}

export interface KlineInterval {
  id: number;
  code: string;
  label: string;
  seconds: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';
