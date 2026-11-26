import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright', 'playwright-core', 'pdfkit', 'exceljs', '@prisma/client'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
