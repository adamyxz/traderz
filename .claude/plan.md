# Trading页面K线图表重构计划

## 需求分析

### 核心变更

1. **添加图表流程**: 点击"添加图表"按钮 → 弹出对话框选择交易对和周期 → 确认添加
2. **自动布局**: 根据图表数量自动适应布局，一行最多4张图表
3. **自动连接管理**: 添加图表时自动启动连接，删除图表时自动停止连接
4. **高度调整**: 图表高度减少50%（从400px → 200px）
5. **移除控件**: 删除布局选择器和启动/停止按钮

## 实施计划

### 1. 创建添加图表对话框组件

**文件**: `src/app/admin/trading/components/add-chart-modal.tsx`

- 交易对选择下拉框
- 周期选择下拉框
- 确认/取消按钮

### 2. 修改 MultiChartContainer 组件

**文件**: `src/app/admin/trading/components/multi-chart-container.tsx`

**删除内容**:

- 布局选择器相关代码 (lines 245-266)
- `MAX_CHARTS` 常量
- `layout` 状态
- `handleLayoutChange` 函数
- `getGridClass` 函数

**新增/修改内容**:

- 添加 `showAddModal` 状态控制对话框显示
- 修改 `handleAddChart` 函数，接收 `symbol` 和 `interval` 参数
- 修改 `handleDeleteChart`，删除时自动停止连接（设置 `isRunning: false`）
- 自动网格布局逻辑：根据图表数量计算列数
  - 1张图表: 1列
  - 2张图表: 2列
  - 3张图表: 3列
  - 4+张图表: 4列

### 3. 修改 ChartCard 组件

**文件**: `src/app/admin/trading/components/chart-card.tsx`

**删除内容**:

- 启动/停止按钮 (lines 128-142)
- `handleToggleRunning` 函数

**修改内容**:

- 图表容器最小高度从 `min-h-[400px]` 改为 `min-h-[200px]`
- 交易对和周期选择器在运行时也禁用

### 4. 修改 TradingChart 组件（如需要）

检查 `isRunning` 属性变化时的连接管理逻辑，确保：

- 组件卸载时自动断开连接
- `isRunning` 从 true 变 false 时停止连接

## 实现细节

### 自动网格布局算法

```typescript
const getGridCols = (chartCount: number): string => {
  if (chartCount === 1) return 'grid-cols-1';
  if (chartCount === 2) return 'grid-cols-2';
  if (chartCount === 3) return 'grid-cols-3';
  return 'grid-cols-4'; // 4+ charts
};
```

### 添加图表流程

1. 用户点击"添加图表"按钮
2. 显示 `AddChartModal` 对话框
3. 用户选择交易对和周期，点击确认
4. 调用 `handleAddChart(symbol, interval)`，创建 `isRunning: true` 的新图表
5. 自动保存配置

### 删除图表流程

1. 用户点击删除按钮
2. 调用 `handleDeleteChart(id)`
3. 图表被移除，TradingChart 组件卸载
4. useEffect 清理函数自动断开连接

## 文件修改清单

1. ✏️ **新建**: `src/app/admin/trading/components/add-chart-modal.tsx`
2. ✏️ **修改**: `src/app/admin/trading/components/multi-chart-container.tsx`
3. ✏️ **修改**: `src/app/admin/trading/components/chart-card.tsx`

## 风险评估

- **低风险**: UI层面的重构，不影响核心交易逻辑
- **数据持久化**: 保留配置保存功能，但移除布局相关字段
- **兼容性**: 需要处理已保存的旧配置（包含 layout 字段）

## 测试要点

1. 添加图表对话框正确显示和隐藏
2. 添加图表后自动连接
3. 删除图表后自动断开
4. 网格布局根据图表数量正确调整
5. 图表高度正确减少
6. 全屏功能正常工作
