import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const VAULT_KEY_FILENAME = '.ntk-vault-key';

function getVaultKeyPath(): string {
  return path.join(process.cwd(), VAULT_KEY_FILENAME);
}

export function ensureVaultKey(): Buffer {
  const keyPath = getVaultKeyPath();
  if (fs.existsSync(keyPath)) {
    const raw = fs.readFileSync(keyPath, 'utf8').trim();
    const buf = Buffer.from(raw, 'hex');
    if (buf.length === 32) {
      return buf;
    }
  }
  const secret = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, secret.toString('hex') + '\n', { mode: 0o600 });
  return secret;
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim(), 'utf8').digest('hex');
}

export function maskApiKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.length <= 10) {
    return trimmed.slice(0, 2) + '***' + trimmed.slice(-2);
  }
  const prefixLen = Math.min(6, Math.floor(trimmed.length / 4));
  const suffixLen = 4;
  return `${trimmed.slice(0, prefixLen)}...${trimmed.slice(-suffixLen)}`;
}

export function encryptApiKey(rawKey: string): {
  encryptedKey: string;
  iv: string;
  authTag: string;
  keyHash: string;
  maskedKey: string;
} {
  const trimmed = rawKey.trim();
  if (!trimmed) {
    throw new Error('Cannot encrypt an empty API key');
  }
  const masterKey = ensureVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyHash: hashApiKey(trimmed),
    maskedKey: maskApiKey(trimmed),
  };
}

export function decryptApiKey(record: {
  encryptedKey: string;
  iv: string;
  authTag: string;
}): string {
  const masterKey = ensureVaultKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    masterKey,
    Buffer.from(record.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(record.encryptedKey, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
