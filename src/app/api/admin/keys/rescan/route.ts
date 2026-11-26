import { NextResponse } from 'next/server';
import { importKeysFromFilesFolder } from '@/lib/ai-router/import-files';

export async function POST() {
  try {
    const summary = await importKeysFromFilesFolder();
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to re-scan FILES folder' },
      { status: 500 }
    );
  }
}
