/**
 * src/lib/asyncQueue.ts
 *
 * Google-Standard Asynchronous Background Task Queue & Dispatcher.
 *
 * Decouples heavy side-effects (audit activity logs, notifications,
 * multi-model progress recalculation, and distributed cache purges)
 * from the HTTP request-response lifecycle.
 *
 * Latency Budget:
 *  - Primary DB Transaction: ~15ms (Synchronous)
 *  - Client Response Returned: <20ms (Immediate)
 *  - Background Queue Side-effects: Dispatched asynchronously without blocking event loop
 *
 * Fault Tolerance:
 *  - Bounded concurrency to protect database connection pools.
 *  - Automatic retry with exponential backoff for transient failures.
 *  - Complete exception isolation: background worker failures never fail user HTTP requests.
 */

export interface BackgroundTaskOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  priority?: 'high' | 'normal' | 'low';
}

interface QueuedJob {
  id: string;
  name: string;
  fn: () => Promise<void>;
  retriesRemaining: number;
  delayMs: number;
  enqueuedAt: number;
}

class AsyncTaskQueue {
  private queue: QueuedJob[] = [];
  private isProcessing: boolean = false;
  private concurrencyLimit: number = 5;
  private activeWorkers: number = 0;

  /**
   * Enqueue a non-blocking background job. Returns immediately to caller.
   */
  public enqueue(
    name: string,
    fn: () => Promise<void>,
    options: BackgroundTaskOptions = {}
  ): void {
    const { maxRetries = 2, initialDelayMs = 0 } = options;

    const job: QueuedJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      name,
      fn,
      retriesRemaining: maxRetries,
      delayMs: initialDelayMs,
      enqueuedAt: Date.now(),
    };

    this.queue.push(job);
    this.scheduleDrain();
  }

  private scheduleDrain(): void {
    if (this.isProcessing) return;

    // Use setImmediate / setTimeout(0) to yield immediately to the V8 event loop
    if (typeof setImmediate !== 'undefined') {
      setImmediate(() => this.drain());
    } else {
      setTimeout(() => this.drain(), 0);
    }
  }

  private async drain(): Promise<void> {
    this.isProcessing = true;

    while (this.queue.length > 0 && this.activeWorkers < this.concurrencyLimit) {
      const job = this.queue.shift();
      if (!job) break;

      this.activeWorkers++;
      this.executeJob(job).finally(() => {
        this.activeWorkers--;
        this.drain();
      });
    }

    this.isProcessing = this.activeWorkers > 0;
  }

  private async executeJob(job: QueuedJob): Promise<void> {
    if (job.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, job.delayMs));
    }

    try {
      await job.fn();
    } catch (err) {
      if (job.retriesRemaining > 0) {
        job.retriesRemaining--;
        job.delayMs = Math.max(250, (job.delayMs || 200) * 2); // Exponential backoff
        console.warn(`[AsyncQueue] Retrying job "${job.name}" (${job.retriesRemaining} retries left):`, err);
        this.queue.push(job);
      } else {
        console.error(`[AsyncQueue] Job "${job.name}" exhausted all retries and failed:`, err);
      }
    }
  }

  /** Current pending queue size */
  public get pendingCount(): number {
    return this.queue.length;
  }
}

// Attach to globalThis to survive Next.js HMR reloads in development
const globalForQueue = globalThis as unknown as { __asyncQueue?: AsyncTaskQueue };
export const asyncQueue = globalForQueue.__asyncQueue ?? new AsyncTaskQueue();
if (process.env.NODE_ENV !== 'production') {
  globalForQueue.__asyncQueue = asyncQueue;
}

/**
 * Convenience helper to enqueue a fire-and-forget background job.
 */
export function enqueueBackgroundTask(
  name: string,
  fn: () => Promise<void>,
  options?: BackgroundTaskOptions
): void {
  asyncQueue.enqueue(name, fn, options);
}

export default asyncQueue;
