/**
 * src/lib/mcp/agent.ts
 *
 * FlowSync Agentic Copilot Runner.
 * Interfaces with OpenRouter LLM using MCP Tools in an autonomous multi-step loop.
 */

import { MCP_TOOL_DEFINITIONS, executeMcpTool, ExecutionContext } from './tools';

export interface AgentResult {
  reply: string;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    status: 'success' | 'error';
  }>;
  createdTasks: Array<{
    id: string;
    taskNumber: string | null;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    projectName?: string;
  }>;
}

export async function runFlowSyncAgent(
  userMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: ExecutionContext = {},
  options: { currentProjectId?: string | null } = {}
): Promise<AgentResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured in environment variables.');
  }

  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

  const todayStr = new Date().toISOString().split('T')[0];
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());

  const systemPrompt = `You are FlowSync AI Copilot. You execute workspace tasks concisely and directly.

CURRENT CONTEXT:
- Today's date: ${todayStr} (${weekday})
- Active project context: ${options.currentProjectId ? `Project ID: ${options.currentProjectId}` : 'All projects / Workspace root'}

OPERATIONAL RULES:
1. Tool Invocation: When the user asks to create or update tasks, execute the corresponding tool (\`create_task\`, \`batch_create_tasks\`, \`update_task\`) immediately.
2. Due Dates: ALWAYS specify due dates strictly in "YYYY-MM-DD" format (e.g. "${todayStr}"). NEVER append time or timezone text like "T00:00:00.000Z".
3. Zero AI Slop / Zero Boilerplate:
   - Do NOT use filler: never say "Certainly!", "Sure thing!", "I would be happy to help", "Here are the details:", or "Let me know if there's anything else!".
   - When a task is created or updated, output ONLY a single one-line crisp confirmation (e.g. "Created **[TF-005]** due ${todayStr}.").
   - Do NOT output repetitive lists or bullet points describing fields that already appear in the task card.
4. If asked what tasks are overdue or need attention, call \`list_tasks\` or \`get_workspace_summary\` first to inspect real data.`;

  // Convert MCP tool declarations to OpenAI function calling format
  const tools = MCP_TOOL_DEFINITIONS.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));

  // Build message history
  const messages: Array<{
    role: string;
    content: string | null;
    tool_calls?: unknown[];
    tool_call_id?: string;
  }> = [
    { role: 'system', content: systemPrompt },
    ...userMessages.map(m => ({ role: m.role, content: m.content })),
  ];

  const executedToolCalls: AgentResult['toolCalls'] = [];
  const createdTasks: AgentResult['createdTasks'] = [];

  // Multi-step agentic execution loop (bounded at 4 steps to prevent unbounded execution)
  let turns = 0;
  const maxTurns = 4;
  let finalReply = '';

  while (turns < maxTurns) {
    turns++;

    const payload = {
      model,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 1500,
      temperature: 0.2,
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://flowsync.app',
        'X-Title': 'FlowSync AI Copilot',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice || !choice.message) {
      break;
    }

    const assistantMsg = choice.message;

    // Check if the model wants to call tools
    if (assistantMsg.tool_calls && Array.isArray(assistantMsg.tool_calls) && assistantMsg.tool_calls.length > 0) {
      messages.push({
        role: 'assistant',
        content: assistantMsg.content || null,
        tool_calls: assistantMsg.tool_calls,
      });

      for (const call of assistantMsg.tool_calls) {
        const toolName = call.function.name;
        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(call.function.arguments || '{}');
        } catch {
          toolArgs = {};
        }

        // Execute tool safely
        const toolResult = await executeMcpTool(toolName, toolArgs, context);

        executedToolCalls.push({
          id: call.id,
          name: toolName,
          arguments: toolArgs,
          result: toolResult.content[0]?.data,
          status: toolResult.isError ? 'error' : 'success',
        });

        // Collect newly created tasks for rich card UI
        if (toolName === 'create_task' && toolResult.content[0]?.data) {
          const taskData = toolResult.content[0].data as AgentResult['createdTasks'][0];
          createdTasks.push(taskData);
        } else if (toolName === 'batch_create_tasks' && Array.isArray(toolResult.content[0]?.data)) {
          const batchTasks = toolResult.content[0].data as AgentResult['createdTasks'];
          createdTasks.push(...batchTasks);
        }

        // Return tool execution output back to LLM
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: toolResult.content[0]?.text || JSON.stringify(toolResult.content),
        });
      }

      // Loop continues to let model synthesize answer with tool output
    } else {
      // Model provided final answer without calling any more tools
      finalReply = assistantMsg.content || '';
      break;
    }
  }

  // Sanitize any ISO timestamp strings (e.g., 2026-09-05T00:00:00.000Z -> 2026-09-05)
  if (finalReply) {
    finalReply = finalReply
      .replace(/(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/g, '$1')
      .trim();
  }

  if (!finalReply && createdTasks.length > 0) {
    finalReply = createdTasks.length === 1
      ? `Created **[${createdTasks[0].taskNumber || 'TASK'}]** "${createdTasks[0].title}".`
      : `Created ${createdTasks.length} tasks.`;
  }

  return {
    reply: finalReply,
    toolCalls: executedToolCalls,
    createdTasks,
  };
}
