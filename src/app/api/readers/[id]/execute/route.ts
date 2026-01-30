import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { readers, readerParameters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { executeReader } from '@/lib/readers/executor';

// POST - 执行reader
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // 获取reader的参数定义（包括默认值）
    const paramDefs = await db
      .select()
      .from(readerParameters)
      .where(eq(readerParameters.readerId, Number(id)));

    // 构建输入参数，使用默认值填充未提供的参数
    const inputWithDefaults: Record<string, unknown> = { ...(body.parameters || {}) };
    for (const paramDef of paramDefs) {
      // 只有当参数未提供且有默认值时才使用默认值
      if (
        !(paramDef.paramName in inputWithDefaults) &&
        paramDef.defaultValue !== null &&
        paramDef.defaultValue !== undefined
      ) {
        try {
          // 尝试解析默认值（可能是JSON字符串）
          inputWithDefaults[paramDef.paramName] = JSON.parse(paramDef.defaultValue);
        } catch {
          // 如果不是JSON，直接使用字符串值
          inputWithDefaults[paramDef.paramName] = paramDef.defaultValue;
        }
      }
    }

    // 执行
    const result = await executeReader({
      reader,
      input: inputWithDefaults,
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
