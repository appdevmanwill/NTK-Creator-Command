import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/db';

async function main() {
  await prisma.chatMessage.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.failoverLog.deleteMany();
  await prisma.generationJob.deleteMany();
  await prisma.project.deleteMany();
  await prisma.savedFlowStyle.deleteMany();

  await prisma.apiKeyRecord.updateMany({
    data: {
      enabled: true,
      status: 'HEALTHY',
      cooldownUntil: null,
      exhaustedUntil: null,
      modelHealthJson: '{}',
      lastError: null,
      totalRequests: 0,
      totalFailures: 0,
      lastUsedAt: null,
    },
  });

  // Empty ./storage/packs and ./storage/products while recreating empty dirs
  for (const sub of ['packs', 'products']) {
    const dir = path.join(process.cwd(), 'storage', sub);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
  }

  const [projects, jobs, threads, failoverLogs, keys, channels] = await Promise.all([
    prisma.project.count(),
    prisma.generationJob.count(),
    prisma.chatThread.count(),
    prisma.failoverLog.count(),
    prisma.apiKeyRecord.count(),
    prisma.trackedChannel.count(),
  ]);

  assert.strictEqual(projects, 0, 'Expected projects === 0');
  assert.strictEqual(jobs, 0, 'Expected jobs === 0');
  assert.strictEqual(threads, 0, 'Expected threads === 0');
  assert.strictEqual(failoverLogs, 0, 'Expected failoverLogs === 0');
  assert.strictEqual(keys, 4, 'Expected 4 preserved keys');
  assert.strictEqual(channels, 30, 'Expected 30 preserved seeded channels');

  console.log(
    JSON.stringify({ ok: true, projects, jobs, threads, failoverLogs, keys, channels }, null, 2)
  );
}

main()
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
