'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTaskContext } from '@/context/TaskContext';

interface ToolExecution {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'success' | 'error';
}

interface CreatedTaskCard {
  id: string;
  taskNumber: string | null;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectName?: string;
  subtasksCount?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolExecution[];
  createdTasks?: CreatedTaskCard[];
}

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId?: string | null;
  onSelectTask?: (taskId: string) => void;
}

const SUGGESTED_PROMPTS = [
  {
    label: 'Create urgent task',
    prompt: 'Create urgent task "Fix authentication webhook timeout" due tomorrow',
  },
  {
    label: 'Feature breakdown',
    prompt: 'Break down "Implement 2FA" into 3 tasks',
  },
  {
    label: 'Overdue tasks',
    prompt: 'What tasks are currently overdue?',
  },
  {
    label: 'Workspace briefing',
    prompt: 'Show workspace overview',
  },
];

export default function CopilotDrawer({
  isOpen,
  onClose,
  currentProjectId,
  onSelectTask,
}: CopilotDrawerProps) {
  const { refreshTasks } = useTaskContext();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'What would you like to do? You can ask to create tasks, break down work, or check project status.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 100);
    }
  }, [isOpen, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Handle escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isLoading) return;

    const userMsgId = 'msg-' + Date.now();
    const newMessages: Message[] = [
      ...messages,
      {
        id: userMsgId,
        role: 'user',
        content: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];

    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      // Send chat payload to /api/copilot
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages
            .filter(m => m.id !== 'welcome')
            .map(m => ({ role: m.role, content: m.content })),
          currentProjectId: currentProjectId || null,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        const { reply, toolCalls, createdTasks } = json.data;

        const assistantMsg: Message = {
          id: 'asst-' + Date.now(),
          role: 'assistant',
          content: reply || 'Action executed successfully.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolCalls: toolCalls || [],
          createdTasks: createdTasks || [],
        };

        setMessages(prev => [...prev, assistantMsg]);

        // If tasks were created or modified, synchronize UI optimistically
        if (createdTasks && createdTasks.length > 0) {
          try {
            await refreshTasks();
          } catch {}
        }
      } else {
        const errorMsg: Message = {
          id: 'err-' + Date.now(),
          role: 'assistant',
          content: `⚠️ ${json.message || 'Failed to process request with FlowAi.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Network error';
      setMessages(prev => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          content: `⚠️ Error connecting to FlowAi: ${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px] transition-opacity">
      {/* Background click to close */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />

      {/* Drawer Container */}
      <div className="w-full max-w-[480px] h-full bg-white shadow-2xl flex flex-col border-l border-[#E5E7EB] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F1F3F5] flex items-center justify-between bg-[#FAFBFC]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-[#111111]">FlowAi</h3>
              </div>
              <p className="text-[11px] text-gray-400">
                Workspace assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setMessages([
                  {
                    id: 'welcome',
                    role: 'assistant',
                    content: 'Chat cleared. How can I help you?',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ]);
              }}
              title="Clear conversation"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map(msg => {
            const cleanContent = msg.content
              .replace(/(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/g, '$1');

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#2563EB] text-white rounded-br-xs shadow-xs'
                      : 'bg-[#F9FAFB] text-[#111111] border border-[#F1F3F5] rounded-bl-xs shadow-2xs'
                  }`}
                >
                  {/* Text Content */}
                  <div className="whitespace-pre-wrap break-words">
                    {cleanContent}
                  </div>

                  {/* Created Task Interactive Cards */}
                  {msg.createdTasks && msg.createdTasks.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.createdTasks.map(task => {
                        const cleanDueDate = task.dueDate ? String(task.dueDate).split('T')[0] : null;

                        return (
                          <div
                            key={task.id}
                            className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:border-blue-300 transition-all flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#2563EB]">
                                {task.taskNumber || 'TASK'}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  task.priority === 'urgent'
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : task.priority === 'high'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {task.priority}
                              </span>
                            </div>

                            <p className="text-[13px] font-medium text-gray-900 leading-snug">
                              {task.title}
                            </p>

                            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                              <span className="flex items-center gap-1">
                                Due: {cleanDueDate || 'No deadline'}
                              </span>
                              {onSelectTask && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectTask(task.id);
                                    onClose();
                                  }}
                                  className="text-[#2563EB] hover:underline font-semibold cursor-pointer"
                                >
                                  Open Task →
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-gray-400 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500 text-[12px] bg-[#F9FAFB] px-3.5 py-2 rounded-xl border border-gray-100 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              <span>Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length <= 2 && (
          <div className="px-5 py-2.5 border-t border-[#F1F3F5] bg-[#FAFBFC]">
            <p className="text-[11px] font-medium text-gray-400 mb-2">
              Suggestions
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(item.prompt)}
                  className="p-2 text-left rounded-lg border border-gray-200 hover:border-blue-400 bg-white hover:bg-blue-50/40 transition-all text-[11.5px] text-gray-700 flex flex-col gap-0.5 cursor-pointer shadow-2xs"
                >
                  <span className="font-semibold text-gray-900">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-gray-400 truncate">
                    {item.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-[#F1F3F5] bg-white">
          <div className="relative border border-[#E5E7EB] rounded-xl focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-blue-500/10 transition-all bg-[#F9FAFB]">
            <textarea
              ref={inputRef}
              rows={2}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Add urgent task Fix auth token bug due tomorrow..."
              className="w-full resize-none px-3.5 py-2.5 text-[13px] bg-transparent outline-none text-[#111111] placeholder:text-gray-400 leading-relaxed"
            />
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-200/50">
              <span className="text-[10.5px] text-gray-400">
                Enter to send · Shift+Enter for newline
              </span>
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
              >
                <span>Send</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
