import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { trimPrice } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// Input validation schema
const InputSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{2,20}USDT$/, {
    message: 'Invalid trading pair format, expected BTCUSDT format',
  }),
  limit: z
    .number()
    .int()
    .refine((val) => [5, 10, 20, 50, 100, 500, 1000].includes(val), {
      message: 'limit must be one of 5, 10, 20, 50, 100, 500, 1000',
    })
    .default(500),
});

// Binance order book depth response type
interface BinanceDepthResponse {
  lastUpdateId: number;
  E: number; // event time
  T: number; // trade engine time
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
}

// Simplified price level type
interface PriceLevel {
  p: string; // price
  q: string; // quantity
}

// Execute function
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function execute(input: ReaderInput, _context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // Validate input
    const { symbol, limit } = InputSchema.parse(input);

    console.log(`[Reader] Fetching order book depth for ${symbol}, limit: ${limit}`);

    // Build Binance perpetual futures API request
    const baseUrl = 'https://fapi.binance.com/fapi/v1/depth';
    const params = new URLSearchParams();
    params.append('symbol', symbol.toUpperCase());
    params.append('limit', limit.toString());

    const url = `${baseUrl}?${params.toString()}`;

    // Call Binance API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Binance API request failed: ${response.status} ${errorText}`);
    }

    const rawData = (await response.json()) as BinanceDepthResponse;

    // Parse and optimize order book data
    // Bids (buy orders) - sorted by price descending
    const bids: PriceLevel[] = rawData.bids.map(([price, quantity]) => ({
      p: trimPrice(price),
      q: trimPrice(quantity),
    }));

    // Asks (sell orders) - sorted by price ascending
    const asks: PriceLevel[] = rawData.asks.map(([price, quantity]) => ({
      p: trimPrice(price),
      q: trimPrice(quantity),
    }));

    // Build CSV data
    // Format: type,p,q (type=1 for bids, type=0 for asks)
    const csvRows: string[] = [];

    // Add bids (type=1)
    bids.forEach(({ p, q }) => {
      csvRows.push(`1,${p},${q}`);
    });

    // Add asks (type=0)
    asks.forEach(({ p, q }) => {
      csvRows.push(`0,${p},${q}`);
    });

    const csvData = `type,p,q\n${csvRows.join('\n')}`;

    // Return standard format
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

// Parameter validation
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

// Export module
const readerModule: ReaderModule = {
  metadata: metadataJson as ReaderModule['metadata'],
  execute,
  validate,
};

export default readerModule;
