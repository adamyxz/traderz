export interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
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

// Layout mode for multi-chart view
export type ChartLayout = '1x1' | '2x1' | '1x2' | '2x2';

// Single chart configuration
export interface ChartConfig {
  id: string;
  symbol: string;
  interval: string;
  isRunning: boolean;
  connectionStatus: ConnectionStatus;
}

// Charts manager state
export interface ChartsManagerState {
  layout: ChartLayout;
  charts: ChartConfig[];
  maxCharts: Record<ChartLayout, number>;
}
