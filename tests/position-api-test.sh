#!/bin/bash

# 仓位模型系统 API 测试脚本
# 测试所有端点功能

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=========================================="
echo "仓位模型系统 API 测试"
echo "BASE_URL: $BASE_URL"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
PASSED=0
FAILED=0

# 测试函数
test_api() {
  local test_name=$1
  local method=$2
  local endpoint=$3
  local data=$4

  echo -e "${YELLOW}测试:${NC} $test_name"
  echo "请求: $method $endpoint"

  if [ -z "$data" ]; then
    response=$(curl -s -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json")
  else
    echo "数据: $data"
    response=$(curl -s -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  echo "响应: $response"
  echo ""

  # 检查响应是否包含 success: true
  if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ 测试通过${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ 测试失败${NC}"
    FAILED=$((FAILED + 1))
  fi

  echo "----------------------------------------"
  echo ""

  # 返回响应供后续使用
  echo "$response"
}

# 1. 测试查询持仓列表（初始状态）
echo "1. 查询持仓列表（初始状态）"
test_api "查询持仓列表" "GET" "/api/positions" ""

# 2. 测试开仓（做多）
echo "2. 开仓测试（做多）"
open_response=$(test_api "开仓-做多BTCUSDT" "POST" "/api/positions" '{
  "traderId": 1,
  "tradingPairId": 1,
  "side": "long",
  "leverage": 10,
  "positionSize": 1000
}')

# 提取 position ID
position_id=$(echo "$open_response" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
echo "创建的仓位ID: $position_id"
echo ""

# 3. 测试查询持仓详情
if [ ! -z "$position_id" ]; then
  echo "3. 查询持仓详情"
  test_api "查询仓位详情" "GET" "/api/positions/$position_id" ""

  # 4. 测试查询持仓历史
  echo "4. 查询持仓历史"
  test_api "查询仓位历史" "GET" "/api/positions/$position_id/history" ""

  # 5. 测试价格更新
  echo "5. 批量更新价格"
  test_api "批量更新价格" "POST" "/api/positions/update-prices" ""

  # 6. 测试平仓
  echo "6. 平仓测试"
  test_api "平仓仓位" "POST" "/api/positions/$position_id/close" '{}'
fi

# 7. 测试开仓（做空）
echo "7. 开仓测试（做空）"
test_api "开仓-做空BTCUSDT" "POST" "/api/positions" '{
  "traderId": 1,
  "tradingPairId": 1,
  "side": "short",
  "leverage": 5,
  "positionSize": 500,
  "stopLossPrice": 105000,
  "takeProfitPrice": 95000
}'

# 8. 测试带止盈止损的开仓
echo "8. 开仓测试（带止盈止损）"
test_api "开仓-带止盈止损" "POST" "/api/positions" '{
  "traderId": 1,
  "tradingPairId": 1,
  "side": "long",
  "leverage": 20,
  "positionSize": 2000,
  "stopLossPrice": 98000,
  "takeProfitPrice": 102000
}'

# 9. 测试定时任务入口
echo "9. 测试定时任务同步"
test_api "定时任务同步" "POST" "/api/positions/sync-prices" ""

# 10. 最终查询持仓列表
echo "10. 查询持仓列表（最终状态）"
test_api "查询持仓列表" "GET" "/api/positions" ""

# 测试结果汇总
echo "=========================================="
echo "测试结果汇总"
echo "=========================================="
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
echo "总计: $((PASSED + FAILED))"
echo "=========================================="

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}所有测试通过！${NC}"
  exit 0
else
  echo -e "${RED}有测试失败，请检查日志${NC}"
  exit 1
fi
