/**
 * src/api/copilot/route.ts
 *
 * FlowSync Copilot Agent conversational endpoint.
 * Accepts user messages, orchestrates the OpenRouter + MCP tool calling loop,
 * and returns generated replies along with structured task metadata.
 *
 * Architecture note:
 *   Business logic lives here.
 *   The Next.js App Router file at src/app/api/copilot/route.ts
 *   simply re-exports { POST } from this module.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runFlowSyncAgent } from '@/lib/mcp/agent';
import { auth } from '@/auth';
import { overLimit, HOUR } from '@/lib/abuseGuard';

// Limits that keep AI costs bounded
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4000;
const MAX_REQUESTS_PER_HOUR = 60;

export async function POST(request: NextRequest) {
  try {
    let body: {
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      currentProjectId?: string | null;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON request payload', status: 400 },
        { status: 400 }
      );
    }

    const { messages, currentProjectId } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Messages array is required and cannot be empty.', status: 400 },
        { status: 400 }
      );
    }

    // Authenticate user session
    let sessionUserId: string | undefined;
    let sessionUserEmail: string | undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id as string | undefined;
      sessionUserEmail = session?.user?.email as string | undefined;
    } catch {}

    // Require a signed-in user — prevents anonymous use of paid LLM credits and tools
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, message: 'Authentication required. Please sign in to use FlowAi.', status: 401 },
        { status: 401 }
      );
    }

    // Bounded conversation size and per-person hourly limit (stops runaway AI spend)
    const trimmed = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_MESSAGES)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
    if (trimmed.length === 0) {
      return NextResponse.json({ success: false, message: 'Messages array is required and cannot be empty.', status: 400 }, { status: 400 });
    }
    if (await overLimit('copilot', sessionUserId, MAX_REQUESTS_PER_HOUR, HOUR)) {
      return NextResponse.json(
        { success: false, message: 'You’ve reached the FlowAi limit for this hour. Please try again later.', status: 429 },
        { status: 429 }
      );
    }

    const result = await runFlowSyncAgent(
      trimmed,
      {
        userId: sessionUserId,
        userEmail: sessionUserEmail,
      },
      {
        currentProjectId: currentProjectId || null,
      }
    );

    return NextResponse.json({
      success: true,
      data: result,
      status: 200,
    });
  } catch (error: unknown) {
    // Details stay in the server log; the person sees a plain message
    console.error('Copilot Agent error:', error);
    return NextResponse.json(
      { success: false, message: 'FlowAi couldn’t answer right now. Please try again.', status: 500 },
      { status: 500 }
    );
  }
}
