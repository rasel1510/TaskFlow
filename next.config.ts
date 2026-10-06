import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-neon',
    '@neondatabase/serverless',
    'ws',
  ],
  webpack: (config, { dev }) => {
    if (dev) {
      // Use in-memory cache in development to eliminate Windows filesystem locking & PackFileCacheStrategy ENOENT rename collisions
      config.cache = {
        type: 'memory',
      };
    }
    return config;
  },
};

export default nextConfig;
