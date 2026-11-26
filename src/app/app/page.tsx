'use client';

import { sharedFetchJson } from '@/lib/sharedFetch';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import PersonalPlanBanner from '@/components/workspace/PersonalPlanBanner';
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
import BillingView from '@/views/BillingView';
import TeamView from '@/views/TeamView';
import SuperAdminView from '@/views/SuperAdminView';
import { TaskProvider } from '@/context/TaskContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import PWAModal from '@/components/PWAModal';
import CopilotDrawer from '@/components/copilot/CopilotDrawer';
import DraggableFlowAiButton from '@/components/copilot/DraggableFlowAiButton';
import { useLiveSyncEngine } from '@/lib/liveSync';
import dynamic from 'next/dynamic';

// Software Company suite screens — loaded only when opened (other companies never download them)
const suiteLoading = () => <div className="flex-1 p-6"><div className="h-6 w-40 rounded bg-neutral-100" /></div>;
const EngineeringHub = dynamic(() => import('@/views/suite/EngineeringHub'), { loading: suiteLoading });
const SalesHub = dynamic(() => import('@/views/suite/SalesHub'), { loading: suiteLoading });
const MarketingHub = dynamic(() => import('@/views/suite/MarketingHub'), { loading: suiteLoading });
const CustomersHub = dynamic(() => import('@/views/suite/CustomersHub'), { loading: suiteLoading });
const InsightsHub = dynamic(() => import('@/views/suite/InsightsHub'), { loading: suiteLoading });

type View =
  | 'dashboard'
  | 'tasks'
  | 'kanban'
  | 'projects'
  | 'project-detail'
  | 'team'
  | 'calendar'
  | 'timeline'
  | 'reports'
  | 'billing'
  | 'settings'
  | 'inbox'
  | 'super-admin'
  | 'engineering'
  | 'sales'
  | 'marketing'
  | 'customers'
  | 'insights';

const SUITE_VIEWS = ['engineering', 'sales', 'marketing', 'customers', 'insights'];

function AppContent() {
  // Live updates: comments, tasks, notifications and team changes appear without Refresh
  useLiveSyncEngine();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<View>('dashboard');
  // Tablets (768–1023px) start with the icon-only sidebar so pages keep their width; laptops get the full one
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  // Synchronize selected task with browser URL query parameter without triggering page reload
  const handleSelectTask = useCallback((id: string | null) => {
    setSelectedTask(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (id) {
        url.searchParams.set('task', id);
      } else {
        url.searchParams.delete('task');
        url.searchParams.delete('taskId');
      }
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  }, []);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetailTab, setProjectDetailTab] = useState<'overview' | 'tasks' | 'about' | 'milestones' | 'members' | 'messages' | 'settings'>('overview');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskDate, setCreateTaskDate] = useState<string | undefined>(undefined);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isPWAModalOpen, setIsPWAModalOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  // Deep linking to a project, task, or specific view (e.g. billing)
  useEffect(() => {
    if (searchParams) {
      const targetPid = searchParams.get('projectId');
      const targetTaskId = searchParams.get('task') || searchParams.get('taskId');
      const targetView = searchParams.get('view') as View;

      if (targetPid) {
        setSelectedProjectId(targetPid);
        setView('project-detail');
      }
      if (targetTaskId) {
        setSelectedTask(targetTaskId);
      }
      if (targetView && ['dashboard', 'tasks', 'kanban', 'projects', 'project-detail', 'team', 'calendar', 'timeline', 'reports', 'billing', 'settings', 'inbox', 'super-admin', ...SUITE_VIEWS].includes(targetView)) {
        setView(targetView);
      }
    }
  }, [searchParams]);

  // Authoritative Payment & Company Setup Gates:
  // If registered user signs in without payment, ALWAYS redirect to Payment page (/onboarding/plans).
  // If payment is successful but company is not created, redirect to Company Creation (/onboarding/organization).
  // User cannot access Dashboard (/app) until payment is complete AND company is created.
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      window.location.replace('/auth/login');
      return;
    }

    let isMounted = true;
    async function verifyWorkspaceAccess() {
      try {
        // Shared with the Dashboard's billing request (one network call per load)
        const res = await sharedFetchJson<{ data?: { hasPaid?: boolean; hasCompletedOnboarding?: boolean; teamId?: string } }>('/api/billing');
        if (res.status === 401) {
          window.location.replace('/auth/login');
          return;
        }
        if (res.ok) {
          const json = res.json;
          const { hasPaid, hasAccess, isProjectMember, hasCompletedOnboarding, teamId } = (json?.data || {}) as {
            hasPaid?: boolean; hasAccess?: boolean; isProjectMember?: boolean; hasCompletedOnboarding?: boolean; teamId?: string;
          };

          // Requirement 1: no access (not paid, not covered by a paid company, not invited to a project) → plans
          if (!(hasAccess ?? hasPaid)) {
            router.replace('/onboarding/plans');
            return;
          }

          // Requirement 2: no company yet → company setup (people invited to a project skip this)
          if (!isProjectMember && (!hasCompletedOnboarding || !teamId)) {
            router.replace('/onboarding/organization');
            return;
          }

          if (isMounted) {
            setIsVerifying(false);
          }
          return;
        }
      } catch (err) {
        console.warn('Workspace verification network error:', err);
      }

      // Fallback check from session token if billing endpoint had a temporary glitch
      const user = session?.user as any;
      if (!session || !user) {
        window.location.replace('/auth/login');
        return;
      }
      if (!user?.hasPaid) {
        router.replace('/onboarding/plans');
        return;
      }
      if (!user?.hasCompletedOnboarding || !user?.teamId) {
        router.replace('/onboarding/organization');
        return;
      }

      if (isMounted) {
        setIsVerifying(false);
      }
    }

    verifyWorkspaceAccess();
    return () => {
      isMounted = false;
    };
  }, [status, session, router]);

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

  if (status === 'loading' || status === 'unauthenticated' || isVerifying) {
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
            {status === 'unauthenticated'
              ? 'Redirecting to login...'
              : isVerifying
              ? 'Verifying workspace access...'
              : 'Loading FlowSync...'}
          </div>
        </div>
      </div>
    );
  }

  const handleOpenProject = (
    projectId: string,
    tab: 'overview' | 'tasks' | 'about' | 'milestones' | 'members' | 'messages' | 'settings' = 'overview'
  ) => {
    setSelectedProjectId(projectId);
    setProjectDetailTab(tab);
    setView('project-detail');
  };

  const navigateTo = (v: View) => {
    if (v !== 'project-detail') {
      setSelectedProjectId(null);
      setProjectDetailTab('overview');
    }
    setView(v);
  };

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard onTaskClick={handleSelectTask} onViewChange={v => setView(v)} />;
      case 'tasks':
        return <MyTasks onTaskClick={handleSelectTask} onCreateTask={() => setShowCreateTask(true)} />;
      case 'kanban':
        return <KanbanBoard onTaskClick={handleSelectTask} onCreateTask={() => setShowCreateTask(true)} />;
      case 'projects':
        return (
          <Projects
            onViewChange={v => setView(v)}
            onSelectProject={id => handleOpenProject(id, 'overview')}
          />
        );
      case 'project-detail':
        return selectedProjectId ? (
          <ProjectDetail
            projectId={selectedProjectId}
            initialTab={projectDetailTab}
            onBack={() => {
              setSelectedProjectId(null);
              setProjectDetailTab('overview');
              setView('projects');
            }}
            onTaskClick={handleSelectTask}
            onCreateTask={() => setShowCreateTask(true)}
          />
        ) : (
          <Projects
            onViewChange={v => setView(v)}
            onSelectProject={id => handleOpenProject(id, 'overview')}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            onTaskClick={handleSelectTask}
            onCreateTask={(date) => {
              setCreateTaskDate(date);
              setShowCreateTask(true);
            }}
          />
        );
      case 'timeline':
        return (
          <TimelineView
            onTaskClick={handleSelectTask}
            onCreateTask={(date) => {
              setCreateTaskDate(date);
              setShowCreateTask(true);
            }}
          />
        );
      case 'inbox':
        return (
          <Inbox
            onTaskClick={handleSelectTask}
            onProjectClick={handleOpenProject}
            onNavigate={navigateTo}
          />
        );
      case 'reports':
        return <Reports />;
      case 'billing':
        return <BillingView />;
      case 'team':
        return <TeamView />;
      case 'settings':
        return <Settings />;
      case 'super-admin':
        return <SuperAdminView />;
      case 'engineering':
        return <EngineeringHub onTaskClick={handleSelectTask} onOpenProject={id => handleOpenProject(id, 'overview')} />;
      case 'sales':
        return <SalesHub onOpenProject={id => handleOpenProject(id, 'overview')} />;
      case 'marketing':
        return <MarketingHub />;
      case 'customers':
        return <CustomersHub onTaskClick={handleSelectTask} />;
      case 'insights':
        return <InsightsHub />;
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
            onTaskClick={handleSelectTask}
            onProjectClick={handleOpenProject}
          />
          {/* Main content area — on mobile, reserve space for the bottom nav (56px) */}
          {/* Personal workspace: trial / free-use status and the way to create a team */}
          <PersonalPlanBanner />
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
            onClose={() => handleSelectTask(null)}
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
            handleSelectTask(id);
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
          onSelectTask={id => handleSelectTask(id)}
        />

        {/* Floating Draggable FlowAi Trigger Button */}
        <DraggableFlowAiButton onClick={() => setIsCopilotOpen(true)} />

      </div>
    </TaskProvider>
  );
}

export default function AppPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-[#FAFAFA]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
            <span className="text-xs font-medium text-gray-500">Loading FlowSync...</span>
          </div>
        </div>
      }
    >
      <AppContent />
    </Suspense>
  );
}
