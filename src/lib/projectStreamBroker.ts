/**
 * src/lib/projectStreamBroker.ts
 *
 * Lightweight pub/sub broker for Server-Sent Events (SSE).
 * Partitions subscriber streams by projectId for O(1) broadcast complexity.
 */

export type StreamEventType = 'message:created' | 'message:updated' | 'message:deleted' | 'ping';

export interface StreamPayload {
  type: StreamEventType;
  data?: any;
  timestamp: string;
}

type StreamSubscriber = (payload: StreamPayload) => void;

class ProjectStreamBroker {
  private subscribers = new Map<string, Set<StreamSubscriber>>();

  /**
   * Subscribe a client stream to real-time events for a specific project.
   * Returns an unsubscribe function for automatic cleanup.
   */
  subscribe(projectId: string, subscriber: StreamSubscriber): () => void {
    if (!this.subscribers.has(projectId)) {
      this.subscribers.set(projectId, new Set());
    }
    const projectSubs = this.subscribers.get(projectId)!;
    projectSubs.add(subscriber);

    return () => {
      projectSubs.delete(subscriber);
      if (projectSubs.size === 0) {
        this.subscribers.delete(projectId);
      }
    };
  }

  /**
   * Broadcast an event to all active clients currently listening to the project.
   */
  publish(projectId: string, type: StreamEventType, data?: any) {
    const projectSubs = this.subscribers.get(projectId);
    if (!projectSubs || projectSubs.size === 0) return;

    const payload: StreamPayload = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    projectSubs.forEach(subscriber => {
      try {
        subscriber(payload);
      } catch (err) {
        console.error(`[ProjectStreamBroker] Error delivering payload for project ${projectId}:`, err);
      }
    });
  }

  /**
   * Number of active stream subscribers for a project.
   */
  getSubscriberCount(projectId: string): number {
    return this.subscribers.get(projectId)?.size || 0;
  }
}

// Global singleton to persist across HMR reloads in Next.js
const globalForBroker = globalThis as unknown as { __flowSyncStreamBroker?: ProjectStreamBroker };
export const projectStreamBroker = globalForBroker.__flowSyncStreamBroker ?? new ProjectStreamBroker();
if (process.env.NODE_ENV !== 'production') {
  globalForBroker.__flowSyncStreamBroker = projectStreamBroker;
}
