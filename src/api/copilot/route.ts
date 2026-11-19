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

    const result = await runFlowSyncAgent(
      messages,
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
    const message = error instanceof Error ? error.message : 'An error occurred during Copilot execution.';
    console.error('Copilot Agent error:', error);
    return NextResponse.json(
      { success: false, message, status: 500 },
      { status: 500 }
    );
  }
}
