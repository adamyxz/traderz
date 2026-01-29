import type { KlineData } from './types';

const BINANCE_FUTURES_BASE_URL = 'https://fapi.binance.com';

export async function getKlines(
  symbol: string,
  interval: string,
  limit: number = 500
): Promise<KlineData[]> {
  const url = `${BINANCE_FUTURES_BASE_URL}/fapi/v1/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.statusText}`);
  }

  const data = await response.json();

  return data.map((k: [number, string, string, string, string, string]) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

export interface BinanceTradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  contractType: string;
  volume24h?: number;
  quoteVolume24h?: number;
}

export interface Binance24hTicker {
  symbol: string;
  volume: string; // 交易量（基础货币）
  quoteVolume: string; // 成交额（计价货币，USDT）
}

export async function getExchangeInfo(): Promise<BinanceTradingPair[]> {
  const url = `${BINANCE_FUTURES_BASE_URL}/fapi/v1/exchangeInfo`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.statusText}`);
  }

  const data = await response.json();

  // Extract USDT-margined trading pairs
  const pairs: BinanceTradingPair[] = data.symbols
    .filter(
      (s: { quoteAsset: string; status: string }) =>
        s.quoteAsset === 'USDT' && s.status === 'TRADING'
    )
    .map((s: { symbol: string; baseAsset: string; quoteAsset: string; contractType?: string }) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      status: 'active',
      contractType: s.contractType || 'perpetual',
    }));

  return pairs;
}

/**
 * 获取所有交易对的24小时ticker数据
 */
export async function get24hTickers(): Promise<Binance24hTicker[]> {
  const url = `${BINANCE_FUTURES_BASE_URL}/fapi/v1/ticker/24hr`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.statusText}`);
  }

  const data = await response.json();

  return data.map((ticker: { symbol: string; volume: string; quoteVolume: string }) => ({
    symbol: ticker.symbol,
    volume: ticker.volume,
    quoteVolume: ticker.quoteVolume,
  }));
}
