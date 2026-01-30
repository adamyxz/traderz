import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { traders } from '@/db/schema';
import { inArray } from 'drizzle-orm';

/**
 * DELETE /api/traders/batch-delete
 * Batch delete multiple traders
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    // Validate ids
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid trader IDs' }, { status: 400 });
    }

    // Batch delete traders
    await db.delete(traders).where(inArray(traders.id, ids));

    return NextResponse.json({
      success: true,
      deleted: ids.length,
    });
  } catch (error) {
    console.error('Error batch deleting traders:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
