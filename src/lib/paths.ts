import fs from 'fs';
import path from 'path';

export function getDataDir(): string {
  const dir = process.env.NTK_DATA_DIR
    ? path.resolve(process.env.NTK_DATA_DIR)
    : process.cwd();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getStorageDir(): string {
  const dir = path.join(getDataDir(), 'storage');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getVaultKeyPath(): string {
  return path.join(getDataDir(), '.ntk-vault-key');
}

export function resolveFilesDir(): string | null {
  const dataDir = getDataDir();
  const cwd = process.cwd();
  const candidates = [
    path.join(dataDir, 'FILES'),
    path.join(dataDir, 'files'),
    path.join(cwd, 'FILES'),
    path.join(cwd, 'files'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return dir;
    }
  }
  return null;
}
