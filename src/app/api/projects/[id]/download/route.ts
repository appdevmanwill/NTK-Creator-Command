import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { assertInsideStorage } from '@/lib/packs/zip-compiler';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || !project.outputFilePath) {
    return NextResponse.json({ error: 'Artifact file not found' }, { status: 404 });
  }

  let safePath: string;
  try {
    safePath = assertInsideStorage(project.outputFilePath);
  } catch {
    return NextResponse.json({ error: 'Invalid artifact path' }, { status: 403 });
  }

  if (!fs.existsSync(safePath)) {
    return NextResponse.json({ error: 'Artifact missing on disk' }, { status: 404 });
  }

  const buffer = fs.readFileSync(safePath);
  const ext = path.extname(safePath).toLowerCase();
  const mime =
    ext === '.zip'
      ? 'application/zip'
      : ext === '.pdf'
      ? 'application/pdf'
      : ext === '.xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/octet-stream';

  let downloadName = path.basename(safePath);
  try {
    const meta = JSON.parse(project.metadataJson || '{}') as { downloadFileName?: string; zipName?: string };
    if (meta.downloadFileName) downloadName = meta.downloadFileName;
    else if (meta.zipName) downloadName = meta.zipName;
  } catch {
    // keep basename
  }

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'Content-Length': String(buffer.byteLength),
    },
  });
}
