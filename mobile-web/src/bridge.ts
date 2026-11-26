export interface NativeBridgeResponse {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}

export interface AndroidBridgeInterface {
  httpRequest?: (
    callbackId: string,
    url: string,
    method: string,
    headersJson: string,
    body: string
  ) => void;
  saveFile?: (fileName: string, mimeType: string, base64Data: string) => string;
  shareFile?: (fileName: string, mimeType: string, base64Data: string) => string;
  openExternalUrl?: (url: string) => void;
  setSystemBars?: (resolvedTheme: 'light' | 'dark') => void;
  secureSave?: (key: string, value: string) => void;
  secureLoad?: (key: string) => string;
  secureDelete?: (key: string) => void;
  getDeviceInfo?: () => string;
}

declare global {
  interface Window {
    NTKAndroidBridge?: AndroidBridgeInterface;
    __ntkBridgeResolve?: (callbackId: string, payloadJson: string) => void;
    __ntkOnHardwareBack?: () => boolean;
  }
}

const pendingHttp = new Map<string, (resp: NativeBridgeResponse) => void>();

if (typeof window !== 'undefined') {
  window.__ntkBridgeResolve = (callbackId: string, payloadJson: string) => {
    const resolver = pendingHttp.get(callbackId);
    if (!resolver) return;
    pendingHttp.delete(callbackId);
    try {
      const parsed = JSON.parse(payloadJson) as NativeBridgeResponse;
      resolver(parsed);
    } catch {
      resolver({ ok: false, status: 500, body: '', error: 'Invalid bridge response' });
    }
  };
}

export function makeId(prefix = 'ntk'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isAndroidNative(): boolean {
  return typeof window !== 'undefined' && Boolean(window.NTKAndroidBridge);
}

export async function nativeHttpRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number } = {}
): Promise<NativeBridgeResponse> {
  const method = options.method || 'GET';
  const headers = options.headers || {};
  const body = options.body || '';
  const bridge = typeof window !== 'undefined' ? window.NTKAndroidBridge : undefined;

  if (bridge && typeof bridge.httpRequest === 'function') {
    return new Promise((resolve) => {
      const id = makeId('http');
      const timer = window.setTimeout(() => {
        if (pendingHttp.has(id)) {
          pendingHttp.delete(id);
          resolve({ ok: false, status: 504, body: '', error: 'Request timed out' });
        }
      }, options.timeoutMs || 25000);

      pendingHttp.set(id, (resp) => {
        window.clearTimeout(timer);
        resolve(resp);
      });

      try {
        bridge.httpRequest!(id, url, method, JSON.stringify(headers), body);
      } catch (err) {
        window.clearTimeout(timer);
        pendingHttp.delete(id);
        resolve({
          ok: false,
          status: 500,
          body: '',
          error: err instanceof Error ? err.message : 'Native HTTP bridge failed',
        });
      }
    });
  }

  // Browser / Playwright fallback
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? window.setTimeout(() => controller.abort(), options.timeoutMs || 20000)
    : null;
  try {
    const resp = await fetch(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
      signal: controller ? controller.signal : undefined,
    });
    const text = await resp.text();
    return { ok: resp.ok, status: resp.status, body: text };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      body: '',
      error: err instanceof Error ? err.message : 'Network error',
    };
  } finally {
    if (timer !== null) window.clearTimeout(timer);
  }
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode.apply(null, Array.prototype.slice.call(sub));
  }
  return btoa(binary);
}

export function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function exportFileToDevice(
  fileName: string,
  mimeType: string,
  bytes: Uint8Array,
  action: 'save' | 'share'
): { ok: boolean; message: string } {
  const b64 = uint8ToBase64(bytes);
  const bridge = typeof window !== 'undefined' ? window.NTKAndroidBridge : undefined;

  if (bridge) {
    if (action === 'share' && typeof bridge.shareFile === 'function') {
      const msg = bridge.shareFile(fileName, mimeType, b64);
      return { ok: true, message: msg || `Ready to share ${fileName}` };
    }
    if (typeof bridge.saveFile === 'function') {
      const msg = bridge.saveFile(fileName, mimeType, b64);
      return { ok: true, message: msg || `Saved ${fileName} to Downloads` };
    }
  }

  // Standard browser download fallback
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { ok: true, message: `Downloaded ${fileName}` };
}

export function openExternalLink(url: string): void {
  const bridge = typeof window !== 'undefined' ? window.NTKAndroidBridge : undefined;
  if (bridge && typeof bridge.openExternalUrl === 'function') {
    bridge.openExternalUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function syncSystemBars(resolvedTheme: 'light' | 'dark'): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolvedTheme === 'dark' ? '#09090b' : '#f6f3ec');
  }
  const bridge = typeof window !== 'undefined' ? window.NTKAndroidBridge : undefined;
  if (bridge && typeof bridge.setSystemBars === 'function') {
    bridge.setSystemBars(resolvedTheme);
  }
}

export function secureRead(key: string): string {
  const bridge = typeof window !== 'undefined' ? window.NTKAndroidBridge : undefined;
  if (bridge && typeof bridge.secureLoad === 'function') {
    try {
      return bridge.secureLoad(key) || '';
    } catch {
      // fallback
    }
  }
  return localStorage.getItem(`ntk_sec_${key}`) || '';
}

export function secureWrite(key: string, value: string): void {
  const bridge = typeof window !== 'undefined' ? window.NTKAndroidBridge : undefined;
  if (bridge && typeof bridge.secureSave === 'function') {
    try {
      bridge.secureSave(key, value);
      return;
    } catch {
      // fallback
    }
  }
  localStorage.setItem(`ntk_sec_${key}`, value);
}

export function getDeviceInfo(): { apiLevel?: number; androidRelease?: string; appVersion?: string } {
  const bridge = typeof window !== 'undefined' ? window.NTKAndroidBridge : undefined;
  if (bridge && typeof bridge.getDeviceInfo === 'function') {
    try {
      return JSON.parse(bridge.getDeviceInfo()) as {
        apiLevel?: number;
        androidRelease?: string;
        appVersion?: string;
      };
    } catch {
      return {};
    }
  }
  return {};
}
