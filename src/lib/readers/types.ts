// Reader输入/输出接口
export interface ReaderInput {
  [key: string]: unknown;
}

export interface ReaderOutput<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTime: number;
    timestamp: string;
    version: string;
  };
}

// Reader执行上下文
export interface ReaderContext {
  readerId: string;
  requestId: string;
  triggeredBy: string;
  timestamp: string;
  environment: 'development' | 'production';
}

// Reader函数签名
export type ReaderFunction<TInput = ReaderInput, TOutput = unknown> = (
  input: TInput,
  context: ReaderContext
) => Promise<ReaderOutput<TOutput>>;

// Reader参数定义
export interface ReaderParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum';
  displayName: string;
  description?: string;
  required: boolean;
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

// Reader模块导出格式
export interface ReaderModule {
  metadata: ReaderMetadata;
  execute: ReaderFunction;
  validate?: (input: ReaderInput) => { valid: boolean; errors?: string[] };
}

// 标准参数类型（由 executor 自动注入）
export type StandardParameterType = 'symbol' | 'interval';

// Reader元数据
export interface ReaderMetadata {
  name: string;
  description: string;
  parameters: ReaderParameterDefinition[];
  // 声明需要哪些标准参数，executor 会自动注入
  // 支持参数别名映射，例如 { period: 'interval' } 表示 reader 的 'period' 参数接收 executor 的 'interval' 值
  standardParameters?: Partial<Record<StandardParameterType, string>>;
  // 是否为强制 reader（所有 trader 心跳都会包含）
  mandatory?: boolean;
}

// Reader database type
export interface Reader {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  scriptPath: string;
  scriptHash: string | null;
  timeout: number;
  mandatory: boolean; // Whether reader is mandatory (always included in heartbeats)
  parameters?: ReaderParameter[];
}

// Reader parameter database type
export interface ReaderParameter {
  id: number;
  readerId: number;
  paramName: string;
  paramType: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum';
  displayName: string;
  description: string | null;
  isRequired: boolean;
  defaultValue: string | null;
  validationRules: string | null;
  enumValues: string | null;
}
