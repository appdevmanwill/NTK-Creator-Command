import { prisma } from '@/lib/db';
import {
  DEFAULT_TASK_ROUTING,
  PROVIDER_CAPABILITY_DEFAULTS,
  getModelChainForProvider,
  getResetWindowForProvider,
} from './catalog';
import { decryptApiKey } from './crypto';
import { callCustomOpenAIGenerate, testAndListCustomModels } from './providers/custom';
import { callGeminiGenerate, testAndListGeminiModels } from './providers/gemini';
import { callGroqGenerate, testAndListGroqModels } from './providers/groq';
import { callOpenRouterGenerate, testAndListOpenRouterModels } from './providers/openrouter';
import {
  AllKeysExhaustedError,
  GenerateRequest,
  GenerateResult,
  KeyStatus,
  ModelHealthMap,
  ProviderCallParams,
  ProviderHttpError,
  ProviderTestResult,
  ProviderType,
  RotationStrategy,
  TaskType,
  TransportHandler,
} from './types';

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function ensureRouterConfig() {
  let cfg = await prisma.routerConfig.findUnique({ where: { id: 'default' } });
  if (!cfg) {
    cfg = await prisma.routerConfig.create({
      data: {
        id: 'default',
        rotationStrategy: 'PRIORITY_FAILOVER',
        zeroKeyFallbackEnabled: true,
        taskRoutingJson: JSON.stringify(DEFAULT_TASK_ROUTING),
        roundRobinCursor: 0,
      },
    });
  }
  return cfg;
}

export function buildZeroKeyMetaPrompt(
  taskTitle: string,
  instructions: string,
  schemaHint?: string
): string {
  return [
    `# NTK CREATOR COMMAND — ZERO-KEY MASTER META-PROMPT`,
    `## Task: ${taskTitle}`,
    ``,
    `You can paste this prompt into Gemini, ChatGPT, Claude, or any free AI chat window, then paste the response back into NTK Creator Command to compile your final downloadable package.`,
    ``,
    `### Instructions`,
    instructions.trim(),
    schemaHint
      ? `\n### Required Output Structure (Strict JSON preferred)\n\`\`\`json\n${schemaHint.trim()}\n\`\`\``
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function isDailyExhaustionError(err: ProviderHttpError): boolean {
  const msg = `${err.message} ${err.rawBody ?? ''}`.toLowerCase();
  return (
    msg.includes('rpd') ||
    msg.includes('tpd') ||
    msg.includes('perday') ||
    msg.includes('per day') ||
    msg.includes('daily') ||
    msg.includes('free-models-per-day') ||
    msg.includes('quota exceeded for metric') && msg.includes('day')
  );
}

function classifyProviderError(
  provider: ProviderType,
  err: unknown
): {
  kind: 'COOLDOWN' | 'EXHAUSTED_TODAY' | 'INVALID' | 'MODEL_UNAVAILABLE';
  status?: number;
  cooldownUntil?: Date;
  exhaustedUntil?: Date;
  retrySeconds: number;
  message: string;
} {
  if (err instanceof ProviderHttpError) {
    const msg = err.message.slice(0, 280);
    if (err.status === 401 || err.status === 402 || err.status === 403) {
      return {
        kind: 'INVALID',
        status: err.status,
        retrySeconds: 0,
        message: `HTTP ${err.status}: ${msg}`,
      };
    }
    if (err.status === 404) {
      return {
        kind: 'MODEL_UNAVAILABLE',
        status: 404,
        retrySeconds: 0,
        message: `HTTP 404: ${msg}`,
      };
    }
    if (err.status === 429 || err.status === 502 || err.status === 503 || err.status === 529) {
      if (err.status === 429 && isDailyExhaustionError(err)) {
        const exhaustedUntil = getResetWindowForProvider(provider);
        const retrySeconds = Math.max(60, Math.ceil((exhaustedUntil.getTime() - Date.now()) / 1000));
        return {
          kind: 'EXHAUSTED_TODAY',
          status: err.status,
          exhaustedUntil,
          retrySeconds,
          message: `Daily quota exhausted (${msg})`,
        };
      }
      const retrySeconds = err.retryAfterSeconds && err.retryAfterSeconds > 0 ? err.retryAfterSeconds : 65;
      return {
        kind: 'COOLDOWN',
        status: err.status,
        cooldownUntil: new Date(Date.now() + retrySeconds * 1000),
        retrySeconds,
        message: `HTTP ${err.status} cooldown (${retrySeconds}s): ${msg}`,
      };
    }
    return {
      kind: 'COOLDOWN',
      status: err.status,
      cooldownUntil: new Date(Date.now() + 45 * 1000),
      retrySeconds: 45,
      message: `HTTP ${err.status}: ${msg}`,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    kind: 'COOLDOWN',
    status: 503,
    cooldownUntil: new Date(Date.now() + 30 * 1000),
    retrySeconds: 30,
    message: msg.slice(0, 280),
  };
}

function isModelAvailable(
  modelHealth: ModelHealthMap,
  model: string,
  now: Date
): boolean {
  const entry = modelHealth[model];
  if (!entry) return true;
  if (entry.status === 'INVALID') return false;
  if (entry.status === 'EXHAUSTED_TODAY' && entry.exhaustedUntil) {
    return new Date(entry.exhaustedUntil).getTime() <= now.getTime();
  }
  if (entry.status === 'COOLDOWN' && entry.cooldownUntil) {
    return new Date(entry.cooldownUntil).getTime() <= now.getTime();
  }
  return entry.status === 'HEALTHY';
}

function isKeyReady(
  record: {
    enabled: boolean;
    status: string;
    cooldownUntil: Date | null;
    exhaustedUntil: Date | null;
  },
  now: Date
): boolean {
  if (!record.enabled) return false;
  if (record.status === 'INVALID') return false;
  if (record.status === 'EXHAUSTED_TODAY' && record.exhaustedUntil) {
    return record.exhaustedUntil.getTime() <= now.getTime();
  }
  if (record.status === 'COOLDOWN' && record.cooldownUntil) {
    return record.cooldownUntil.getTime() <= now.getTime();
  }
  return true;
}

async function defaultTransport(
  provider: ProviderType,
  _keyId: string,
  params: ProviderCallParams
): Promise<string> {
  switch (provider) {
    case 'GEMINI':
      return callGeminiGenerate(params);
    case 'GROQ':
      return callGroqGenerate(params);
    case 'OPENROUTER':
      return callOpenRouterGenerate(params);
    case 'CUSTOM':
      return callCustomOpenAIGenerate(params);
    default:
      throw new ProviderHttpError({ status: 400, message: `Unsupported generation provider: ${provider}` });
  }
}

export async function generateWithRouter(
  req: GenerateRequest,
  options?: { transport?: TransportHandler }
): Promise<GenerateResult> {
  const transport = options?.transport ?? defaultTransport;
  const config = await ensureRouterConfig();
  const taskRouting = safeParseJson<Record<TaskType, ProviderType[]>>(
    config.taskRoutingJson,
    DEFAULT_TASK_ROUTING
  );

  let providerOrder: ProviderType[] = [
    ...(taskRouting[req.taskType] ?? DEFAULT_TASK_ROUTING[req.taskType]),
  ];
  if (req.preferredProvider && req.preferredProvider !== 'YOUTUBE') {
    providerOrder = [
      req.preferredProvider,
      ...providerOrder.filter((p) => p !== req.preferredProvider),
    ];
  }

  const allKeys = await prisma.apiKeyRecord.findMany({
    where: {
      enabled: true,
      provider: { in: providerOrder },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });

  const now = new Date();
  const strategy = (config.rotationStrategy || 'PRIORITY_FAILOVER') as RotationStrategy;

  // Auto-heal expired cooldowns/exhaustions in memory + DB when checked
  const readyKeys = [];
  for (const key of allKeys) {
    if (!isKeyReady(key, now)) continue;
    if (
      (key.status === 'COOLDOWN' && key.cooldownUntil && key.cooldownUntil <= now) ||
      (key.status === 'EXHAUSTED_TODAY' && key.exhaustedUntil && key.exhaustedUntil <= now)
    ) {
      await prisma.apiKeyRecord.update({
        where: { id: key.id },
        data: { status: 'HEALTHY', cooldownUntil: null, exhaustedUntil: null },
      });
      key.status = 'HEALTHY';
      key.cooldownUntil = null;
      key.exhaustedUntil = null;
    }
    readyKeys.push(key);
  }

  // Order keys by provider preference order, then priority or round-robin cursor
  const orderedKeys: typeof readyKeys = [];
  for (const prov of providerOrder) {
    const provKeys = readyKeys.filter((k) => k.provider === prov);
    if (strategy === 'ROUND_ROBIN' && provKeys.length > 1) {
      const offset = config.roundRobinCursor % provKeys.length;
      orderedKeys.push(...provKeys.slice(offset), ...provKeys.slice(0, offset));
    } else {
      orderedKeys.push(...provKeys);
    }
  }

  if (strategy === 'ROUND_ROBIN' && orderedKeys.length > 0) {
    await prisma.routerConfig.update({
      where: { id: 'default' },
      data: { roundRobinCursor: { increment: 1 } },
    });
  }

  const attempts: string[] = [];
  let minRetryAfter = 65;
  let failovers = 0;
  let prevAttempt: { provider: ProviderType; model: string; reason: string; httpStatus?: number } | null =
    null;

  for (const record of orderedKeys) {
    const provider = record.provider as ProviderType;
    const caps = safeParseJson(record.capabilitiesJson, PROVIDER_CAPABILITY_DEFAULTS[provider]);
    if (req.images?.length && !caps.vision) {
      continue;
    }

    const modelHealth = safeParseJson<ModelHealthMap>(record.modelHealthJson, {});
    let chain = getModelChainForProvider(provider, record.defaultModel, req.taskType);
    if (req.preferredModel && record.provider === (req.preferredProvider ?? record.provider)) {
      chain = [req.preferredModel, ...chain.filter((m) => m !== req.preferredModel)];
    }

    const decryptedKey = decryptApiKey(record);
    let keyHardInvalid = false;
    let healthyModelsLeftForKey = 0;

    for (const model of chain) {
      if (!isModelAvailable(modelHealth, model, new Date())) {
        continue;
      }
      healthyModelsLeftForKey++;
    }
    if (healthyModelsLeftForKey === 0 && Object.keys(modelHealth).length > 0) {
      // All models on this key cooled down -> move to next key
      continue;
    }

    for (const model of chain) {
      if (!isModelAvailable(modelHealth, model, new Date())) {
        continue;
      }

      const start = Date.now();
      try {
        const text = await transport(provider, record.id, {
          apiKey: decryptedKey,
          model,
          prompt: req.prompt,
          systemPrompt: req.systemPrompt,
          jsonMode: req.jsonMode,
          temperature: req.temperature,
          maxOutputTokens: req.maxOutputTokens,
          images: req.images,
          baseUrl: record.baseUrl,
        });

        // If we failed over from a previous attempt, log the successful failover
        if (prevAttempt) {
          await prisma.failoverLog.create({
            data: {
              jobId: req.jobId ?? null,
              taskType: req.taskType,
              fromProvider: prevAttempt.provider,
              fromModel: prevAttempt.model,
              toProvider: provider,
              toModel: model,
              reason: prevAttempt.reason,
              httpStatus: prevAttempt.httpStatus ?? null,
            },
          });
        }

        const nextHealth: ModelHealthMap = {
          ...modelHealth,
          [model]: {
            status: 'HEALTHY',
            cooldownUntil: null,
            exhaustedUntil: null,
            lastError: null,
            requests: (modelHealth[model]?.requests ?? 0) + 1,
            failures: modelHealth[model]?.failures ?? 0,
          },
        };

        await prisma.apiKeyRecord.update({
          where: { id: record.id },
          data: {
            status: 'HEALTHY',
            cooldownUntil: null,
            exhaustedUntil: null,
            lastError: null,
            lastUsedAt: new Date(),
            totalRequests: { increment: 1 },
            modelHealthJson: JSON.stringify(nextHealth),
          },
        });

        return {
          text,
          provider,
          model,
          keyId: record.id,
          keyLabel: record.label,
          latencyMs: Date.now() - start,
          failovers,
        };
      } catch (err) {
        const classified = classifyProviderError(provider, err);
        attempts.push(`${record.label} (${provider}/${model}): ${classified.message}`);
        if (classified.retrySeconds > 0) {
          minRetryAfter = Math.min(minRetryAfter, classified.retrySeconds);
        }

        if (prevAttempt) {
          await prisma.failoverLog.create({
            data: {
              jobId: req.jobId ?? null,
              taskType: req.taskType,
              fromProvider: prevAttempt.provider,
              fromModel: prevAttempt.model,
              toProvider: provider,
              toModel: model,
              reason: prevAttempt.reason,
              httpStatus: prevAttempt.httpStatus ?? null,
            },
          });
        }

        failovers++;
        prevAttempt = {
          provider,
          model,
          reason: classified.message,
          httpStatus: classified.status,
        };

        if (classified.kind === 'INVALID') {
          keyHardInvalid = true;
          await prisma.apiKeyRecord.update({
            where: { id: record.id },
            data: {
              status: 'INVALID',
              lastError: classified.message,
              lastUsedAt: new Date(),
              totalRequests: { increment: 1 },
              totalFailures: { increment: 1 },
            },
          });
          break;
        }

        const modelStatus: KeyStatus =
          classified.kind === 'EXHAUSTED_TODAY'
            ? 'EXHAUSTED_TODAY'
            : classified.kind === 'MODEL_UNAVAILABLE'
            ? 'INVALID'
            : 'COOLDOWN';

        modelHealth[model] = {
          status: modelStatus,
          cooldownUntil: classified.cooldownUntil?.toISOString() ?? null,
          exhaustedUntil: classified.exhaustedUntil?.toISOString() ?? null,
          lastError: classified.message,
          requests: (modelHealth[model]?.requests ?? 0) + 1,
          failures: (modelHealth[model]?.failures ?? 0) + 1,
        };

        // Check if ALL models in chain for this key are now non-healthy
        const stillHasHealthyModel = chain.some((m) => isModelAvailable(modelHealth, m, new Date()));
        const nextKeyStatus: KeyStatus = stillHasHealthyModel
          ? 'HEALTHY'
          : classified.kind === 'EXHAUSTED_TODAY'
          ? 'EXHAUSTED_TODAY'
          : 'COOLDOWN';

        await prisma.apiKeyRecord.update({
          where: { id: record.id },
          data: {
            status: nextKeyStatus,
            cooldownUntil: stillHasHealthyModel ? null : classified.cooldownUntil ?? null,
            exhaustedUntil: stillHasHealthyModel ? null : classified.exhaustedUntil ?? null,
            lastError: classified.message,
            lastUsedAt: new Date(),
            totalRequests: { increment: 1 },
            totalFailures: { increment: 1 },
            modelHealthJson: JSON.stringify(modelHealth),
          },
        });
      }
    }

    if (keyHardInvalid) continue;
  }

  if (prevAttempt) {
    await prisma.failoverLog.create({
      data: {
        jobId: req.jobId ?? null,
        taskType: req.taskType,
        fromProvider: prevAttempt.provider,
        fromModel: prevAttempt.model,
        toProvider: null,
        toModel: null,
        reason: prevAttempt.reason,
        httpStatus: prevAttempt.httpStatus ?? null,
      },
    });
  }

  const zeroKeyPrompt = buildZeroKeyMetaPrompt(
    `Task (${req.taskType})`,
    req.systemPrompt ? `${req.systemPrompt}\n\n${req.prompt}` : req.prompt
  );

  throw new AllKeysExhaustedError(
    orderedKeys.length === 0
      ? 'No healthy AI API keys available in the Vault. Use Zero-Key Mode or add a key in Admin Vault.'
      : `All configured AI keys/models are in cooldown or exhausted. Last attempts: ${attempts.slice(-2).join(' | ')}`,
    minRetryAfter,
    attempts,
    zeroKeyPrompt
  );
}

export async function testStoredKey(keyId: string): Promise<ProviderTestResult> {
  const record = await prisma.apiKeyRecord.findUnique({ where: { id: keyId } });
  if (!record) {
    throw new Error('API key record not found');
  }

  const rawKey = decryptApiKey(record);
  const provider = record.provider as ProviderType;
  let result: ProviderTestResult;

  if (provider === 'GEMINI') {
    result = await testAndListGeminiModels(rawKey, record.defaultModel);
  } else if (provider === 'GROQ') {
    result = await testAndListGroqModels(rawKey, record.defaultModel);
  } else if (provider === 'OPENROUTER') {
    result = await testAndListOpenRouterModels(rawKey, record.defaultModel);
  } else if (provider === 'CUSTOM') {
    result = await testAndListCustomModels(rawKey, record.baseUrl, record.defaultModel);
  } else if (provider === 'YOUTUBE') {
    const start = Date.now();
    try {
      const resp = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&maxResults=1&key=${encodeURIComponent(rawKey)}`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (resp.ok) {
        result = {
          ok: true,
          provider: 'YOUTUBE',
          testedModel: 'youtube-data-v3',
          models: ['youtube-data-v3'],
          message: 'YouTube Data API v3 key verified (200 OK)',
          latencyMs: Date.now() - start,
        };
      } else {
        const body = await resp.text();
        result = {
          ok: false,
          provider: 'YOUTUBE',
          testedModel: 'youtube-data-v3',
          models: ['youtube-data-v3'],
          message: `YouTube API HTTP ${resp.status}: ${body.slice(0, 200)}`,
          latencyMs: Date.now() - start,
        };
      }
    } catch (err) {
      result = {
        ok: false,
        provider: 'YOUTUBE',
        testedModel: 'youtube-data-v3',
        models: ['youtube-data-v3'],
        message: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - start,
      };
    }
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  await prisma.apiKeyRecord.update({
    where: { id: record.id },
    data: {
      status: result.ok ? 'HEALTHY' : result.message.includes('401') || result.message.includes('403') ? 'INVALID' : record.status,
      cooldownUntil: result.ok ? null : record.cooldownUntil,
      exhaustedUntil: result.ok ? null : record.exhaustedUntil,
      lastError: result.ok ? null : result.message.slice(0, 300),
      defaultModel: result.ok && result.testedModel ? result.testedModel : record.defaultModel,
      lastUsedAt: new Date(),
    },
  });

  return result;
}
