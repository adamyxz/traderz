import { getSymbolPrice, getAllSymbolPrices, get24hPriceChange } from './binance-rest';

/**
 * Binance API 客户端封装
 * 提供统一的错误处理和日志记录
 */
export class BinanceClient {
  private static instance: BinanceClient;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): BinanceClient {
    if (!BinanceClient.instance) {
      BinanceClient.instance = new BinanceClient();
    }
    return BinanceClient.instance;
  }

  /**
   * 记录请求
   */
  private logRequest(endpoint: string): void {
    this.requestCount++;
    this.lastRequestTime = Date.now();

    if (process.env.NODE_ENV === 'development') {
      console.log(`[BinanceClient] Request #${this.requestCount}: ${endpoint}`);
    }
  }

  /**
   * 记录错误
   */
  private logError(endpoint: string, error: Error): void {
    console.error(`[BinanceClient] Error on ${endpoint}:`, error.message);
  }

  /**
   * 获取单个交易对价格
   * @param symbol 交易对符号
   * @returns 当前价格
   */
  async getPrice(symbol: string): Promise<number> {
    const endpoint = `ticker/price?symbol=${symbol}`;

    try {
      this.logRequest(endpoint);
      const price = await getSymbolPrice(symbol);
      return price;
    } catch (error) {
      this.logError(endpoint, error as Error);
      throw error;
    }
  }

  /**
   * 批量获取所有交易对价格
   * @returns 价格映射
   */
  async getAllPrices(): Promise<Map<string, number>> {
    const endpoint = 'ticker/price';

    try {
      this.logRequest(endpoint);
      const prices = await getAllSymbolPrices();
      return prices;
    } catch (error) {
      this.logError(endpoint, error as Error);
      throw error;
    }
  }

  /**
   * 获取24小时价格变化
   * @param symbol 交易对符号
   * @returns 价格变化数据
   */
  async get24hChange(symbol: string): Promise<{
    priceChange: number;
    priceChangePercent: number;
  }> {
    const endpoint = `ticker/24hr?symbol=${symbol}`;

    try {
      this.logRequest(endpoint);
      const change = await get24hPriceChange(symbol);
      return change;
    } catch (error) {
      this.logError(endpoint, error as Error);
      throw error;
    }
  }

  /**
   * 获取请求统计
   */
  getStats(): { requestCount: number; lastRequestTime: number } {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }
}

// 导出单例实例
export const binanceClient = BinanceClient.getInstance();
