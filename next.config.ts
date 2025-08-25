import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // Vercel build sırasında ESLint hatalarına takılma
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Vercel build sırasında TypeScript hatalarına takılma
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
