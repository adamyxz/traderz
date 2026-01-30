import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { readers, readerParameters } from '@/db/schema';
import { desc, eq, like, or } from 'drizzle-orm';

// GET - 获取所有readers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = db.select().from(readers);

    // 添加搜索条件
    if (search) {
      // @ts-expect-error - Drizzle ORM dynamic where clause
      query = query.where(
        or(like(readers.name, `%${search}%`), like(readers.description || '', `%${search}%`))
      );
    }

    const allReaders = await query.orderBy(desc(readers.createdAt));

    const readersWithParams = await Promise.all(
      allReaders.map(async (reader) => {
        const params = await db
          .select()
          .from(readerParameters)
          .where(eq(readerParameters.readerId, reader.id));
        return { ...reader, parameters: params };
      })
    );

    return NextResponse.json(readersWithParams);
  } catch (error) {
    console.error('Error fetching readers:', error);
    return NextResponse.json({ error: 'Failed to fetch readers' }, { status: 500 });
  }
}

// POST - 创建reader
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newReader = await db
      .insert(readers)
      .values({
        name: body.name,
        description: body.description || null,
        scriptPath: body.scriptPath,
        timeout: body.timeout || 30000,
      })
      .returning();

    const readerId = newReader[0].id;

    if (body.parameters?.length > 0) {
      await db.insert(readerParameters).values(
        body.parameters.map(
          (param: {
            name: string;
            type: string;
            displayName: string;
            description?: string;
            required?: boolean;
            defaultValue?: unknown;
            validation?: { enum?: string[] };
          }) => ({
            readerId,
            paramName: param.name,
            paramType: param.type,
            displayName: param.displayName,
            description: param.description || null,
            isRequired: param.required || false,
            defaultValue:
              param.defaultValue !== undefined ? JSON.stringify(param.defaultValue) : null,
            validationRules: param.validation ? JSON.stringify(param.validation) : null,
            enumValues: param.validation?.enum ? JSON.stringify(param.validation.enum) : null,
          })
        )
      );
    }

    // 获取完整的reader信息
    const parameters = await db
      .select()
      .from(readerParameters)
      .where(eq(readerParameters.readerId, readerId));

    return NextResponse.json({ ...newReader[0], parameters }, { status: 201 });
  } catch (error) {
    console.error('Error creating reader:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create reader' },
      { status: 500 }
    );
  }
}
