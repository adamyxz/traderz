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
