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
import Inbox from '@/views/Inbox';
import Reports from '@/views/Reports';
import Settings from '@/views/Settings';
import { TaskProvider } from '@/context/TaskContext';

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

export default function Page() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [view, setView] = useState<View>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Close mobile sidebar on route change
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

  // Global keydown listener for Command Palette (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F9FAFB]">
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
            Loading FlowSync...
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
      case 'timeline':
        return (
          <CalendarView
            onTaskClick={setSelectedTask}
            onCreateTask={() => setShowCreateTask(true)}
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
      <div className="flex h-screen overflow-hidden bg-white">
        {/* Mobile sidebar backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        <Sidebar
          currentView={view === 'project-detail' ? 'projects' : view}
          onNavigate={navigateTo}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header
            currentView={view === 'project-detail' ? 'projects' : view}
            onCreateTask={() => setShowCreateTask(true)}
            onMenuToggle={() => setMobileSidebarOpen(o => !o)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />
          <main className="flex flex-1 overflow-hidden">{renderView()}</main>
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
          <CreateTaskModal onClose={() => setShowCreateTask(false)} />
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
      </div>
    </TaskProvider>
  );
}
