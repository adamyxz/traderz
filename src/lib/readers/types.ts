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

// Reader元数据
export interface ReaderMetadata {
  name: string;
  description: string;
  parameters: ReaderParameterDefinition[];
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
