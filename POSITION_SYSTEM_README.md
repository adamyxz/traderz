# 仓位模型系统实施文档

## 概述

本系统实现了完全模拟币安合约交易的仓位管理系统，支持：

- 1个交易员 → 多个仓位
- 1个交易对 → 多个仓位
- 开仓/平仓手续费扣除
- 每10秒自动更新价格和未实现盈亏
- 爆仓、止损、止盈自动触发

## 已完成功能

### ✅ Phase 1: 数据库层

#### 新增数据表

1. **positions 表（仓位表）**
   - 字段：id, traderId, tradingPairId, side, status, entryPrice, currentPrice, leverage, quantity, positionSize, margin, openFee, closeFee, unrealizedPnl, realizedPnl, stopLossPrice, takeProfitPrice, openedAt, closedAt, updatedAt
   - 索引：traderId, tradingPairId, status, openedAt, (traderId, status)

2. **position_history 表（历史记录表）**
   - 字段：id, positionId, action, price, quantity, pnl, fee, metadata, createdAt
   - 索引：positionId, action, createdAt, (positionId, createdAt)

3. **price_cache 表（价格缓存表）**
   - 字段：id, tradingPairId, price, priceChange24h, priceChangePercent24h, updatedAt
   - 约束：tradingPairId 唯一
   - 索引：updatedAt

#### 枚举类型

- `position_side`: 'long', 'short'
- `position_status`: 'open', 'closed', 'liquidated'
- `history_action`: 'open', 'close', 'liquidate', 'price_update', 'stop_loss_triggered', 'take_profit_triggered', 'margin_added', 'margin_removed'

### ✅ Phase 2: 工具库层

#### 计算工具

1. **fee-calculator.ts** - 手续费计算
   - `calculateOpenFee(positionSize, feeRate)` - 开仓手续费
   - `calculateCloseFee(positionSize, feeRate)` - 平仓手续费
   - `calculatePartialCloseFee(fullPositionSize, closeQuantity, currentPrice, feeRate)` - 部分平仓手续费
   - `calculateTotalFee(positionSize, feeRate)` - 总手续费
   - 费率：默认 0.05% (maker 0.02% + taker 0.04%)

2. **margin-calculator.ts** - 保证金计算
   - `calculateMargin(positionSize, leverage)` - 保证金
   - `calculateQuantity(positionSize, price)` - 数量
   - `calculatePositionSize(quantity, price)` - 仓位大小
   - `calculateMaxPositionSize(margin, leverage)` - 最大仓位
   - `validatePositionSize(positionSize)` - 验证仓位大小

3. **pnl-calculator.ts** - 盈亏计算
   - `calculateUnrealizedPnl(side, entryPrice, currentPrice, quantity)` - 未实现盈亏
   - `calculateUnrealizedPnlPercent(unrealizedPnl, positionSize)` - 盈亏百分比
   - `calculateROE(unrealizedPnl, margin)` - 回报率
   - `calculateRealizedPnl(side, entryPrice, closePrice, quantity)` - 已实现盈亏
   - `calculateNetPnl(pnl, openFee, closeFee)` - 净盈亏

4. **liquidation-calculator.ts** - 爆仓计算
   - `calculateLiquidationPrice(side, entryPrice, leverage, maintenanceMarginRatio)` - 爆仓价格
   - `calculatePriceBuffer(side, currentPrice, liquidationPrice)` - 价格缓冲
   - `calculateLiquidationMarginPercent(priceBuffer, currentPrice)` - 爆仓距离百分比
   - `isNearLiquidation(priceBuffer, currentPrice, threshold)` - 是否接近爆仓
   - `getLiquidationRiskLevel(priceBuffer, currentPrice)` - 风险等级
   - `shouldLiquidate(side, currentPrice, liquidationPrice)` - 是否应该爆仓

5. **stop-calculator.ts** - 止盈止损计算
   - `calculateStopLossPrice(side, entryPrice, stopLossPercent)` - 止损价格
   - `calculateTakeProfitPrice(side, entryPrice, takeProfitPercent)` - 止盈价格
   - `isStopLossTriggered(side, currentPrice, stopLossPrice)` - 是否触发止损
   - `isTakeProfitTriggered(side, currentPrice, takeProfitPrice)` - 是否触发止盈
   - `calculateRiskRewardRatio(entryPrice, stopLossPrice, takeProfitPrice)` - 风险回报比

6. **position-types.ts** - TypeScript类型定义
   - PositionSide, PositionStatus, HistoryAction
   - Position, CreatePositionRequest, PositionCalculation
   - PnlCalculation, PriceData, ClosePositionRequest
   - FEE_RATE, RISK_LIMITS 常量

#### 币安API集成

7. **binance-rest.ts** - 扩展
   - `getSymbolPrice(symbol)` - 获取单个交易对价格
   - `getAllSymbolPrices()` - 批量获取所有交易对价格
   - `get24hPriceChange(symbol)` - 获取24小时价格变化
   - `getAll24hPriceChanges()` - 批量获取24小时价格变化
   - `retryWithBackoff(fn, maxRetries, delay)` - 重试机制
   - `getSymbolPriceWithRetry(symbol)` - 带重试的价格获取

8. **binance-client.ts** - 币安客户端封装
   - 统一错误处理和日志记录
   - 请求统计功能
   - 单例模式

9. **scheduler.ts** - 定时调度器
   - `startScheduler(callback)` - 启动定时器（每10秒）
   - `stopScheduler()` - 停止定时器
   - `isSchedulerRunning()` - 检查运行状态
   - `triggerUpdate(callback)` - 手动触发更新

### ✅ Phase 3: API层

#### API端点

| 端点                           | 方法     | 功能         |
| ------------------------------ | -------- | ------------ |
| `/api/positions`               | POST     | 开仓         |
| `/api/positions`               | GET      | 查询持仓列表 |
| `/api/positions/[id]`          | GET      | 查询持仓详情 |
| `/api/positions/[id]/close`    | POST     | 平仓         |
| `/api/positions/[id]/history`  | GET      | 查询持仓历史 |
| `/api/positions/update-prices` | POST     | 批量更新价格 |
| `/api/positions/sync-prices`   | POST/GET | 定时任务入口 |

#### API功能详情

1. **POST /api/positions** - 开仓
   - 请求体：`{ traderId, tradingPairId, side, leverage, positionSize, entryPrice?, stopLossPrice?, takeProfitPrice? }`
   - 验证交易员限制（杠杆范围、仓位大小、做空权限）
   - 自动计算保证金、数量、手续费
   - 自动计算爆仓价格
   - 记录开仓历史

2. **GET /api/positions** - 查询持仓列表
   - 查询参数：`traderId?`, `status?`, `tradingPairId?`
   - 返回关联的交易员和交易对信息
   - 按开仓时间倒序

3. **GET /api/positions/[id]** - 查询持仓详情
   - 返回完整的仓位信息
   - 包含关联的交易员和交易对信息

4. **POST /api/positions/[id]/close** - 平仓
   - 请求体：`{ quantity?, closePrice? }`
   - 支持部分平仓或全部平仓
   - 自动计算平仓手续费和已实现盈亏
   - 更新仓位状态
   - 记录平仓历史

5. **GET /api/positions/[id]/history** - 查询持仓历史
   - 查询参数：`limit?`, `offset?`
   - 返回所有历史操作记录
   - 按时间倒序

6. **POST /api/positions/update-prices** - 批量更新价格
   - 获取所有开仓的持仓
   - 批量获取交易对价格
   - 更新 currentPrice 和 unrealizedPnl
   - 检查并触发爆仓、止损、止盈
   - 更新价格缓存
   - 记录价格更新历史

7. **POST /api/positions/sync-prices** - 定时任务入口
   - 内部调用 update-prices API
   - 返回同步状态和时间戳

## 核心计算逻辑

### 手续费计算

```
费率: 0.05% (maker 0.02% + taker 0.04% 平均)
开仓手续费 = positionSize × 0.0005
平仓手续费 = positionSize × 0.0005
```

### 保证金计算

```
保证金 = positionSize / leverage
数量 = positionSize / entryPrice
```

### 未实现盈亏计算

```
做多: (currentPrice - entryPrice) × quantity
做空: (entryPrice - currentPrice) × quantity
盈亏百分比 = (盈亏 / positionSize) × 100
ROE = (盈亏 / margin) × 100
```

### 爆仓价格计算

```
做多: entryPrice × (1 - 1/leverage + 0.005)
做空: entryPrice × (1 + 1/leverage - 0.005)
```

### 止盈止损计算

```
做多止损: entryPrice × (1 - stopLossPercent/100)
做多止盈: entryPrice × (1 + takeProfitPercent/100)
做空止损: entryPrice × (1 + stopLossPercent/100)
做空止盈: entryPrice × (1 - takeProfitPercent/100)
```

## 使用示例

### 开仓示例

```bash
curl -X POST http://localhost:3000/api/positions \
  -H "Content-Type: application/json" \
  -d '{
    "traderId": 1,
    "tradingPairId": 1,
    "side": "long",
    "leverage": 10,
    "positionSize": 1000,
    "stopLossPrice": 95000,
    "takeProfitPrice": 105000
  }'
```

响应：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "traderId": 1,
    "tradingPairId": 1,
    "side": "long",
    "status": "open",
    "entryPrice": "100000",
    "currentPrice": "100000",
    "leverage": "10",
    "quantity": "0.01",
    "positionSize": "1000",
    "margin": "100",
    "openFee": "0.5",
    "liquidationPrice": 90950
  }
}
```

### 平仓示例

```bash
curl -X POST http://localhost:3000/api/positions/1/close \
  -H "Content-Type: application/json"
```

响应：

```json
{
  "success": true,
  "data": {
    "closePrice": 101000,
    "closeFee": "0.5",
    "realizedPnl": 10,
    "netPnl": 9,
    "isFullyClosed": true
  }
}
```

### 价格更新示例

```bash
curl -X POST http://localhost:3000/api/positions/update-prices
```

响应：

```json
{
  "success": true,
  "data": {
    "updated": 5,
    "liquidated": 0,
    "stopLossTriggered": 1,
    "takeProfitTriggered": 0,
    "duration": 1234
  }
}
```

## 定时任务配置

### 启动定时器（每10秒）

```typescript
import { startScheduler } from '@/lib/trading/scheduler';

startScheduler(async () => {
  await fetch('/api/positions/update-prices', { method: 'POST' });
});
```

### 在应用启动时启动

```typescript
// app/layout.tsx 或 server startup script
useEffect(() => {
  // 仅在服务器端启动
  if (typeof window === 'undefined') {
    startScheduler();
  }
}, []);
```

## 测试验证

### 1. 开仓测试

```bash
# 验证点：
# - 保证金 = positionSize / leverage
# - 数量 = positionSize / entryPrice
# - 手续费 = positionSize × 0.0005
# - 爆仓价格计算正确
```

### 2. 价格更新测试

```bash
POST /api/positions/update-prices
# 验证：
# - 所有持仓的 currentPrice 已更新
# - unrealizedPnl 计算正确
# - price_cache 已更新
```

### 3. 平仓测试

```bash
POST /api/positions/[id]/close
# 验证：
# - status = closed
# - realizedPnl 计算正确
# - closeFee 已扣除
# - closedAt 已设置
```

### 4. 爆仓测试

```bash
# 创建高杠杆仓位（如125x）
# 等待价格更新或手动触发极端价格
# 验证：
# - status = liquidated
# - closedAt 已设置
```

### 5. 定时任务测试

```bash
# 启动定时器，等待30秒
# 验证：
# - 价格至少更新了2次（每10秒一次）
# - position_history 有相应记录
```

## 文件清单

### 已创建的文件

```
src/
├── lib/trading/
│   ├── position-types.ts          # 类型定义
│   ├── fee-calculator.ts          # 手续费计算
│   ├── margin-calculator.ts       # 保证金计算
│   ├── pnl-calculator.ts          # 盈亏计算
│   ├── liquidation-calculator.ts  # 爆仓计算
│   ├── stop-calculator.ts         # 止盈止损计算
│   ├── binance-client.ts          # 币安客户端
│   ├── binance-rest.ts            # 币安API（扩展）
│   └── scheduler.ts               # 定时调度器
├── app/api/positions/
│   ├── route.ts                   # 开仓 + 列表查询
│   ├── [id]/
│   │   └── route.ts               # 仓位详情
│   ├── [id]/close/
│   │   └── route.ts               # 平仓
│   ├── [id]/history/
│   │   └── route.ts               # 历史记录
│   ├── update-prices/
│   │   └── route.ts               # 批量更新价格
│   └── sync-prices/
│       └── route.ts               # 定时任务入口
└── db/
    └── schema.ts                  # 数据库schema（扩展）
```

### 已修改的文件

```
src/
└── db/
    └── schema.ts                  # 添加3个新表
```

## 数据库迁移

### 已应用的迁移

```bash
# 迁移文件: drizzle/0007_position_model.sql
# 包含：
# - 3个新枚举类型
# - 3个新表
# - 7个索引
# - 3个外键约束
```

### 手动应用迁移

如果需要手动应用迁移：

```bash
# 方式1: 使用 drizzle-kit push（已应用）
npx drizzle-kit push

# 方式2: 直接执行SQL文件
psql $DATABASE_URL -f drizzle/0007_position_model.sql
```

## 注意事项

1. **数据精度**：使用 numeric 类型存储金额和价格，确保精度
2. **外键约束**：positions 删除时级联删除历史记录
3. **索引优化**：为常用查询字段创建索引
4. **错误处理**：币安 API 调用失败时记录日志并重试
5. **性能考虑**：批量更新价格时使用数据库事务
6. **风险控制**：开仓前验证交易员的限制
7. **定时任务**：确保定时器在应用启动时启动

## 后续扩展（可选）

- [ ] 前端UI页面展示持仓列表
- [ ] 实时WebSocket推送价格更新
- [ ] 持仓统计和分析功能
- [ ] 风险预警系统
- [ ] 持仓调整功能（加仓、减仓）
- [ ] 移动平均止损/止盈
- [ ] 部分平仓支持UI
- [ ] 持仓盈亏曲线图
- [ ] 交易员绩效统计

## 参考文档

- [币安合约API](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)
- [币安手续费率](https://www.binance.com/en/fee/futureFee)
- [Drizzle ORM](https://orm.drizzle.team/)

## 贡献者

- Implementation Date: 2025-01-30
- Version: 1.0.0
