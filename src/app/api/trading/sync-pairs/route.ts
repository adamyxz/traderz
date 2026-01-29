import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tradingPairs } from '@/db/schema';
import { getExchangeInfo } from '@/lib/trading/binance-rest';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    // Fetch trading pairs from Binance
    const binancePairs = await getExchangeInfo();

    // Get current pairs from database
    const currentPairs = await db.select().from(tradingPairs);
    const currentSymbols = new Set(currentPairs.map((p) => p.symbol));
    const binanceSymbols = new Set(binancePairs.map((p) => p.symbol));

    // Find new pairs to insert
    const newPairs = binancePairs.filter((p) => !currentSymbols.has(p.symbol));

    // Find existing pairs to update (if needed)
    const existingPairs = binancePairs.filter((p) => currentSymbols.has(p.symbol));

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
          }))
        )
        .returning();
      insertedCount = inserted.length;
    }

    // Update existing pairs (only if status changes to inactive)
    let updatedCount = 0;
    for (const pair of existingPairs) {
      const currentPair = currentPairs.find((p) => p.symbol === pair.symbol);
      // Only update if status needs to change
      if (currentPair && currentPair.status !== pair.status) {
        await db
          .update(tradingPairs)
          .set({
            status: pair.status,
            baseAsset: pair.baseAsset,
            quoteAsset: pair.quoteAsset,
            contractType: pair.contractType,
          })
          .where(eq(tradingPairs.symbol, pair.symbol));
        updatedCount++;
      }
    }

    // Mark pairs that no longer exist on Binance as inactive
    const removedSymbols = [...currentSymbols].filter((s) => !binanceSymbols.has(s));
    let deactivatedCount = 0;
    if (removedSymbols.length > 0) {
      for (const symbol of removedSymbols) {
        await db
          .update(tradingPairs)
          .set({ status: 'inactive' })
          .where(eq(tradingPairs.symbol, symbol));
        deactivatedCount++;
      }
    }

    const totalSynced = insertedCount + updatedCount + deactivatedCount;

    return NextResponse.json({
      success: true,
      message: `Successfully synced trading pairs: ${insertedCount} inserted, ${updatedCount} updated, ${deactivatedCount} deactivated`,
      inserted: insertedCount,
      updated: updatedCount,
      deactivated: deactivatedCount,
      total: totalSynced,
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
