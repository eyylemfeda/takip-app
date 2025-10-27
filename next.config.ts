import type { NextConfig } from 'next'

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' https: blob:;
      connect-src 'self' https: wss: blob: data:;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob: https:;
    `.replace(/\s{2,}/g, ' ').trim(),
  },
]

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
