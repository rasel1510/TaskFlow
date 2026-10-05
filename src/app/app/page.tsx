'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import TaskDetail from '@/components/TaskDetail';
import CreateTaskModal from '@/components/CreateTaskModal';
import CommandPalette from '@/components/CommandPalette';
import Dashboard from '@/views/Dashboard';
import MyTasks from '@/views/MyTasks';
import KanbanBoard from '@/views/KanbanBoard';
import Projects from '@/views/Projects';
import ProjectDetail from '@/views/ProjectDetail';
import CalendarView from '@/views/CalendarView';
import TimelineView from '@/views/TimelineView';
import Inbox from '@/views/Inbox';
import Reports from '@/views/Reports';
import Settings from '@/views/Settings';
import { TaskProvider } from '@/context/TaskContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import PWAModal from '@/components/PWAModal';
import CopilotDrawer from '@/components/copilot/CopilotDrawer';

type View =
  | 'dashboard'
  | 'tasks'
  | 'kanban'
  | 'projects'
  | 'project-detail'
  | 'calendar'
  | 'timeline'
  | 'reports'
  | 'settings'
  | 'inbox';

export default function AppPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [view, setView] = useState<View>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskDate, setCreateTaskDate] = useState<string | undefined>(undefined);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isPWAModalOpen, setIsPWAModalOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // Redirect to home page if unauthenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Close mobile sidebar on view change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [view]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileSidebarOpen]);

  // Global keydown listener for Command Palette (Ctrl+K) & Copilot (Ctrl+J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(open => !open);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsCopilotOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex h-[100dvh] w-screen items-center justify-center bg-[#F9FAFB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#2563EB] flex items-center justify-center shadow-lg shadow-blue-500/20 animate-pulse">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path
                d="M9 11l3 3L22 4"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <div className="w-3.5 h-3.5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
            Loading TaskFlow...
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  const navigateTo = (v: View) => {
    if (v !== 'project-detail') {
      setSelectedProjectId(null);
    }
    setView(v);
  };

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard onTaskClick={setSelectedTask} onViewChange={v => setView(v)} />;
      case 'tasks':
        return <MyTasks onTaskClick={setSelectedTask} onCreateTask={() => setShowCreateTask(true)} />;
      case 'kanban':
        return <KanbanBoard onTaskClick={setSelectedTask} onCreateTask={() => setShowCreateTask(true)} />;
      case 'projects':
        return (
          <Projects
            onViewChange={v => setView(v)}
            onSelectProject={id => {
              setSelectedProjectId(id);
              setView('project-detail');
            }}
          />
        );
      case 'project-detail':
        return selectedProjectId ? (
          <ProjectDetail
            projectId={selectedProjectId}
            onBack={() => {
              setSelectedProjectId(null);
              setView('projects');
            }}
            onTaskClick={setSelectedTask}
            onCreateTask={() => setShowCreateTask(true)}
          />
        ) : (
          <Projects
            onViewChange={v => setView(v)}
            onSelectProject={id => {
              setSelectedProjectId(id);
              setView('project-detail');
            }}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            onTaskClick={setSelectedTask}
            onCreateTask={(date) => {
              setCreateTaskDate(date);
              setShowCreateTask(true);
            }}
          />
        );
      case 'timeline':
        return (
          <TimelineView
            onTaskClick={setSelectedTask}
            onCreateTask={(date) => {
              setCreateTaskDate(date);
              setShowCreateTask(true);
            }}
          />
        );
      case 'inbox':
        return <Inbox onTaskClick={setSelectedTask} />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      default:
        return null;
    }
  };

  return (
    <TaskProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-white">
        {/* Mobile sidebar backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar overlay"
          />
        )}

        <Sidebar
          currentView={view === 'project-detail' ? 'projects' : view}
          onNavigate={navigateTo}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          onOpenPWA={() => setIsPWAModalOpen(true)}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header
            currentView={view === 'project-detail' ? 'projects' : view}
            onCreateTask={() => setShowCreateTask(true)}
            onMenuToggle={() => setMobileSidebarOpen(o => !o)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenCopilot={() => setIsCopilotOpen(true)}
            onNavigate={navigateTo}
            onOpenPWA={() => setIsPWAModalOpen(true)}
          />
          {/* Main content area — on mobile, reserve space for the bottom nav (56px) */}
          <main className="flex flex-1 overflow-hidden min-h-0">
            <ErrorBoundary viewName={view}>
              {renderView()}
            </ErrorBoundary>
          </main>

          {/* Mobile Bottom Navigation Bar (PWA & Mobile touch experience) */}
          <nav
            className="md:hidden flex items-center justify-around bg-white border-t border-[#E5E7EB] px-2 py-1 shrink-0 z-30 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.03)]"
            aria-label="Mobile Navigation"
          >
            {/* Dashboard */}
            <button
              onClick={() => navigateTo('dashboard')}
              className={`flex flex-col items-center justify-center py-1 px-2.5 min-w-[54px] min-h-[44px] rounded-lg transition-colors ${
                view === 'dashboard'
                  ? 'text-[#2563EB]'
                  : 'text-[rgba(17,17,17,0.5)] active:text-[#111111]'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={view === 'dashboard' ? '2.2' : '1.75'} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className={`text-[10px] mt-0.5 tracking-tight ${view === 'dashboard' ? 'font-bold' : 'font-medium'}`}>
                Home
              </span>
            </button>

            {/* My Tasks */}
            <button
              onClick={() => navigateTo('tasks')}
              className={`flex flex-col items-center justify-center py-1 px-2.5 min-w-[54px] min-h-[44px] rounded-lg transition-colors ${
                view === 'tasks'
                  ? 'text-[#2563EB]'
                  : 'text-[rgba(17,17,17,0.5)] active:text-[#111111]'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={view === 'tasks' ? '2.2' : '1.75'} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <span className={`text-[10px] mt-0.5 tracking-tight ${view === 'tasks' ? 'font-bold' : 'font-medium'}`}>
                Tasks
              </span>
            </button>

            {/* Center Quick Add Floating Button */}
            <button
              onClick={() => setShowCreateTask(true)}
              aria-label="Create Task"
              className="flex items-center justify-center w-11 h-11 -mt-4 rounded-full bg-[#2563EB] text-white shadow-lg shadow-blue-500/30 hover:bg-[#1D4ED8] active:scale-95 transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Board */}
            <button
              onClick={() => navigateTo('kanban')}
              className={`flex flex-col items-center justify-center py-1 px-2.5 min-w-[54px] min-h-[44px] rounded-lg transition-colors ${
                view === 'kanban'
                  ? 'text-[#2563EB]'
                  : 'text-[rgba(17,17,17,0.5)] active:text-[#111111]'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={view === 'kanban' ? '2.2' : '1.75'} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M8 7v10M12 7v6M16 7v8" />
              </svg>
              <span className={`text-[10px] mt-0.5 tracking-tight ${view === 'kanban' ? 'font-bold' : 'font-medium'}`}>
                Board
              </span>
            </button>

            {/* Projects */}
            <button
              onClick={() => navigateTo('projects')}
              className={`flex flex-col items-center justify-center py-1 px-2.5 min-w-[54px] min-h-[44px] rounded-lg transition-colors ${
                view === 'projects' || view === 'project-detail'
                  ? 'text-[#2563EB]'
                  : 'text-[rgba(17,17,17,0.5)] active:text-[#111111]'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={view === 'projects' || view === 'project-detail' ? '2.2' : '1.75'} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
              </svg>
              <span className={`text-[10px] mt-0.5 tracking-tight ${view === 'projects' || view === 'project-detail' ? 'font-bold' : 'font-medium'}`}>
                Projects
              </span>
            </button>
          </nav>
        </div>

        {/* Task Detail Drawer */}
        {selectedTask && (
          <TaskDetail
            taskId={selectedTask}
            onClose={() => setSelectedTask(null)}
          />
        )}

        {/* Create Task Modal */}
        {showCreateTask && (
          <CreateTaskModal
            onClose={() => {
              setShowCreateTask(false);
              setCreateTaskDate(undefined);
            }}
            prefillDate={createTaskDate}
          />
        )}

        {/* Global Command Palette */}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onNavigateView={v => {
            if (v !== 'project-detail') setSelectedProjectId(null);
            setView(v);
          }}
          onSelectTask={id => {
            setSelectedTask(id);
            setCommandPaletteOpen(false);
          }}
          onSelectProject={id => {
            setSelectedProjectId(id);
            setView('project-detail');
            setCommandPaletteOpen(false);
          }}
          onCreateTask={() => {
            setShowCreateTask(true);
            setCommandPaletteOpen(false);
          }}
        />

        {/* PWA Install Prompt — appears on eligible devices */}
        <PWAInstallPrompt />

        {/* PWA Install Modal — triggered manually from Header / menus */}
        <PWAModal
          isOpen={isPWAModalOpen}
          onClose={() => setIsPWAModalOpen(false)}
        />

        {/* FlowSync Copilot Drawer (Autonomous Agent & MCP Engine) */}
        <CopilotDrawer
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          currentProjectId={selectedProjectId}
          onSelectTask={id => setSelectedTask(id)}
        />

        {/* Floating FlowAi Trigger Button */}
        <button
          type="button"
          onClick={() => setIsCopilotOpen(true)}
          aria-label="Open FlowAi"
          title="FlowAi (Ctrl+J)"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[#111827] hover:bg-[#1F2937] text-white shadow-xl shadow-black/15 border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        >
          <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:text-blue-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <span className="text-[12.5px] font-semibold tracking-tight">FlowAi</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-300">⌘J</span>
        </button>
      </div>
    </TaskProvider>
  );
}
