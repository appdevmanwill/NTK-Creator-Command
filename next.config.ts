import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['playwright', 'playwright-core', 'pdfkit', 'exceljs', '@prisma/client'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
