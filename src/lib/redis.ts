/**
 * src/lib/redis.ts
 *
 * Enterprise-Grade Multi-Tier Caching Layer (L1 Memory + L2 Redis).
 *
 * Designed for High-Throughput & Sub-Millisecond Perceived Latency:
 *  - L1: High-Speed In-Memory Cache with TTL & bounded LRU-style eviction (microseconds)
 *  - L2: Distributed Redis Cache via ioredis (if REDIS_URL is configured)
 *  - Single-Flight Request Coalescing (Cache Stampede Protection)
 *  - Pattern-based cache invalidation (e.g. `delPattern('tasks:*')`)
 *  - Zero-Downtime Graceful Degradation: If Redis is unavailable or unconfigured,
 *    seamlessly falls back to L1 in-memory caching without throwing or stalling.
 */

import Redis from 'ioredis';

/** Max cache lifetime when no shared Redis is configured (see TieredCache.wrap). */
const LOCAL_ONLY_MAX_TTL_SECONDS = 2;

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp in ms
}

class TieredCache {
  private redis: Redis | null = null;
  private isRedisReady: boolean = false;
  private l1Memory = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();
  private maxL1Items: number = 5000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initRedis();
    this.startL1Janitor();
  }

  private initRedis() {
    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
    if (!redisUrl) {
      // Offline/Dev mode: operate in high-performance L1 in-memory mode
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2500,
        enableOfflineQueue: false,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            // Stop aggressive retries if Redis server is down; retry every 30s
            return 30000;
          }
          return Math.min(times * 1000, 3000);
        },
      });

      this.redis.on('connect', () => {
        this.isRedisReady = true;
      });

      this.redis.on('ready', () => {
        this.isRedisReady = true;
      });

      this.redis.on('error', (_err) => {
        // Suppress unhandled crash on Redis connection refusal; fallback to L1
        this.isRedisReady = false;
      });

      this.redis.on('close', () => {
        this.isRedisReady = false;
      });

      // Non-blocking background connect
      this.redis.connect().catch(() => {
        this.isRedisReady = false;
      });
    } catch {
      this.redis = null;
      this.isRedisReady = false;
    }
  }

  /** Background janitor to sweep expired L1 entries every 30s */
  private startL1Janitor() {
    if (typeof setInterval === 'undefined') return;
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.l1Memory.entries()) {
        if (entry.expiresAt <= now) {
          this.l1Memory.delete(key);
        }
      }
    }, 30000);
    // Allow Node process to exit cleanly if janitor is running
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  /** Checks whether live Redis cluster is actively reachable */
  public isRedisActive(): boolean {
    return this.isRedisReady && this.redis !== null;
  }

  /**
   * Retrieve a typed value from cache.
   * Checks L1 memory first (sub-millisecond).
   * If missed and Redis is active, checks L2 Redis and back-fills L1.
   */
  public async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // 1. Check L1 In-Memory
    const l1Entry = this.l1Memory.get(key);
    if (l1Entry) {
      if (l1Entry.expiresAt > now) {
        return l1Entry.value as T;
      }
      this.l1Memory.delete(key);
    }

    // 2. Check L2 Redis
    if (this.isRedisReady && this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw !== null) {
          const parsed = JSON.parse(raw) as T;
          // Backfill L1 with remainder TTL
          const ttlSec = await this.redis.ttl(key);
          const safeTtl = ttlSec > 0 ? ttlSec * 1000 : 30000;
          this.setL1(key, parsed, safeTtl);
          return parsed;
        }
      } catch {
        // Fall back gracefully on transient Redis error
      }
    }

    return null;
  }

  /**
   * Set a key-value pair in both L1 Memory and L2 Redis.
   * @param ttlSeconds Expiration in seconds (default: 60 seconds)
   */
  public async set<T>(key: string, value: T, ttlSeconds: number = 60): Promise<void> {
    const ttlMs = ttlSeconds * 1000;

    // 1. Write to L1 Memory
    this.setL1(key, value, ttlMs);

    // 2. Write to L2 Redis
    if (this.isRedisReady && this.redis) {
      try {
        const serialized = JSON.stringify(value);
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
      } catch {
        // Fail-safe: L1 already has the value
      }
    }
  }

  private setL1<T>(key: string, value: T, ttlMs: number) {
    if (this.l1Memory.size >= this.maxL1Items) {
      // FIFO eviction of the oldest entry to prevent unbounded heap memory
      const firstKey = this.l1Memory.keys().next().value;
      if (firstKey) this.l1Memory.delete(firstKey);
    }

    this.l1Memory.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /** Delete a single key or array of keys */
  public async del(keys: string | string[]): Promise<void> {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      this.l1Memory.delete(k);
    }

    if (this.isRedisReady && this.redis && keyList.length > 0) {
      try {
        await this.redis.del(...keyList);
      } catch {}
    }
  }

  /**
   * Pattern-based cache invalidation (e.g. 'tasks:*', 'reports:*', 'projects:*').
   * Invalidate matching keys from both L1 memory and L2 Redis.
   */
  public async delPattern(pattern: string): Promise<void> {
    // Regex for matching L1 keys
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of Array.from(this.l1Memory.keys())) {
      if (regexPattern.test(key)) {
        this.l1Memory.delete(key);
      }
    }

    // Pattern deletion in Redis — non-blocking background sweep
    if (this.isRedisReady && this.redis) {
      const client = this.redis;
      (async () => {
        try {
          let cursor = '0';
          do {
            const [nextCursor, matchedKeys] = await client.scan(
              cursor,
              'MATCH',
              pattern,
              'COUNT',
              100
            );
            cursor = nextCursor;
            if (matchedKeys.length > 0) {
              await client.del(...matchedKeys);
            }
          } while (cursor !== '0');
        } catch {}
      })().catch(() => {});
    }
  }

  /**
   * Stampede-Protected Cache-Aside Pattern (Singleflight).
   *
   * If cache hit -> returns immediately.
   * If cache miss -> executes fetcher() only ONCE even if 100 concurrent requests arrive,
   * stores to cache, and resolves all callers simultaneously.
   */
  public async wrap<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    // 1. Try Cache Get
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    // 2. Check if a fetch is already in flight for this exact key (Single-flight protection)
    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      return existingPromise as Promise<T>;
    }

    // 3. Initiate fetcher and record in inFlight map.
    // Without a shared Redis tier, each server instance (each Vercel function) has its own L1 memory
    // and invalidations can't reach the others — long TTLs would serve stale data after edits.
    // So in L1-only mode cap the TTL to a couple of seconds: bursts are still collapsed, data stays fresh.
    const effectiveTtl = this.redis ? ttlSeconds : Math.min(ttlSeconds, LOCAL_ONLY_MAX_TTL_SECONDS);
    const fetchPromise = (async () => {
      try {
        const fresh = await fetcher();
        await this.set(key, fresh, effectiveTtl);
        return fresh;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  /** Flush all cached data */
  public async flush(): Promise<void> {
    this.l1Memory.clear();
    if (this.isRedisReady && this.redis) {
      try {
        await this.redis.flushdb();
      } catch {}
    }
  }
}

// Global singleton instance across Next.js API route modules
const globalForCache = globalThis as unknown as { __flowSyncCache?: TieredCache };
export const redisCache = globalForCache.__flowSyncCache ?? new TieredCache();
if (process.env.NODE_ENV !== 'production') {
  globalForCache.__flowSyncCache = redisCache;
}

export default redisCache;
