// Disable native binary addons for ws to prevent "bufferUtil.mask is not a function" in Next.js / Webpack
if (typeof process !== 'undefined' && process?.env) {
  process.env['WS_NO_BUFFER_UTIL'] = '1';
  process.env['WS_NO_UTF_8_VALIDATE'] = '1';
}

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Ensure WebSocket constructor is set in Node.js environment
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  __adapterId?: string;
};

const CURRENT_ADAPTER_ID = 'neon-wss-v6';

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  let client: PrismaClient;
  // When connecting to Neon, use the WebSocket adapter (port 443) to avoid TCP port 5432 timeouts
  if (connectionString && connectionString.includes('neon.tech')) {
    const adapter = new PrismaNeon({ connectionString });
    client = new PrismaClient({
      adapter,
      log: ['warn', 'error'],
    });
  } else {
    client = new PrismaClient({
      log: ['warn', 'error'],
    });
  }

  // Pre-warm the database connection non-blockingly so the first user query doesn't pay cold-start latency (only in runtime, not during static build)
  if (process.env.NEXT_PHASE !== 'phase-production-build' && process.env.npm_lifecycle_event !== 'build') {
    client.$queryRawUnsafe('SELECT 1').catch(() => {});
  }

  return client;
}

// Invalidate and replace any stale cached instance from globalThis in development
if (!globalForPrisma.prisma || globalForPrisma.__adapterId !== CURRENT_ADAPTER_ID) {
  if (globalForPrisma.prisma) {
    try {
      globalForPrisma.prisma.$disconnect().catch(() => {});
    } catch (_) {}
  }
  globalForPrisma.prisma = createPrismaClient();
  globalForPrisma.__adapterId = CURRENT_ADAPTER_ID;
}

export const prisma = globalForPrisma.prisma;
export default prisma;
