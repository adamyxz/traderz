import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { readers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { executeReader } from '@/lib/readers/executor';

// POST - 执行reader
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _startTime = Date.now();

  try {
    const { id } = await params;
    const body = await request.json();

    const readerResult = await db
      .select()
      .from(readers)
      .where(eq(readers.id, Number(id)));

    if (!readerResult[0]) {
      return NextResponse.json({ error: 'Reader not found' }, { status: 404 });
    }

    const reader = readerResult[0];

    // 执行
    const result = await executeReader({
      reader,
      input: body.parameters || {},
      context: {
        readerId: reader.name,
        requestId: crypto.randomUUID(),
        triggeredBy: body.triggeredBy || 'api',
        timestamp: new Date().toISOString(),
        environment:
          (process.env.NODE_ENV as 'development' | 'production' | undefined) ?? 'development',
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error executing reader:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      },
      { status: 500 }
    );
  }
}
