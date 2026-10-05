/**
 * src/api/mcp/route.ts
 *
 * Model Context Protocol (MCP) HTTP Endpoint.
 * Supports standard JSON-RPC 2.0 requests over POST and status check over GET.
 *
 * Architecture note:
 *   Business logic lives here.
 *   The Next.js App Router file at src/app/api/mcp/route.ts
 *   simply re-exports { GET, POST } from this module.
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleMcpJsonRpc } from '@/lib/mcp/server';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: invalid JSON' } },
        { status: 400 }
      );
    }

    // Resolve caller session if present
    let sessionUserId: string | undefined;
    let sessionUserEmail: string | undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id as string | undefined;
      sessionUserEmail = session?.user?.email as string | undefined;
    } catch {}

    const response = await handleMcpJsonRpc(body, {
      userId: sessionUserId,
      userEmail: sessionUserEmail,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Server': 'FlowSync/1.0.0',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: msg } },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    protocol: 'model-context-protocol',
    version: '1.0.0',
    capabilities: ['tools', 'resources', 'prompts'],
    endpoint: '/api/mcp',
  });
}
