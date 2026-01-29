import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tradingPairs } from '@/db/schema';
import { getExchangeInfo, get24hTickers, type Binance24hTicker } from '@/lib/trading/binance-rest';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    // Fetch trading pairs from Binance
    const binancePairs = await getExchangeInfo();

    // Fetch 24h ticker data
    const tickers = await get24hTickers();

    // Create a map of ticker data by symbol
    const tickerMap = new Map<string, Binance24hTicker>();
    tickers.forEach((ticker) => {
      tickerMap.set(ticker.symbol, ticker);
    });

    // Merge ticker data into pairs
    const pairsWithVolume = binancePairs.map((pair) => {
      const ticker = tickerMap.get(pair.symbol);
      return {
        ...pair,
        volume24h: ticker ? parseFloat(ticker.volume) : 0,
        quoteVolume24h: ticker ? parseFloat(ticker.quoteVolume) : 0,
      };
    });

    // Sort by quote volume (成交额) and take top 50
    const topPairs = pairsWithVolume
      .sort((a, b) => b.quoteVolume24h - a.quoteVolume24h)
      .slice(0, 50)
      .map((pair, index) => ({
        ...pair,
        volumeRank: index + 1,
      }));

    // Get current pairs from database
    const currentPairs = await db.select().from(tradingPairs);
    const currentSymbols = new Set(currentPairs.map((p) => p.symbol));
    const topSymbols = new Set(topPairs.map((p) => p.symbol));

    // Find new pairs to insert (only in top 50)
    const newPairs = topPairs.filter((p) => !currentSymbols.has(p.symbol));

    // Find existing pairs to update
    const existingPairs = topPairs.filter((p) => currentSymbols.has(p.symbol));

    // Insert new pairs
    let insertedCount = 0;
    if (newPairs.length > 0) {
      const inserted = await db
        .insert(tradingPairs)
        .values(
          newPairs.map((pair) => ({
            symbol: pair.symbol,
            baseAsset: pair.baseAsset,
            quoteAsset: pair.quoteAsset,
            status: pair.status,
            contractType: pair.contractType,
            volume24h: pair.volume24h.toString(),
            quoteVolume24h: pair.quoteVolume24h.toString(),
            volumeRank: pair.volumeRank,
          }))
        )
        .returning();
      insertedCount = inserted.length;
    }

    // Update existing pairs
    let updatedCount = 0;
    for (const pair of existingPairs) {
      const currentPair = currentPairs.find((p) => p.symbol === pair.symbol);
      // Update if any field changed
      if (
        currentPair &&
        (currentPair.status !== pair.status ||
          currentPair.volumeRank !== pair.volumeRank ||
          currentPair.quoteVolume24h !== pair.quoteVolume24h.toString())
      ) {
        await db
          .update(tradingPairs)
          .set({
            status: pair.status,
            baseAsset: pair.baseAsset,
            quoteAsset: pair.quoteAsset,
            contractType: pair.contractType,
            volume24h: pair.volume24h.toString(),
            quoteVolume24h: pair.quoteVolume24h.toString(),
            volumeRank: pair.volumeRank,
            updatedAt: new Date(),
          })
          .where(eq(tradingPairs.symbol, pair.symbol));
        updatedCount++;
      }
    }

    // Deactivate pairs that are not in top 50 anymore
    const removedSymbols = [...currentSymbols].filter((s) => !topSymbols.has(s));
    let deactivatedCount = 0;
    if (removedSymbols.length > 0) {
      for (const symbol of removedSymbols) {
        await db
          .update(tradingPairs)
          .set({ status: 'inactive', volumeRank: null, updatedAt: new Date() })
          .where(eq(tradingPairs.symbol, symbol));
        deactivatedCount++;
      }
    }

    const totalSynced = insertedCount + updatedCount + deactivatedCount;

    return NextResponse.json({
      success: true,
      message: `Successfully synced top 50 trading pairs by volume: ${insertedCount} inserted, ${updatedCount} updated, ${deactivatedCount} deactivated`,
      inserted: insertedCount,
      updated: updatedCount,
      deactivated: deactivatedCount,
      total: totalSynced,
      topPairsCount: topPairs.length,
    });
  } catch (error) {
    console.error('Error syncing trading pairs:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync trading pairs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
