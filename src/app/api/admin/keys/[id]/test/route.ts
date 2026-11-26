import { NextRequest, NextResponse } from 'next/server';
import { testStoredKey } from '@/lib/ai-router/router';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await testStoredKey(id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Key test failed' },
      { status: 400 }
    );
  }
}
