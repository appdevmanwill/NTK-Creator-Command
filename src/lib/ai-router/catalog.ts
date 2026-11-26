import type { ProviderType, TaskType } from './types';

export const PROVIDER_MODEL_CHAINS: Record<ProviderType, string[]> = {
  GEMINI: [
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-4-hydrogen',
    'gemini-3.5-flash',
  ],
  GROQ: [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
  ],
  OPENROUTER: [
    'openrouter/free',
    'nvidia/nemotron-3.5-super-vl:free',
    'nvidia/nemotron-3.5-lightning:free',
    'google/gemma-4-26b-a4b:free',
  ],
  CUSTOM: ['gpt-4o-mini'],
  YOUTUBE: ['youtube-data-v3'],
};

export const GROQ_AUDIO_MODEL = 'whisper-large-v3';

export const DEFAULT_TASK_ROUTING: Record<TaskType, ProviderType[]> = {
  vision: ['GEMINI', 'OPENROUTER', 'CUSTOM'],
  long_context: ['GEMINI', 'OPENROUTER', 'GROQ', 'CUSTOM'],
  fast_generation: ['GROQ', 'GEMINI', 'OPENROUTER', 'CUSTOM'],
};

export const PROVIDER_CAPABILITY_DEFAULTS: Record<
  ProviderType,
  { text: boolean; vision: boolean; long_context: boolean; json: boolean; audio: boolean }
> = {
  GEMINI: { text: true, vision: true, long_context: true, json: true, audio: true },
  GROQ: { text: true, vision: false, long_context: false, json: true, audio: true },
  OPENROUTER: { text: true, vision: true, long_context: true, json: true, audio: false },
  CUSTOM: { text: true, vision: false, long_context: true, json: true, audio: false },
  YOUTUBE: { text: false, vision: false, long_context: false, json: false, audio: false },
};

export function getModelChainForProvider(
  provider: ProviderType,
  defaultModel?: string | null,
  taskType?: TaskType
): string[] {
  const base = [...(PROVIDER_MODEL_CHAINS[provider] ?? [])];
  if (provider === 'OPENROUTER' && taskType === 'vision') {
    const visionFirst = ['nvidia/nemotron-3.5-super-vl:free', 'openrouter/free'];
    for (const m of base) {
      if (!visionFirst.includes(m)) visionFirst.push(m);
    }
    return defaultModel && !visionFirst.includes(defaultModel)
      ? [defaultModel, ...visionFirst]
      : visionFirst;
  }
  if (defaultModel && defaultModel.trim()) {
    const clean = defaultModel.trim();
    return [clean, ...base.filter((m) => m !== clean)];
  }
  return base;
}

export function getResetWindowForProvider(provider: ProviderType): Date {
  const now = new Date();
  if (provider === 'GEMINI') {
    // Next midnight Pacific Time (UTC-8 standard / UTC-7 DST; use conservative UTC+8h offset for midnight PT)
    const ptNow = new Date(now.getTime() - 8 * 3600 * 1000);
    const ptMidnightNext = Date.UTC(
      ptNow.getUTCFullYear(),
      ptNow.getUTCMonth(),
      ptNow.getUTCDate() + 1,
      8,
      5,
      0
    );
    return new Date(ptMidnightNext);
  }
  // 00:00 UTC next day for Groq / OpenRouter / Custom
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 2, 0));
}
