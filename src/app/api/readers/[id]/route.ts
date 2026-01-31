import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { readers, readerParameters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { rm, rename, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// GET - 获取单个reader
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const readerResult = await db
      .select()
      .from(readers)
      .where(eq(readers.id, Number(id)));

    if (!readerResult[0]) {
      return NextResponse.json({ error: 'Reader not found' }, { status: 404 });
    }

    const parameters = await db
      .select()
      .from(readerParameters)
      .where(eq(readerParameters.readerId, readerResult[0].id));

    return NextResponse.json({ ...readerResult[0], parameters });
  } catch (error) {
    console.error('Error fetching reader:', error);
    return NextResponse.json({ error: 'Failed to fetch reader' }, { status: 500 });
  }
}

// PUT - 更新reader
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 先获取现有reader信息
    const existingReader = await db
      .select()
      .from(readers)
      .where(eq(readers.id, Number(id)));

    if (!existingReader[0]) {
      return NextResponse.json({ error: 'Reader not found' }, { status: 404 });
    }

    const reader = existingReader[0];
    const oldName = reader.name;
    const newName = body.name;
    const oldScriptPath = reader.scriptPath; // e.g., "readers/kline-fetcher/index.ts"

    // 提取目录信息
    const oldDir = oldScriptPath.replace(/\/[^/]+$/, ''); // "readers/kline-fetcher"
    const newDir = `readers/${newName}`;
    const metadataPath = join(process.cwd(), oldDir, 'metadata.json');

    // 如果name改变，需要重命名目录
    let newScriptPath = oldScriptPath;
    if (oldName !== newName) {
      const oldFullPath = join(process.cwd(), oldDir);
      const newFullPath = join(process.cwd(), newDir);

      // 检查新目录是否已存在
      if (existsSync(newFullPath)) {
        return NextResponse.json(
          { error: `Reader with name "${newName}" already exists` },
          { status: 400 }
        );
      }

      // 重命名目录
      await rename(oldFullPath, newFullPath);
      newScriptPath = `${newDir}/index.ts`;
      console.log(`Renamed reader directory: ${oldDir} -> ${newDir}`);
    }

    // 更新metadata.json文件
    if (existsSync(metadataPath)) {
      try {
        const metadataContent = await readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);

        // 更新name, description, mandatory
        metadata.name = newName;
        metadata.description = body.description;
        metadata.mandatory = body.mandatory || false;

        // 写回文件
        const newMetadataPath = join(process.cwd(), newDir, 'metadata.json');
        await writeFile(newMetadataPath, JSON.stringify(metadata, null, 2));
        console.log(`Updated metadata.json for ${newName}`);
      } catch (fileError) {
        console.error('Failed to update metadata.json:', fileError);
        return NextResponse.json({ error: 'Failed to update metadata.json file' }, { status: 500 });
      }
    }

    // 更新数据库
    const updatedReader = await db
      .update(readers)
      .set({
        name: newName,
        description: body.description,
        timeout: body.timeout,
        scriptPath: newScriptPath,
        mandatory: body.mandatory || false,
        updatedAt: new Date(),
      })
      .where(eq(readers.id, Number(id)))
      .returning();

    // Update parameter default values if provided
    if (body.parameters && Array.isArray(body.parameters)) {
      for (const param of body.parameters) {
        if (param.id !== undefined && param.defaultValue !== undefined) {
          await db
            .update(readerParameters)
            .set({ defaultValue: param.defaultValue })
            .where(eq(readerParameters.id, param.id));
        }
      }
    }

    // 获取更新后的参数
    const parameters = await db
      .select()
      .from(readerParameters)
      .where(eq(readerParameters.readerId, Number(id)));

    return NextResponse.json({ ...updatedReader[0], parameters });
  } catch (error) {
    console.error('Error updating reader:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update reader' },
      { status: 500 }
    );
  }
}

// DELETE - 删除reader
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 先获取reader信息，以便删除文件
    const readerResult = await db
      .select()
      .from(readers)
      .where(eq(readers.id, Number(id)));

    if (!readerResult[0]) {
      return NextResponse.json({ error: 'Reader not found' }, { status: 404 });
    }

    const reader = readerResult[0];

    // 删除数据库记录
    const deletedReader = await db
      .delete(readers)
      .where(eq(readers.id, Number(id)))
      .returning();

    if (!deletedReader[0]) {
      return NextResponse.json({ error: 'Reader not found' }, { status: 404 });
    }

    // 删除文件系统中的reader目录
    // scriptPath格式: readers/reader-name/index.ts
    // 提取目录路径
    const scriptPath = reader.scriptPath; // e.g., "readers/kline-fetcher/index.ts"
    const readerDir = scriptPath.replace(/\/[^/]+$/, ''); // "readers/kline-fetcher"
    const fullPath = join(process.cwd(), readerDir);

    try {
      if (existsSync(fullPath)) {
        await rm(fullPath, { recursive: true, force: true });
        console.log(`Deleted reader directory: ${fullPath}`);
      }
    } catch (fileError) {
      // 文件删除失败不影响数据库删除的成功，只记录错误
      console.error('Failed to delete reader files:', fileError);
    }

    return NextResponse.json({
      message: 'Reader deleted successfully',
      filesDeleted: existsSync(fullPath) ? false : true,
    });
  } catch (error) {
    console.error('Error deleting reader:', error);
    return NextResponse.json({ error: 'Failed to delete reader' }, { status: 500 });
  }
}
