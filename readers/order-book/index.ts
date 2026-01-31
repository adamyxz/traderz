import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { trimPrice } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// 输入验证 Schema
const InputSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{2,20}USDT$/, {
    message: '交易对格式错误，应为 BTCUSDT 格式',
  }),
  limit: z
    .number()
    .int()
    .refine((val) => [5, 10, 20, 50, 100, 500, 1000].includes(val), {
      message: 'limit 必须是 5, 10, 20, 50, 100, 500, 1000 之一',
    })
    .default(500),
});

// 币安订单簿深度响应类型
interface BinanceDepthResponse {
  lastUpdateId: number;
  E: number; // 事件时间
  T: number; // 撮合引擎时间
  bids: [string, string][]; // [价格, 数量]
  asks: [string, string][]; // [价格, 数量]
}

// 简化的订单档位类型
interface PriceLevel {
  p: string; // price
  q: string; // quantity
}

// 执行函数
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function execute(input: ReaderInput, _context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // 验证输入
    const { symbol, limit } = InputSchema.parse(input);

    console.log(`[Reader] Fetching order book depth for ${symbol}, limit: ${limit}`);

    // 构建币安永续合约API请求
    const baseUrl = 'https://fapi.binance.com/fapi/v1/depth';
    const params = new URLSearchParams();
    params.append('symbol', symbol.toUpperCase());
    params.append('limit', limit.toString());

    const url = `${baseUrl}?${params.toString()}`;

    // 调用币安API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`币安API请求失败: ${response.status} ${errorText}`);
    }

    const rawData = (await response.json()) as BinanceDepthResponse;

    // 解析并优化订单簿数据
    // 买单 (bids) - 按价格降序排列
    const bids: PriceLevel[] = rawData.bids.map(([price, quantity]) => ({
      p: trimPrice(price),
      q: trimPrice(quantity),
    }));

    // 卖单 (asks) - 按价格升序排列
    const asks: PriceLevel[] = rawData.asks.map(([price, quantity]) => ({
      p: trimPrice(price),
      q: trimPrice(quantity),
    }));

    // 构建 CSV 数据
    // 格式: type,p,q (type=1为买单, type=0为卖单)
    const csvRows: string[] = [];

    // 添加买单 (type=1)
    bids.forEach(({ p, q }) => {
      csvRows.push(`1,${p},${q}`);
    });

    // 添加卖单 (type=0)
    asks.forEach(({ p, q }) => {
      csvRows.push(`0,${p},${q}`);
    });

    const csvData = `type,p,q\n${csvRows.join('\n')}`;

    // 返回标准格式
    return {
      success: true,
      data: {
        s: symbol,
        fmt: 'csv',
        d: csvData,
      },
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  } catch (error) {
    console.error('[Reader] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 参数验证
function validate(input: ReaderInput) {
  try {
    InputSchema.parse(input);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Validation failed'] };
  }
}

// 导出模块
const readerModule: ReaderModule = {
  metadata: metadataJson as ReaderModule['metadata'],
  execute,
  validate,
};

export default readerModule;
