import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (project.outputFilePath && fs.existsSync(project.outputFilePath)) {
    try {
      fs.unlinkSync(project.outputFilePath);
    } catch {
      // ignore file cleanup failure
    }
  }
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
