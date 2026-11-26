import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/utils';

export interface PackTextFile {
  path: string;
  content: string;
}

export interface PackBinaryFile {
  path: string;
  buffer: Buffer;
}

export function getStorageRoot(): string {
  const root = path.resolve(process.cwd(), 'storage');
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function assertInsideStorage(targetPath: string): string {
  const storageRoot = getStorageRoot();
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(storageRoot + path.sep) && resolved !== storageRoot) {
    throw new Error('Access denied: path outside storage directory');
  }
  return resolved;
}

export async function compileAndSaveZipPack(params: {
  type: string;
  title: string;
  seriesGroupId?: string | null;
  metadata?: Record<string, unknown>;
  textFiles: PackTextFile[];
  binaryFiles?: PackBinaryFile[];
  zipFileName?: string;
}) {
  const storageRoot = getStorageRoot();
  const packsDir = path.join(storageRoot, 'packs');
  fs.mkdirSync(packsDir, { recursive: true });

  const slug = slugify(params.title, 'pack');
  const stamp = Date.now().toString(36);
  const folderName = `${slug}-${stamp}`;
  const folderPath = path.join(packsDir, folderName);
  fs.mkdirSync(folderPath, { recursive: true });

  const zip = new JSZip();
  const storedFilePaths: Array<{ path: string; bytes: number }> = [];

  for (const file of params.textFiles) {
    const cleanRel = file.path.replace(/^\/+/, '').replace(/\.\./g, '');
    const full = path.join(folderPath, cleanRel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, file.content, 'utf8');
    zip.file(cleanRel, file.content);
    storedFilePaths.push({ path: cleanRel, bytes: Buffer.byteLength(file.content, 'utf8') });
  }

  for (const bin of params.binaryFiles ?? []) {
    const cleanRel = bin.path.replace(/^\/+/, '').replace(/\.\./g, '');
    const full = path.join(folderPath, cleanRel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, bin.buffer);
    zip.file(cleanRel, bin.buffer);
    storedFilePaths.push({ path: cleanRel, bytes: bin.buffer.byteLength });
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const zipName = params.zipFileName || `ntk-command-${slug}-${stamp}.zip`;
  const zipPath = path.join(packsDir, zipName);
  fs.writeFileSync(zipPath, zipBuffer);

  const project = await prisma.project.create({
    data: {
      type: params.type,
      title: params.title,
      seriesGroupId: params.seriesGroupId ?? null,
      metadataJson: JSON.stringify({
        ...(params.metadata ?? {}),
        folderPath,
        zipName,
        filesPreview: params.textFiles.slice(0, 24),
      }),
      filesJson: JSON.stringify(storedFilePaths),
      outputFilePath: zipPath,
    },
  });

  return {
    project,
    zipPath,
    zipName,
    zipBytes: zipBuffer.byteLength,
  };
}

export async function saveSingleProductArtifact(params: {
  type: 'EBOOK' | 'SPREADSHEET' | 'PLANNER' | 'JOURNAL';
  title: string;
  fileName: string;
  buffer: Buffer;
  metadata?: Record<string, unknown>;
}) {
  const storageRoot = getStorageRoot();
  const productsDir = path.join(storageRoot, 'products');
  fs.mkdirSync(productsDir, { recursive: true });

  const stamp = Date.now().toString(36);
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  const fullName = `${stamp}-${safeName}`;
  const fullPath = path.join(productsDir, fullName);
  fs.writeFileSync(fullPath, params.buffer);

  const project = await prisma.project.create({
    data: {
      type: params.type,
      title: params.title,
      metadataJson: JSON.stringify({
        ...(params.metadata ?? {}),
        downloadFileName: safeName,
      }),
      filesJson: JSON.stringify([{ path: safeName, bytes: params.buffer.byteLength }]),
      outputFilePath: fullPath,
    },
  });

  return { project, fullPath, fileName: safeName, bytes: params.buffer.byteLength };
}
