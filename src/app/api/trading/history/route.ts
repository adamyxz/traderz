import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval');
    const limit = searchParams.get('limit') || '500';

    if (!symbol || !interval) {
      return NextResponse.json({ error: 'Missing symbol or interval parameter' }, { status: 400 });
    }

    // Fetch from Binance REST API
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);

    const data = await response.json();

    // Check if Binance returned an error (e.g., region restriction)
    if (data.code && data.code !== 0) {
      throw new Error(`Binance API error: ${data.msg} (code: ${data.code})`);
    }

    // Transform Binance data to our format
    const klines = data.map((k: [number, string, string, string, string, string]) => ({
      time: k[0] / 1000, // Convert to seconds
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    return NextResponse.json(klines);
  } catch (error) {
    console.error('Error fetching kline history:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch kline history';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
