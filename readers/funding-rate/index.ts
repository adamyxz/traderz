import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { toRelativeTimestamps, trimPrice, toCompactCSV } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// Input validation
const InputSchema = z.object({
  symbol: z
    .string()
    .regex(/^$|^[A-Z]{2,20}USDT$/, {
      message: 'Invalid trading pair format, expected BTCUSDT format or leave empty',
    })
    .optional()
    .default(''),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
});

// Funding rate history type
interface FundingRateInfo {
  T: number; // fundingTime
  s: string; // symbol
  fr: string; // fundingRate
  mp: string; // markPrice
}

// Execute function
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function execute(input: ReaderInput, _context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // Validate input
    const { symbol, limit } = InputSchema.parse(input);

    console.log(`[Reader] Fetching funding rate history${symbol ? ' for ' + symbol : ''}`);

    // Build Binance API request
    const baseUrl = 'https://fapi.binance.com/fapi/v1/fundingRate';
    const params = new URLSearchParams();

    // If symbol is specified, add to parameters
    if (symbol && symbol.trim() !== '') {
      params.append('symbol', symbol.toUpperCase());
    }

    // Add limit parameter
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

    const rawData = await response.json();

    // Parse funding rate history data
    const fundingRates: FundingRateInfo[] = rawData.map(
      (item: { symbol: string; fundingRate: string; fundingTime: number; markPrice: string }) => ({
        T: item.fundingTime,
        s: item.symbol,
        fr: trimPrice(item.fundingRate),
        mp: trimPrice(item.markPrice),
      })
    );

    // If no data, return empty result
    if (fundingRates.length === 0) {
      return {
        success: true,
        data: {
          fmt: 'csv',
          s: symbol || '',
          d: '',
        },
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      };
    }

    // Apply relative timestamp optimization
    const { baseTime, records: optimizedData } = toRelativeTimestamps(
      fundingRates as unknown as Record<string, unknown>[],
      'T'
    );

    // Validate optimized data
    if (!optimizedData || !Array.isArray(optimizedData)) {
      throw new Error('Data optimization failed');
    }

    // Build ultra-compact CSV - remove timestamp and symbol columns
    const csvData = toCompactCSV(optimizedData, {
      excludeColumns: ['dT', 's'], // Remove relative timestamp and symbol
      defaultValuePlaceholder: '', // Use empty string for 0 values
    });

    const result = {
      fmt: 'csv',
      s: symbol || 'ALL', // symbol or ALL if empty
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
