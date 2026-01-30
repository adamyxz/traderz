# Trader-Reader 多对多关系实现计划

## 概述

在 Trader 和 Reader 之间建立多对多关系，允许在创建/编辑 Trader 时多选 Reader。

## 需要修改的文件

### 1. 数据库 Schema (`src/db/schema.ts`)

**变更**: 添加 `traderReaders` 关系表

```typescript
// 交易员与Reader多对多关联表
export const traderReaders = pgTable(
  'trader_readers',
  {
    traderId: integer('trader_id')
      .notNull()
      .references(() => traders.id, { onDelete: 'cascade' }),
    readerId: integer('reader_id')
      .notNull()
      .references(() => readers.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.traderId, table.readerId] }),
    traderIdx: index('trader_readers_trader_idx').on(table.traderId),
    readerIdx: index('trader_readers_reader_idx').on(table.readerId),
  })
);
```

### 2. Trader API (`src/app/api/traders/route.ts`)

**变更**:

- 导入 `readers` 和 `traderReaders`
- 更新 `TraderWithRelations` 类型，添加 `readers?: Reader[]`
- GET: 查询并返回关联的 readers
- POST: 创建 trader-reader 关系

### 3. Trader API (`src/app/api/traders/[id]/route.ts`)

**变更**:

- 导入 `readers` 和 `traderReaders`
- 更新 `TraderWithRelations` 类型，添加 `readers?: Reader[]`
- GET: 查询并返回关联的 readers
- PUT: 更新 trader-reader 关系（先删除再插入）
- DELETE: 删除关联的 trader-reader 关系

### 4. 创建 Trader 模态框 (`src/app/admin/traders/create-trader-modal.tsx`)

**变更**:

- 添加 `Reader` interface 和 `readers` 状态
- 在 `useEffect` 中获取 readers 列表
- 在 formData 中添加 `preferredReaderIds: number[]`
- 在"偏好设置"部分添加 Reader 多选 UI（类似 Kline Intervals 的样式）

### 5. 编辑 Trader 模态框 (`src/app/admin/traders/edit-trader-modal.tsx`)

**变更**:

- 添加 `Reader` interface 和 `readers` 状态
- 在 `useEffect` 中获取 readers 列表
- 在 formData 中添加 `preferredReaderIds: number[]`
- 初始化时从 `trader.readers` 获取已选的 readers
- 在"偏好设置"部分添加 Reader 多选 UI

## UI 设计

Reader 多选区域采用与 Kline Intervals 相同的卡片式勾选设计：

- 网格布局展示所有可用 readers
- 已选的 reader 显示高亮边框和背景色
- 显示 reader 的 name 和 description
- 底部显示已选数量统计

## 数据库迁移

需要创建并运行迁移来添加 `trader_readers` 表：

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```
