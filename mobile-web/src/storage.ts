import { base64ToUint8, makeId, secureRead, secureWrite, uint8ToBase64 } from './bridge';
import { ChannelItem, STARTER_CHANNELS } from './channels-data';

export interface SavedEdition {
  id: string;
  type: 'EBOOK' | 'SPREADSHEET' | 'PLANNER' | 'JOURNAL' | 'FLOW_MOVIE' | 'FLOW_BULK' | 'BRAND_PACK' | 'NOTEBOOK_PACK' | 'PUBLISH_PACK';
  title: string;
  fileName: string;
  mimeType: string;
  bytes: number;
  summary: string;
  providerSummary: string;
  createdAt: string;
  base64Data: string;
}

export interface MobileApiKey {
  id: string;
  label: string;
  provider: 'GEMINI' | 'GROQ' | 'OPENROUTER' | 'CUSTOM' | 'YOUTUBE';
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
  priority: number;
  status: 'HEALTHY' | 'COOLDOWN' | 'EXHAUSTED_TODAY' | 'INVALID';
  cooldownUntil?: number | null;
  lastError?: string | null;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  createdAt: string;
}

const DB_NAME = 'ntk_creator_command_mobile';
const DB_VERSION = 1;
const STORE_EDITIONS = 'editions';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_EDITIONS)) {
        db.createObjectStore(STORE_EDITIONS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB failed'));
  });
}

export async function listEditions(): Promise<SavedEdition[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_EDITIONS, 'readonly');
      const store = tx.objectStore(STORE_EDITIONS);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result as SavedEdition[]) || [];
        rows.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    const raw = localStorage.getItem('ntk_editions_fallback');
    if (!raw) return [];
    try {
      return JSON.parse(raw) as SavedEdition[];
    } catch {
      return [];
    }
  }
}

export async function saveEdition(input: {
  type: SavedEdition['type'];
  title: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  summary: string;
  providerSummary: string;
}): Promise<SavedEdition> {
  const item: SavedEdition = {
    id: makeId('ed'),
    type: input.type,
    title: input.title,
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: input.bytes.byteLength,
    summary: input.summary,
    providerSummary: input.providerSummary,
    createdAt: new Date().toISOString(),
    base64Data: uint8ToBase64(input.bytes),
  };

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_EDITIONS, 'readwrite');
      const store = tx.objectStore(STORE_EDITIONS);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const current = await listEditions();
    localStorage.setItem('ntk_editions_fallback', JSON.stringify([item, ...current].slice(0, 15)));
  }
  return item;
}

export async function deleteEdition(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_EDITIONS, 'readwrite');
      const req = tx.objectStore(STORE_EDITIONS).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const current = await listEditions();
    localStorage.setItem(
      'ntk_editions_fallback',
      JSON.stringify(current.filter((e) => e.id !== id))
    );
  }
}

export function editionToUint8(ed: SavedEdition): Uint8Array {
  return base64ToUint8(ed.base64Data);
}

const KEYS_STORAGE_NAME = 'api_keys_v1';

export function loadMobileKeys(): MobileApiKey[] {
  const raw = secureRead(KEYS_STORAGE_NAME);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MobileApiKey[];
  } catch {
    return [];
  }
}

export function saveMobileKeys(keys: MobileApiKey[]): void {
  secureWrite(KEYS_STORAGE_NAME, JSON.stringify(keys));
}

export function loadChannels(): ChannelItem[] {
  const raw = localStorage.getItem('ntk_custom_channels_v1');
  if (!raw) return STARTER_CHANNELS;
  try {
    const custom = JSON.parse(raw) as ChannelItem[];
    return [...custom, ...STARTER_CHANNELS];
  } catch {
    return STARTER_CHANNELS;
  }
}

export function addCustomChannel(ch: ChannelItem): ChannelItem[] {
  const raw = localStorage.getItem('ntk_custom_channels_v1');
  let custom: ChannelItem[] = [];
  if (raw) {
    try {
      custom = JSON.parse(raw) as ChannelItem[];
    } catch {
      custom = [];
    }
  }
  const next = [ch, ...custom];
  localStorage.setItem('ntk_custom_channels_v1', JSON.stringify(next));
  return [...next, ...STARTER_CHANNELS];
}

export function loadCoachMessages(): CoachMessage[] {
  const raw = localStorage.getItem('ntk_coach_messages_v1');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CoachMessage[];
  } catch {
    return [];
  }
}

export function saveCoachMessages(msgs: CoachMessage[]): void {
  localStorage.setItem('ntk_coach_messages_v1', JSON.stringify(msgs.slice(-40)));
}

export function loadDesktopServerUrl(): string {
  return localStorage.getItem('ntk_desktop_url') || '';
}

export function saveDesktopServerUrl(url: string): void {
  localStorage.setItem('ntk_desktop_url', url.trim());
}
