export type ProviderType = 'GEMINI' | 'GROQ' | 'OPENROUTER' | 'CUSTOM' | 'YOUTUBE';

export type TaskType = 'vision' | 'long_context' | 'fast_generation';

export type KeyStatus = 'HEALTHY' | 'COOLDOWN' | 'EXHAUSTED_TODAY' | 'INVALID';

export type RotationStrategy = 'PRIORITY_FAILOVER' | 'ROUND_ROBIN';

export interface ModelHealthEntry {
  status: KeyStatus;
  cooldownUntil?: string | null;
  exhaustedUntil?: string | null;
  lastError?: string | null;
  requests?: number;
  failures?: number;
}

export type ModelHealthMap = Record<string, ModelHealthEntry>;

export interface ImageAttachment {
  mimeType: string;
  base64Data: string;
}

export interface GenerateRequest {
  taskType: TaskType;
  prompt: string;
  systemPrompt?: string;
  jsonMode?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  images?: ImageAttachment[];
  preferredProvider?: ProviderType;
  preferredModel?: string;
  jobId?: string;
  allowZeroKeyFallback?: boolean;
}

export interface GenerateResult {
  text: string;
  provider: ProviderType;
  model: string;
  keyId: string;
  keyLabel: string;
  latencyMs: number;
  failovers: number;
}

export interface ProviderCallParams {
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  jsonMode?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  images?: ImageAttachment[];
  baseUrl?: string | null;
  timeoutMs?: number;
}

export interface ProviderErrorInfo {
  status: number;
  message: string;
  retryAfterSeconds?: number;
  headers?: Record<string, string>;
  rawBody?: string;
}

export interface ProviderTestResult {
  ok: boolean;
  provider: ProviderType;
  testedModel: string;
  models: string[];
  message: string;
  latencyMs: number;
}

export class ProviderHttpError extends Error {
  status: number;
  retryAfterSeconds?: number;
  headers: Record<string, string>;
  rawBody?: string;

  constructor(info: ProviderErrorInfo) {
    super(info.message);
    this.name = 'ProviderHttpError';
    this.status = info.status;
    this.retryAfterSeconds = info.retryAfterSeconds;
    this.headers = info.headers ?? {};
    this.rawBody = info.rawBody;
  }
}

export class AllKeysExhaustedError extends Error {
  retryAfterSeconds: number;
  attempts: string[];
  zeroKeyPrompt?: string;

  constructor(message: string, retryAfterSeconds = 65, attempts: string[] = [], zeroKeyPrompt?: string) {
    super(message);
    this.name = 'AllKeysExhaustedError';
    this.retryAfterSeconds = retryAfterSeconds;
    this.attempts = attempts;
    this.zeroKeyPrompt = zeroKeyPrompt;
  }
}

export type TransportHandler = (
  provider: ProviderType,
  keyId: string,
  params: ProviderCallParams
) => Promise<string>;
