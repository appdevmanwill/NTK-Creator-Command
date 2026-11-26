import { prisma } from '../src/lib/db';
import { importKeysFromFilesFolder } from '../src/lib/ai-router/import-files';

async function main() {
  const summary = await importKeysFromFilesFolder();
  console.log(
    JSON.stringify(
      {
        scannedFiles: summary.scannedFiles,
        imported: summary.imported,
        skippedExisting: summary.skippedExisting,
        entries: summary.entries,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error('Key import error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
