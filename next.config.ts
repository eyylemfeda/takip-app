import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // Vercel build sırasında ESLint hatalarına takılma
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
