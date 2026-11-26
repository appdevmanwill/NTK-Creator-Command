import { prisma } from '../src/lib/db';

async function main() {
  await prisma.apiKeyRecord.updateMany({
    data: {
      enabled: true,
      status: 'HEALTHY',
      cooldownUntil: null,
      exhaustedUntil: null,
      modelHealthJson: '{}',
      lastError: null,
    },
  });
  await prisma.failoverLog.deleteMany({
    where: { reason: { contains: 'Unexpected other key' } },
  });
  const keys = await prisma.apiKeyRecord.findMany({
    select: { label: true, provider: true, maskedKey: true, status: true },
  });
  console.log('Keys:', JSON.stringify(keys));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
