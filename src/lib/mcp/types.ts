/**
 * src/lib/mcp/types.ts
 *
 * Formal types for Model Context Protocol (MCP) JSON-RPC 2.0 implementation
 * and the FlowSync AI Copilot agent loop.
 */

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 Standard Protocol Types
// ---------------------------------------------------------------------------

export interface JsonRpcRequest<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: T;
}

export interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result: T;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: JsonRpcErrorObject;
}

export type JsonRpcResponse<T = unknown> = JsonRpcSuccessResponse<T> | JsonRpcErrorResponse;

// Standard JSON-RPC error codes
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ---------------------------------------------------------------------------
// MCP Tool Specification Types
// ---------------------------------------------------------------------------

export interface McpToolParameterSchema {
  type: string;
  properties?: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    items?: Record<string, unknown>;
    default?: unknown;
  }>;
  required?: string[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpToolParameterSchema;
}

export interface McpToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: unknown;
  }>;
  isError?: boolean;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Agent & Copilot Types
// ---------------------------------------------------------------------------

export type CopilotRole = 'user' | 'assistant' | 'system' | 'tool';

export interface CopilotMessage {
  id: string;
  role: CopilotRole;
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    status: 'pending' | 'success' | 'error';
  }>;
  createdTasks?: Array<{
    id: string;
    taskNumber: string | null;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    projectName?: string;
  }>;
}

export interface CopilotChatPayload {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  currentProjectId?: string | null;
}
