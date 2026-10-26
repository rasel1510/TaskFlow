'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { statusColors, priorityColors, type Status, type Priority } from '@/data/mockData';

type View = 'dashboard' | 'tasks' | 'kanban' | 'projects' | 'project-detail' | 'calendar' | 'timeline' | 'reports' | 'settings' | 'inbox';

interface SearchTask {
  id: string;
  taskNumber: string | null;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface SearchProject {
  id: string;
  name: string;
  description: string;
  color: string;
  health: string;
  progress: number;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateView: (view: View) => void;
  onSelectTask: (taskId: string) => void;
  onSelectProject: (projectId: string) => void;
  onCreateTask: () => void;
}

interface NavCommand {
  id: string;
  type: 'action' | 'view';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  view?: View;
  action?: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigateView,
  onSelectTask,
  onSelectProject,
  onCreateTask,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState<SearchTask[]>([]);
  const [projects, setProjects] = useState<SearchProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Quick navigation items
  const navCommands: NavCommand[] = [
    {
      id: 'cmd-create-task',
      type: 'action',
      title: 'Create new task',
      subtitle: 'Open task creation modal',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      action: onCreateTask,
    },
    {
      id: 'cmd-view-dashboard',
      type: 'view',
      title: 'Go to Dashboard',
      subtitle: 'Overview & team productivity metrics',
      view: 'dashboard',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: 'cmd-view-tasks',
      type: 'view',
      title: 'Go to My Tasks',
      subtitle: 'List of your assigned tasks',
      view: 'tasks',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
    {
      id: 'cmd-view-kanban',
      type: 'view',
      title: 'Go to Board',
      subtitle: 'Kanban view across all stages',
      view: 'kanban',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="18" rx="1" />
          <rect x="14" y="3" width="7" height="10" rx="1" />
        </svg>
      ),
    },
    {
      id: 'cmd-view-projects',
      type: 'view',
      title: 'Go to Projects',
      subtitle: 'Browse all company projects',
      view: 'projects',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
        </svg>
      ),
    },
    {
      id: 'cmd-view-calendar',
      type: 'view',
      title: 'Go to Calendar',
      subtitle: 'Month & week task schedule',
      view: 'calendar',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      id: 'cmd-view-inbox',
      type: 'view',
      title: 'Go to Inbox',
      subtitle: 'Assignments, updates & notifications',
      view: 'inbox',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
    },
    {
      id: 'cmd-view-reports',
      type: 'view',
      title: 'Go to Reports',
      subtitle: 'Velocity, workload & metrics',
      view: 'reports',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      id: 'cmd-view-settings',
      type: 'view',
      title: 'Go to Settings',
      subtitle: 'Account, security & workspace preferences',
      view: 'settings',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  // Filter commands by query if query exists
  const filteredCommands = query.trim()
    ? navCommands.filter(
        c =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          (c.subtitle && c.subtitle.toLowerCase().includes(query.toLowerCase()))
      )
    : navCommands;

  // Flatten items for keyboard navigation indexing
  type UnifiedItem =
    | { kind: 'command'; item: NavCommand }
    | { kind: 'task'; item: SearchTask }
    | { kind: 'project'; item: SearchProject };

  const unifiedList: UnifiedItem[] = [
    ...filteredCommands.map(item => ({ kind: 'command' as const, item })),
    ...tasks.map(item => ({ kind: 'task' as const, item })),
    ...projects.map(item => ({ kind: 'project' as const, item })),
  ];

  // Focus input whenever opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setTasks([]);
      setProjects([]);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim()) {
      setTasks([]);
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=8`);
        const json = await res.json();
        if (json.success && json.data) {
          setTasks(json.data.tasks || []);
          setProjects(json.data.projects || []);
        }
      } catch (err) {
        console.error('[CommandPalette] Search fetch error:', err);
      } finally {
        setLoading(false);
        setSelectedIndex(0);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  // Handle item selection execution
  const executeItem = useCallback(
    (item: UnifiedItem) => {
      onClose();
      if (item.kind === 'command') {
        if (item.item.action) {
          item.item.action();
        } else if (item.item.view) {
          onNavigateView(item.item.view);
        }
      } else if (item.kind === 'task') {
        onSelectTask(item.item.id);
      } else if (item.kind === 'project') {
        onSelectProject(item.item.id);
      }
    },
    [onClose, onNavigateView, onSelectTask, onSelectProject]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1 < unifiedList.length ? prev + 1 : 0));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : unifiedList.length - 1));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const activeItem = unifiedList[selectedIndex];
        if (activeItem) {
          executeItem(activeItem);
        }
      }
    },
    [onClose, selectedIndex, unifiedList, executeItem]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E5E7EB] bg-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" className="shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command, search tasks, or jump to a project..."
            className="flex-1 bg-transparent text-[14px] text-[#111111] placeholder-[#9CA3AF] outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-[#9CA3AF] border border-[#E5E7EB] rounded px-1.5 py-0.5 font-mono bg-[#F9FAFB]">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto p-2 divide-y divide-[#F3F4F6] text-[13px]"
        >
          {/* Navigation / Actions section */}
          {filteredCommands.length > 0 && (
            <div className="pb-2">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
                {query.trim() ? 'Matching Commands' : 'Quick Actions & Views'}
              </div>
              <div className="space-y-0.5">
                {filteredCommands.map(cmd => {
                  const currentIndex = unifiedList.findIndex(
                    u => u.kind === 'command' && u.item.id === cmd.id
                  );
                  const isSelected = currentIndex === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeItem({ kind: 'command', item: cmd })}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                        isSelected ? 'bg-[#EFF6FF] text-[#2563EB]' : 'hover:bg-[#F9FAFB] text-[#111111]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`shrink-0 ${isSelected ? 'text-[#2563EB]' : 'text-[rgba(17,17,17,0.5)]'}`}>
                          {cmd.icon}
                        </span>
                        <div className="truncate">
                          <span className="font-medium">{cmd.title}</span>
                          {cmd.subtitle && (
                            <span className="ml-2 text-[12px] text-[rgba(17,17,17,0.45)]">
                              {cmd.subtitle}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-[rgba(17,17,17,0.35)] shrink-0 ml-2">Jump</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tasks Section */}
          {tasks.length > 0 && (
            <div className="py-2">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
                Tasks ({tasks.length})
              </div>
              <div className="space-y-0.5">
                {tasks.map(t => {
                  const currentIndex = unifiedList.findIndex(
                    u => u.kind === 'task' && u.item.id === t.id
                  );
                  const isSelected = currentIndex === selectedIndex;
                  const statusConfig = statusColors[t.status as Status] || { bg: '#F3F4F6', text: '#6B7280', label: t.status };
                  const priorityConfig = priorityColors[t.priority as Priority] || { color: '#6B7280', label: t.priority };

                  return (
                    <button
                      key={t.id}
                      onClick={() => executeItem({ kind: 'task', item: t })}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                        isSelected ? 'bg-[#EFF6FF] text-[#2563EB]' : 'hover:bg-[#F9FAFB] text-[#111111]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
                        <span className="font-medium truncate">{t.title}</span>
                        {t.project && (
                          <span
                            className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[rgba(17,17,17,0.5)] truncate"
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.project.color }} />
                            {t.project.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-medium"
                          style={{ backgroundColor: statusConfig.bg, color: statusConfig.text }}
                        >
                          {statusConfig.label}
                        </span>
                        <span
                          className="hidden sm:inline-block text-[11px] font-medium"
                          style={{ color: priorityConfig.color }}
                        >
                          {priorityConfig.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Projects Section */}
          {projects.length > 0 && (
            <div className="pt-2">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
                Projects ({projects.length})
              </div>
              <div className="space-y-0.5">
                {projects.map(p => {
                  const currentIndex = unifiedList.findIndex(
                    u => u.kind === 'project' && u.item.id === p.id
                  );
                  const isSelected = currentIndex === selectedIndex;
                  return (
                    <button
                      key={p.id}
                      onClick={() => executeItem({ kind: 'project', item: p })}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                        isSelected ? 'bg-[#EFF6FF] text-[#2563EB]' : 'hover:bg-[#F9FAFB] text-[#111111]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: p.color + '20' }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        </div>
                        <div className="truncate">
                          <span className="font-semibold">{p.name}</span>
                          {p.description && (
                            <span className="ml-2 text-[12px] text-[rgba(17,17,17,0.45)] truncate">
                              {p.description}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[11px] text-[rgba(17,17,17,0.5)]">
                          {p.progress}%
                        </span>
                        <span className="text-[11px] text-[#2563EB]">Open →</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {query.trim() && !loading && unifiedList.length === 0 && (
            <div className="py-12 text-center text-[rgba(17,17,17,0.4)]">
              <p>No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-[12px] mt-1 text-[rgba(17,17,17,0.3)]">Try searching for a different keyword or task number</p>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#F9FAFB] border-t border-[#E5E7EB] text-[11px] text-[#9CA3AF]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-[#E5E7EB] bg-white font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-[#E5E7EB] bg-white font-mono">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-[#E5E7EB] bg-white font-mono">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span className="hidden sm:inline">FlowSync Command Engine</span>
        </div>
      </div>
    </div>
  );
}
