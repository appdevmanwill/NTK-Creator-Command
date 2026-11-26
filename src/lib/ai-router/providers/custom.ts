import { ProviderCallParams, ProviderHttpError, ProviderTestResult } from '../types';

function normalizeBaseUrl(baseUrl?: string | null): string {
  const clean = (baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  return clean;
}

export async function callCustomOpenAIGenerate(params: ProviderCallParams): Promise<string> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  const model = params.model || 'gpt-4o-mini';

  const messages: Array<Record<string, unknown>> = [];
  if (params.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: params.systemPrompt.trim() });
  }
  if (params.images?.length) {
    const parts: Array<Record<string, unknown>> = [{ type: 'text', text: params.prompt }];
    for (const img of params.images) {
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` },
      });
    }
    messages.push({ role: 'user', content: parts });
  } else {
    messages.push({ role: 'user', content: params.prompt });
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: params.temperature ?? 0.6,
    max_tokens: params.maxOutputTokens ?? 4096,
  };
  if (params.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(params.timeoutMs ?? 28000),
    });
  } catch (err) {
    throw new ProviderHttpError({
      status: 503,
      message: `Custom provider network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      retryAfterSeconds: 20,
    });
  }

  const rawBody = await resp.text();
  if (!resp.ok) {
    let msg = `Custom HTTP ${resp.status}`;
    try {
      const parsed = JSON.parse(rawBody) as { error?: { message?: string } };
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      if (rawBody) msg = rawBody.slice(0, 300);
    }
    const retryAfter = resp.headers.get('retry-after');
    throw new ProviderHttpError({
      status: resp.status,
      message: msg,
      retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
      rawBody: rawBody.slice(0, 600),
    });
  }

  const parsed = JSON.parse(rawBody) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = parsed.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    throw new ProviderHttpError({
      status: 502,
      message: `Custom endpoint (${model}) returned empty content`,
      retryAfterSeconds: 15,
    });
  }
  return content;
}

export async function testAndListCustomModels(
  apiKey: string,
  baseUrl?: string | null,
  preferredModel?: string | null
): Promise<ProviderTestResult> {
  const start = Date.now();
  const base = normalizeBaseUrl(baseUrl);
  let models: string[] = [];
  try {
    const resp = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { data?: Array<{ id?: string }> };
      models = (data.data ?? []).map((m) => m.id ?? '').filter(Boolean);
    }
  } catch {
    // ignore
  }

  const candidate = preferredModel?.trim() || models[0] || 'gpt-4o-mini';
  try {
    const reply = await callCustomOpenAIGenerate({
      apiKey,
      baseUrl: base,
      model: candidate,
      prompt: 'Reply OK',
      maxOutputTokens: 32,
      temperature: 0,
      timeoutMs: 15000,
    });
    return {
      ok: true,
      provider: 'CUSTOM',
      testedModel: candidate,
      models,
      message: `Connected via ${candidate} ("${reply.slice(0, 32)}")`,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'CUSTOM',
      testedModel: candidate,
      models,
      message: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}
