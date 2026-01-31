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

// Position data for auto-generated charts
export interface ChartPositionData {
  positionId: number;
  traderId: number;
  traderName: string;
  entryPrice: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  positionSize: number;
  returnRate: number;
  side: 'long' | 'short';
}

// Single chart configuration
export interface ChartConfig {
  id: string;
  symbol: string;
  interval: string;
  isRunning: boolean;
  connectionStatus: ConnectionStatus;
  positions?: ChartPositionData[]; // Array of positions for this symbol (auto-generated charts)
}

// Charts manager state
export interface ChartsManagerState {
  layout: ChartLayout;
  charts: ChartConfig[];
  maxCharts: Record<ChartLayout, number>;
}
