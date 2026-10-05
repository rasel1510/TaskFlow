/**
 * src/lib/mcp/server.ts
 *
 * Core Model Context Protocol (MCP) JSON-RPC 2.0 Server.
 * Exposes FlowSync as a standard MCP Server for external clients
 * (e.g. Cursor, Claude Desktop, Antigravity, custom agents).
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  JSON_RPC_ERRORS,
  McpResourceDefinition,
  McpPromptDefinition,
} from './types';
import { MCP_TOOL_DEFINITIONS, executeMcpTool, ExecutionContext } from './tools';
import prisma from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Standard MCP Capabilities & Metadata
// ---------------------------------------------------------------------------

const SERVER_INFO = {
  name: 'flowsync-mcp-server',
  version: '1.0.0',
};

const RESOURCES: McpResourceDefinition[] = [
  {
    uri: 'flowsync://workspace/summary',
    name: 'Workspace Summary',
    description: 'Current metrics, task counts, overdue items and sprint status',
    mimeType: 'application/json',
  },
  {
    uri: 'flowsync://projects',
    name: 'All Projects',
    description: 'Active projects list with health and progress',
    mimeType: 'application/json',
  },
];

const PROMPTS: McpPromptDefinition[] = [
  {
    name: 'daily_standup',
    description: 'Generates a concise daily standup summary of overdue tasks, in-progress items, and blockers',
  },
  {
    name: 'feature_breakdown',
    description: 'Decomposes a product feature into actionable engineering tasks with estimates and milestones',
    arguments: [
      { name: 'featureDescription', description: 'Description of the feature to break down', required: true },
      { name: 'projectName', description: 'Target project name', required: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// JSON-RPC Dispatcher
// ---------------------------------------------------------------------------

export async function handleMcpJsonRpc(
  body: unknown,
  context: ExecutionContext = {}
): Promise<JsonRpcResponse> {
  // Validate basic JSON-RPC structure
  if (!body || typeof body !== 'object') {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: JSON_RPC_ERRORS.INVALID_REQUEST, message: 'Invalid JSON-RPC request.' },
    };
  }

  const req = body as Partial<JsonRpcRequest>;
  const id = req.id ?? null;

  if (req.jsonrpc !== '2.0' || !req.method || typeof req.method !== 'string') {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: JSON_RPC_ERRORS.INVALID_REQUEST, message: 'Must specify jsonrpc: "2.0" and a valid method.' },
    };
  }

  try {
    switch (req.method) {
      // 1. Handshake / Initialize
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: id ?? 1,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: SERVER_INFO,
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
          },
        };

      // 2. Tools
      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id: id ?? 1,
          result: {
            tools: MCP_TOOL_DEFINITIONS,
          },
        };

      case 'tools/call': {
        const params = req.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
        if (!params || !params.name) {
          return {
            jsonrpc: '2.0',
            id: id ?? 1,
            error: { code: JSON_RPC_ERRORS.INVALID_PARAMS, message: 'Missing tool name in params.' },
          };
        }

        const toolResult = await executeMcpTool(params.name, params.arguments || {}, context);
        return {
          jsonrpc: '2.0',
          id: id ?? 1,
          result: toolResult,
        };
      }

      // 3. Resources
      case 'resources/list':
        return {
          jsonrpc: '2.0',
          id: id ?? 1,
          result: {
            resources: RESOURCES,
          },
        };

      case 'resources/read': {
        const params = req.params as { uri?: string } | undefined;
        if (!params || !params.uri) {
          return {
            jsonrpc: '2.0',
            id: id ?? 1,
            error: { code: JSON_RPC_ERRORS.INVALID_PARAMS, message: 'Missing uri in params.' },
          };
        }

        if (params.uri === 'flowsync://workspace/summary') {
          const summary = await executeMcpTool('get_workspace_summary', {}, context);
          return {
            jsonrpc: '2.0',
            id: id ?? 1,
            result: {
              contents: [
                {
                  uri: params.uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(summary.content[0]?.data ?? {}),
                },
              ],
            },
          };
        }

        if (params.uri === 'flowsync://projects') {
          const projects = await prisma.project.findMany({
            select: { id: true, name: true, health: true, progress: true },
          });
          return {
            jsonrpc: '2.0',
            id: id ?? 1,
            result: {
              contents: [
                {
                  uri: params.uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(projects),
                },
              ],
            },
          };
        }

        return {
          jsonrpc: '2.0',
          id: id ?? 1,
          error: { code: JSON_RPC_ERRORS.INVALID_PARAMS, message: `Resource not found: ${params.uri}` },
        };
      }

      // 4. Prompts
      case 'prompts/list':
        return {
          jsonrpc: '2.0',
          id: id ?? 1,
          result: {
            prompts: PROMPTS,
          },
        };

      case 'prompts/get': {
        const params = req.params as { name?: string; arguments?: Record<string, string> } | undefined;
        if (!params || !params.name) {
          return {
            jsonrpc: '2.0',
            id: id ?? 1,
            error: { code: JSON_RPC_ERRORS.INVALID_PARAMS, message: 'Missing prompt name.' },
          };
        }

        if (params.name === 'daily_standup') {
          return {
            jsonrpc: '2.0',
            id: id ?? 1,
            result: {
              description: 'Daily standup prompt',
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'text',
                    text: 'Please inspect our workspace tasks, summarize what was finished, what is currently in progress, and highlight any overdue blockers for today.',
                  },
                },
              ],
            },
          };
        }

        if (params.name === 'feature_breakdown') {
          const desc = params.arguments?.featureDescription || 'A new product feature';
          const proj = params.arguments?.projectName ? ` for project "${params.arguments.projectName}"` : '';
          return {
            jsonrpc: '2.0',
            id: id ?? 1,
            result: {
              description: 'Feature breakdown prompt',
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'text',
                    text: `Break down the following feature into 3-5 structured engineering tasks${proj}: "${desc}". Include clear acceptance criteria and appropriate priority levels.`,
                  },
                },
              ],
            },
          };
        }

        return {
          jsonrpc: '2.0',
          id: id ?? 1,
          error: { code: JSON_RPC_ERRORS.INVALID_PARAMS, message: `Prompt not found: ${params.name}` },
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id: id ?? 1,
          error: { code: JSON_RPC_ERRORS.METHOD_NOT_FOUND, message: `Method not found: ${req.method}` },
        };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal MCP server error';
    return {
      jsonrpc: '2.0',
      id: id ?? 1,
      error: { code: JSON_RPC_ERRORS.INTERNAL_ERROR, message },
    };
  }
}
