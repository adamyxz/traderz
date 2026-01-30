import type { KlineData } from './types';

const BINANCE_FUTURES_BASE_URL = 'https://fapi.binance.com';

export async function getKlines(
  symbol: string,
  interval: string,
  limit: number = 500
): Promise<KlineData[]> {
  const url = `${BINANCE_FUTURES_BASE_URL}/fapi/v1/continuousKlines?pair=${symbol.toUpperCase()}&contractType=PERPETUAL&interval=${interval}&limit=${limit}`;

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

  // Extract USDT-margined perpetual pairs only
  const pairs: BinanceTradingPair[] = data.symbols
    .filter(
      (s: { quoteAsset: string; status: string; contractType: string }) =>
        s.quoteAsset === 'USDT' && s.status === 'TRADING' && s.contractType === 'PERPETUAL'
    )
    .map((s: { symbol: string; baseAsset: string; quoteAsset: string; contractType: string }) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      status: 'active',
      contractType: 'perpetual',
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

export interface BinancePriceTicker {
  symbol: string;
  price: string;
  time: number;
}

export interface Binance24hPriceChange {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

/**
 * 获取单个交易对的当前价格
 * @param symbol 交易对符号，如 'BTCUSDT'
 * @returns 当前价格
 */
export async function getSymbolPrice(symbol: string): Promise<number> {
  const url = `${BINANCE_FUTURES_BASE_URL}/fapi/v1/ticker/price?symbol=${symbol.toUpperCase()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.statusText}`);
  }

  const data: BinancePriceTicker = await response.json();

  return parseFloat(data.price);
}

/**
 * 批量获取所有交易对的价格
 * @returns Map<symbol, price>
 */
export async function getAllSymbolPrices(): Promise<Map<string, number>> {
  const url = `${BINANCE_FUTURES_BASE_URL}/fapi/v1/ticker/price`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.statusText}`);
  }

  const data: BinancePriceTicker[] = await response.json();

  const priceMap = new Map<string, number>();
  for (const ticker of data) {
    priceMap.set(ticker.symbol, parseFloat(ticker.price));
  }

  return priceMap;
}

/**
 * 获取单个交易对的24小时价格变化
 * @param symbol 交易对符号，如 'BTCUSDT'
 * @returns 24小时价格变化数据
 */
export async function get24hPriceChange(symbol: string): Promise<{
  priceChange: number;
  priceChangePercent: number;
}> {
  const url = `${BINANCE_FUTURES_BASE_URL}/fapi/v1/ticker/24hr?symbol=${symbol.toUpperCase()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.statusText}`);
  }

  const data: Binance24hPriceChange = await response.json();

  return {
    priceChange: parseFloat(data.priceChange),
    priceChangePercent: parseFloat(data.priceChangePercent),
  };
}

/**
 * 批量获取所有交易对的24小时价格变化
 * @returns Map<symbol, {priceChange, priceChangePercent}>
 */
export async function getAll24hPriceChanges(): Promise<
  Map<string, { priceChange: number; priceChangePercent: number }>
> {
  const url = `${BINANCE_FUTURES_BASE_URL}/fapi/v1/ticker/24hr`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.statusText}`);
  }

  const data: Binance24hPriceChange[] = await response.json();

  const changeMap = new Map<string, { priceChange: number; priceChangePercent: number }>();
  for (const ticker of data) {
    changeMap.set(ticker.symbol, {
      priceChange: parseFloat(ticker.priceChange),
      priceChangePercent: parseFloat(ticker.priceChangePercent),
    });
  }

  return changeMap;
}

/**
 * 重试封装
 * @param fn 要执行的函数
 * @param maxRetries 最大重试次数
 * @param delay 重试延迟（毫秒）
 * @returns 函数执行结果
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        // 指数退避
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * 带重试的价格获取
 * @param symbol 交易对符号
 * @returns 当前价格
 */
export async function getSymbolPriceWithRetry(symbol: string): Promise<number> {
  return retryWithBackoff(() => getSymbolPrice(symbol));
}

/**
 * 带重试的批量价格获取
 * @returns Map<symbol, price>
 */
export async function getAllSymbolPricesWithRetry(): Promise<Map<string, number>> {
  return retryWithBackoff(() => getAllSymbolPrices());
}
