'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import TaskDetail from '@/components/TaskDetail';
import CreateTaskModal from '@/components/CreateTaskModal';
import Dashboard from '@/views/Dashboard';
import MyTasks from '@/views/MyTasks';
import KanbanBoard from '@/views/KanbanBoard';
import Projects from '@/views/Projects';
import Reports from '@/views/Reports';
import Settings from '@/views/Settings';
import { TaskProvider } from '@/context/TaskContext';

type View = 'dashboard' | 'tasks' | 'kanban' | 'projects' | 'calendar' | 'timeline' | 'reports' | 'settings' | 'inbox';

function CalendarPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center bg-white p-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <h3 className="text-[16px] font-semibold text-[#111111] mb-1">Calendar View</h3>
        <p className="text-[13px] text-[rgba(17,17,17,0.45)] max-w-xs">
          Full calendar view with month, week, and day modes. Coming in this sprint.
        </p>
      </div>
    </div>
  );
}

function InboxPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center bg-white p-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h3 className="text-[16px] font-semibold text-[#111111] mb-1">Inbox</h3>
        <p className="text-[13px] text-[rgba(17,17,17,0.45)] max-w-xs">
          Your task-centric inbox — assignments, mentions, updates, and due-soon items.
        </p>
        <div className="mt-4 space-y-2 text-left w-full max-w-sm mx-auto">
          {[
            'Sarah Chen assigned you to TF-012: Accessibility audit',
            'Ahmed Malik mentioned you in TF-003 comments',
            'TF-002 is due in 24 hours',
            '3 tasks are overdue',
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border border-[#E5E7EB] rounded-xl bg-white hover:bg-[#F9FAFB] cursor-pointer transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />
              <span className="text-[12.5px] text-[rgba(17,17,17,0.75)]">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [view, setView] = useState<View>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);

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
    return () => { document.body.style.overflow = ''; };
  }, [mobileSidebarOpen]);

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
              <path d="M9 11l3 3L22 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
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

  const navigateTo = (v: View) => setView(v);

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard onTaskClick={setSelectedTask} onViewChange={v => setView(v)} />;
      case 'tasks':
        return <MyTasks onTaskClick={setSelectedTask} onCreateTask={() => setShowCreateTask(true)} />;
      case 'kanban':
        return <KanbanBoard onTaskClick={setSelectedTask} onCreateTask={() => setShowCreateTask(true)} />;
      case 'projects':
        return <Projects onViewChange={v => setView(v)} />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      case 'calendar':
      case 'timeline':
        return <CalendarPlaceholder />;
      case 'inbox':
        return <InboxPlaceholder />;
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
          currentView={view}
          onNavigate={navigateTo}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header
            currentView={view}
            onCreateTask={() => setShowCreateTask(true)}
            onMenuToggle={() => setMobileSidebarOpen(o => !o)}
          />
          <main className="flex flex-1 overflow-hidden">
            {renderView()}
          </main>
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
      </div>
    </TaskProvider>
  );
}
