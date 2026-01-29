import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tradingPairs } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const pairs = await db.select().from(tradingPairs).where(eq(tradingPairs.status, 'active'));
    return NextResponse.json(pairs);
  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    return NextResponse.json({ error: 'Failed to fetch trading pairs' }, { status: 500 });
  }
}
