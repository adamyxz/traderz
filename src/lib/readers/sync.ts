import { db } from '@/db';
import { readers, readerParameters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { existsSync } from 'fs';

type DB = typeof db;

export async function syncReadersFromDirectory(args: { readersDirectory: string; db: DB }) {
  const { readersDirectory, db } = args;

  let created = 0,
    updated = 0,
    skipped = 0;
  const errors: string[] = [];

  try {
    const entries = await readdir(readersDirectory, { withFileTypes: true });
    const readerDirs = entries.filter((e) => e.isDirectory());

    for (const readerDir of readerDirs) {
      try {
        const indexPath = join(readersDirectory, readerDir.name, 'index.ts');

        if (!existsSync(indexPath)) {
          skipped++;
          continue;
        }

        const content = await readFile(indexPath, 'utf-8');
        const hash = createHash('md5').update(content).digest('hex');

        // 首先尝试从metadata.json读取
        const metadataPath = join(readersDirectory, readerDir.name, 'metadata.json');
        let metadata;

        if (existsSync(metadataPath)) {
          const metadataContent = await readFile(metadataPath, 'utf-8');
          metadata = JSON.parse(metadataContent);
        } else {
          // 如果没有metadata.json，跳过此reader
          errors.push(`${readerDir.name}: No metadata.json found`);
          continue;
        }

        if (!metadata) {
          errors.push(`${readerDir.name}: Missing metadata`);
          continue;
        }

        // 检查是否存在
        const existing = await db.select().from(readers).where(eq(readers.name, metadata.name));

        if (existing.length > 0) {
          const reader = existing[0];

          // 只有内容变化时更新
          if (reader.scriptHash !== hash) {
            await db
              .update(readers)
              .set({
                description: metadata.description,
                scriptHash: hash,
                updatedAt: new Date(),
              })
              .where(eq(readers.id, reader.id));

            // 更新参数
            await db.delete(readerParameters).where(eq(readerParameters.readerId, reader.id));

            if (metadata.parameters?.length > 0) {
              await db.insert(readerParameters).values(
                metadata.parameters.map(
                  (param: {
                    name: string;
                    type: string;
                    displayName: string;
                    description?: string;
                    required?: boolean;
                    defaultValue?: unknown;
                    validation?: { enum?: string[] };
                  }) => ({
                    readerId: reader.id,
                    paramName: param.name,
                    paramType: param.type,
                    displayName: param.displayName,
                    description: param.description || null,
                    isRequired: param.required || false,
                    defaultValue:
                      param.defaultValue !== undefined ? JSON.stringify(param.defaultValue) : null,
                    validationRules: param.validation ? JSON.stringify(param.validation) : null,
                    enumValues: param.validation?.enum
                      ? JSON.stringify(param.validation.enum)
                      : null,
                  })
                )
              );
            }

            updated++;
          } else {
            skipped++;
          }
        } else {
          // 创建新reader
          const newReader = await db
            .insert(readers)
            .values({
              name: metadata.name,
              description: metadata.description,
              scriptPath: `readers/${readerDir.name}/index.ts`,
              scriptHash: hash,
            })
            .returning();

          const readerId = newReader[0].id;

          if (metadata.parameters?.length > 0) {
            await db.insert(readerParameters).values(
              metadata.parameters.map(
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

          created++;
        }
      } catch (error) {
        errors.push(
          `${readerDir.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  } catch (error) {
    errors.push(`Directory error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    synced: created + updated,
    created,
    updated,
    skipped,
    errors,
  };
}
