import { NextRequest } from 'next/server';
import { requireProjectAccess } from '@/lib/access';
import { projectStreamBroker, type StreamPayload } from '@/lib/projectStreamBroker';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:id/messages/stream
 *
 * Server-Sent Events (SSE) endpoint providing an open, live stream
 * of real-time messages, image deliveries, reactions, and deletions
 * for all members participating in the project.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params;

  const access = await requireProjectAccess(projectId);
  if (!access.ok) return access.response;

  if (!projectId) {
    return new Response(JSON.stringify({ success: false, error: 'Project ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connection confirmation
      const initPayload = JSON.stringify({
        type: 'stream:connected',
        data: { projectId },
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`event: message\ndata: ${initPayload}\n\n`));

      // 2. Subscribe to ProjectStreamBroker for real-time events
      unsubscribe = projectStreamBroker.subscribe(projectId, (payload: StreamPayload) => {
        try {
          const chunk = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch (err) {
          console.error(`[SSE Stream] Failed to enqueue event for project ${projectId}:`, err);
        }
      });

      // 3. Heartbeat keep-alive every 15 seconds to prevent proxy timeouts
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      }, 15000);
    },
    cancel() {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (unsubscribe) unsubscribe();
    },
  });

  // Handle client abort / disconnect
  request.signal.addEventListener('abort', () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (unsubscribe) unsubscribe();
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
