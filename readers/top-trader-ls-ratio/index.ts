import { ReaderModule, ReaderInput, ReaderOutput } from '@/lib/readers/types';
import { toRelativeTimestamps, trimPrice, toCompactCSV } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// Input validation
const periodEnum = z.enum(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']);

const InputSchema = z.object({
  symbol: z
    .string()
    .regex(/^[A-Z]{2,20}USDT$/, {
      message: 'Invalid trading pair format, expected BTCUSDT format',
    }),
  period: periodEnum,
  limit: z.number().int().min(1).max(500).default(30),
  startTime: z.number().int().min(0).optional(),
  endTime: z.number().int().min(0).optional(),
});

// Simplified top trader long/short ratio data
interface SimplifiedRatio {
  T: number; // timestamp
  r: string; // ratio (longShortRatio)
  l: string; // longAccount
  s: string; // shortAccount
}

// Execute function
async function execute(input: ReaderInput): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // Validate input
    const { symbol, period, limit, startTime: startTs, endTime: endTs } = InputSchema.parse(input);

    console.log(`[Reader] Fetching top trader LS ratio for ${symbol} ${period}, limit: ${limit}`);

    // Build Binance perpetual futures API request
    const baseUrl = 'https://fapi.binance.com/futures/data/topLongShortPositionRatio';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      period,
      limit: limit.toString(),
    });

    if (startTs) {
      params.append('startTime', startTs.toString());
    }
    if (endTs) {
      params.append('endTime', endTs.toString());
    }

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

    const rawData = await response.json();

    // Validate returned data format
    if (!Array.isArray(rawData)) {
      throw new Error(`API returned data format error: expected array, got ${typeof rawData}`);
    }

    if (rawData.length === 0) {
      throw new Error('API returned no data');
    }

    // Parse data - simplify field names
    const data: SimplifiedRatio[] = rawData.map((item: unknown, idx: number) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`Data item ${idx} format error`);
      }
      const record = item as Record<string, unknown>;
      if (!record.timestamp) {
        throw new Error(`Data item ${idx} missing timestamp field`);
      }
      return {
        T: Number(record.timestamp),
        r: trimPrice(String(record.longShortRatio || 0)),
        l: trimPrice(String(record.longAccount || 0)),
        s: trimPrice(String(record.shortAccount || 0)),
      };
    });

    // Apply relative timestamp optimization
    const { baseTime, records: optimizedData } = toRelativeTimestamps(
      data as unknown as Record<string, unknown>[],
      'T'
    );

    // Validate optimized data
    if (!optimizedData || !Array.isArray(optimizedData)) {
      throw new Error('Data optimization failed');
    }

    // Build ultra-compact CSV - remove timestamp column, row order implies time sequence
    const csvData = toCompactCSV(optimizedData, {
      excludeColumns: ['dT'], // Remove relative timestamp
      defaultValuePlaceholder: '', // Use empty string for 0 values
    });

    const result = {
      s: symbol,
      p: period,
      fmt: 'csv',
      bT: baseTime,
      d: csvData,
    };

    return {
      success: true,
      data: result,
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
