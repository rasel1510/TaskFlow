import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { currentUser } from '../data/mockData';
import { useTaskContext } from '@/context/TaskContext';

type View = 'dashboard' | 'tasks' | 'kanban' | 'projects' | 'calendar' | 'timeline' | 'reports' | 'settings' | 'inbox';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onOpenPWA?: () => void;
}

interface NavItem {
  id: View;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

function ChevronRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function Icon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Icon path="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />,
  },
  {
    id: 'tasks',
    label: 'My Tasks',
    icon: <Icon path="M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
    // badge is computed dynamically from TaskContext — see effectiveBadge below
  },
  {
    id: 'inbox',
    label: 'Inbox',
    icon: <Icon path="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6" />,
    badge: 3,
  },
  {
    id: 'kanban',
    label: 'Board',
    icon: <Icon path="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: <Icon path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />,
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: <Icon path="M3 12h18M3 6h18M3 18h18" />,
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: <Icon path="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />,
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <Icon path="M18 20V10M12 20V4M6 20v-6" />,
  },
];

export default function Sidebar({ currentView, onNavigate, collapsed, onToggle, mobileOpen, onMobileClose, onOpenPWA }: SidebarProps) {
  const [unreadInboxCount, setUnreadInboxCount] = useState<number>(0);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(standalone);
    }
  }, []);

  // Live task count from context — shows only non-done tasks
  const { tasks } = useTaskContext();
  const activeTaskCount = tasks.filter(t => t.status !== 'done').length || undefined;

  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id;
  const userName = session?.user?.name || currentUser.name;
  const userRole = (session?.user as { role?: string })?.role || currentUser.role;
  const userAvatar =
    (session?.user as { avatar?: string })?.avatar ||
    (session?.user?.name ? session.user.name.slice(0, 2).toUpperCase() : currentUser.avatar);

  const [expertiseRequired, setExpertiseRequired] = useState(false);

  // Check expertise matrix status
  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    fetch(`/api/users/${userId}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        if (isMounted && json.success && json.data) {
          const exp = json.data.expertise;
          setExpertiseRequired(!Array.isArray(exp) || exp.length === 0);
        }
      })
      .catch(() => {});

    const onProfileUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && Array.isArray(customEvent.detail.expertise)) {
        setExpertiseRequired(customEvent.detail.expertise.length === 0);
      }
    };
    window.addEventListener('user-profile-updated', onProfileUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('user-profile-updated', onProfileUpdate);
    };
  }, [userId]);

  // Poll unread notifications count
  useEffect(() => {
    let isMounted = true;
    async function fetchUnreadCount() {
      try {
        const res = await fetch('/api/notifications?unreadOnly=true&countOnly=true', { cache: 'no-store' });
        const json = await res.json();
        if (isMounted && json.success && json.data) {
          setUnreadInboxCount(json.data.count ?? 0);
        }
      } catch {
        // Fallback silently if offline
      }
    }

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 25000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentView]);

  const handleNavigate = (view: View) => {
    onNavigate(view);
    onMobileClose(); // close mobile drawer on navigate
  };

  // On mobile: fixed full-height drawer, slide in/out
  // On desktop: normal sidebar with collapse behavior
  return (
    <aside
      className={[
        // Mobile: fixed overlay drawer
        'fixed inset-y-0 left-0 z-50 flex flex-col h-full border-r border-[#E5E7EB] bg-white transition-transform duration-300 md:relative md:translate-x-0 md:z-auto md:transition-all md:duration-200 shrink-0 pt-safe pb-safe shadow-2xl md:shadow-none w-[270px] max-w-[85vw] md:w-auto',
        // Mobile open/close
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
      style={{ ['--sidebar-width' as string]: collapsed ? '60px' : '240px' }}
    >
      {/* Apply collapsed width on md+ */}
      <style>{`@media (min-width: 768px) { aside { width: ${collapsed ? 60 : 240}px !important; } }`}</style>

      {/* Brand Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#E5E7EB]" style={{ height: 57 }}>
        <div className="flex items-center gap-2.5 select-none text-left min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M9 11l3 3L22 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <span className="font-bold text-[15px] text-[#111111] tracking-tight md:hidden">TaskFlow</span>
          {/* Show label on desktop only when not collapsed */}
          <span className="font-bold text-[15px] text-[#111111] tracking-tight hidden md:block" style={{ display: collapsed ? 'none' : undefined }}>
            {!collapsed && 'TaskFlow'}
          </span>
        </div>
        {/* Desktop collapse toggle */}
        <button
          onClick={onToggle}
          className="ml-auto text-[#9CA3AF] hover:text-[#111111] transition-colors hidden md:flex"
          style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
          aria-label="Toggle sidebar"
        >
          <ChevronRight size={14} />
        </button>
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="ml-auto text-[#9CA3AF] hover:text-[#111111] transition-colors md:hidden"
          aria-label="Close menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Workspace switcher — always visible on mobile, gated by collapsed on desktop */}
      <div className={`mx-3 mt-3 mb-1 ${collapsed ? 'md:hidden' : ''}`}>
        <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[#F9FAFB] transition-colors">
          <div className="w-6 h-6 rounded-md bg-[#DBEAFE] flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-[#2563EB]">FS</span>
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-[12px] font-semibold text-[#111111] truncate">FlowSync Inc.</div>
            <div className="text-[10px] text-[rgba(17,17,17,0.45)] truncate">Workspace</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navItems.map(item => {
          const active = currentView === item.id;
          const effectiveBadge =
            item.id === 'inbox' ? (unreadInboxCount > 0 ? unreadInboxCount : undefined) :
            item.id === 'tasks' ? activeTaskCount :
            item.badge;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-lg text-[13.5px] font-medium mb-0.5 transition-colors relative group ${
                active
                  ? 'bg-[#EFF6FF] text-[#2563EB]'
                  : 'text-[rgba(17,17,17,0.65)] hover:bg-[#F3F4F6] hover:text-[#111111]'
              }`}
            >
              <span className={`shrink-0 ${active ? 'text-[#2563EB]' : 'text-[rgba(17,17,17,0.5)]'}`}>
                {item.icon}
              </span>
              {/* Always show label on mobile; respect collapsed on desktop */}
              <span className={`flex-1 text-left md:${collapsed ? 'hidden' : 'block'}`}>{item.label}</span>
              {effectiveBadge && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#2563EB] text-white leading-none md:${collapsed ? 'hidden' : 'block'}`}>
                  {effectiveBadge}
                </span>
              )}
              {collapsed && effectiveBadge && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#2563EB] text-[8px] text-white flex items-center justify-center font-bold hidden md:flex">
                  {effectiveBadge}
                </span>
              )}
            </button>
          );
        })}


      </nav>

      {/* Bottom section */}
      <div className="border-t border-[#E5E7EB] px-2 py-3">
        {onOpenPWA && !isStandalone && (
          <button
            onClick={onOpenPWA}
            className="w-full flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-lg text-[13.5px] font-medium mb-1 text-[#2563EB] hover:bg-[#EFF6FF] active:bg-blue-100 transition-colors cursor-pointer group"
            title="Install TaskFlow App"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#2563EB]">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className={`flex-1 text-left md:${collapsed ? 'hidden' : 'block'}`}>Install App</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-[#2563EB] md:${collapsed ? 'hidden' : 'inline-block'}`}>
              PWA
            </span>
          </button>
        )}
        <button
          onClick={() => handleNavigate('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-lg text-[13.5px] font-medium mb-1 transition-colors ${
            currentView === 'settings'
              ? 'bg-[#EFF6FF] text-[#2563EB]'
              : 'text-[rgba(17,17,17,0.65)] hover:bg-[#F3F4F6] hover:text-[#111111]'
          }`}
        >
          <div className="relative">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            {expertiseRequired && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
            )}
          </div>
          <span className={`flex-1 text-left md:${collapsed ? 'hidden' : 'block'}`}>Settings</span>
          {expertiseRequired && (
            <span className={`text-[9.5px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-600 md:${collapsed ? 'hidden' : 'inline-block'}`}>
              Required
            </span>
          )}
        </button>

        {/* Bottom user profile & session actions */}
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[#F3F4F6] transition-colors group">
          <div className="relative shrink-0">
            <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center">
              <span className="text-[11px] font-bold text-white">{userAvatar}</span>
            </div>
            {expertiseRequired && (
              <span
                title="Action Required: Set Expertise Matrix"
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white animate-pulse"
              />
            )}
          </div>
          <div className={`flex-1 min-w-0 md:${collapsed ? 'hidden' : 'block'}`}>
            <div className="flex items-center gap-1.5">
              <span className="text-[12.5px] font-semibold text-[#111111] truncate">{userName}</span>
              {expertiseRequired && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Expertise not filled" />
              )}
            </div>
            <div className="text-[11px] text-[rgba(17,17,17,0.45)] truncate">{userRole}</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            title="Sign Out"
            className={`md:opacity-0 md:group-hover:opacity-100 p-1 rounded hover:bg-[#E5E7EB] text-gray-500 hover:text-red-600 transition-all cursor-pointer md:${collapsed ? 'hidden' : 'block'}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
