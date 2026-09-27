import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { currentUser, notifications } from '../data/mockData';

type View = 'dashboard' | 'tasks' | 'kanban' | 'projects' | 'calendar' | 'timeline' | 'reports' | 'settings' | 'inbox';

const pageTitles: Record<View, string> = {
  dashboard: 'Dashboard',
  tasks: 'My Tasks',
  kanban: 'Board',
  projects: 'Projects',
  calendar: 'Calendar',
  timeline: 'Timeline',
  reports: 'Reports',
  settings: 'Settings',
  inbox: 'Inbox',
};

const breadcrumbs: Record<View, string[]> = {
  dashboard: ['FlowSync Inc.', 'Dashboard'],
  tasks: ['FlowSync Inc.', 'My Tasks'],
  kanban: ['FlowSync Inc.', 'Board'],
  projects: ['FlowSync Inc.', 'Projects'],
  calendar: ['FlowSync Inc.', 'Calendar'],
  timeline: ['FlowSync Inc.', 'Timeline'],
  reports: ['FlowSync Inc.', 'Reports'],
  settings: ['FlowSync Inc.', 'Settings'],
  inbox: ['FlowSync Inc.', 'Inbox'],
};

interface HeaderProps {
  currentView: View;
  onCreateTask?: () => void;
  onMenuToggle: () => void;
  onOpenCommandPalette?: () => void;
  onNavigate?: (view: View) => void;
}

export default function Header({ currentView, onMenuToggle, onOpenCommandPalette, onNavigate }: HeaderProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [expertiseRequired, setExpertiseRequired] = useState(false);
  const unread = notifications.filter(n => !n.read).length;
  const crumbs = breadcrumbs[currentView];

  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id;
  const userName = session?.user?.name || currentUser.name;
  const userEmail = session?.user?.email || currentUser.email;
  const userRole = (session?.user as { role?: string })?.role || currentUser.role;
  const userAvatar =
    (session?.user as { avatar?: string })?.avatar ||
    (session?.user?.name ? session.user.name.slice(0, 2).toUpperCase() : currentUser.avatar);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    fetch(`/api/users/${userId}`)
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

  return (
    <header className="flex items-center gap-2 md:gap-4 px-3.5 sm:px-4 md:px-6 bg-white border-b border-[#E5E7EB] shrink-0 z-30 pt-safe h-[56px] md:h-[57px]">

      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] active:bg-[#E5E7EB] text-[rgba(17,17,17,0.6)] transition-colors shrink-0"
        aria-label="Open menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Page title — mobile only */}
      <span className="md:hidden text-[15px] font-bold text-[#111111] flex-1 truncate">
        {pageTitles[currentView]}
      </span>

      {/* Breadcrumb — desktop only */}
      <nav className="hidden md:flex items-center gap-1.5 text-[13px] shrink-0">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[#D1D5DB]">/</span>}
            <span className={i === crumbs.length - 1 ? 'font-semibold text-[#111111]' : 'text-[rgba(17,17,17,0.45)]'}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {/* Search — desktop only (triggers Command Palette) */}
      <div className="hidden md:flex flex-1 justify-center">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:border-[#CBD5E1] bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-all text-left group"
          style={{ width: 320 }}
          aria-label="Open command palette"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#2563EB] transition-colors">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span className="flex-1 text-[13px] text-[#9CA3AF] select-none">
            Search tasks, projects, actions...
          </span>
          <kbd className="text-[10px] text-[#9CA3AF] border border-[#E5E7EB] bg-white rounded px-1.5 py-0.5 font-mono shadow-xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {/* Mobile Search Icon */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.55)] transition-colors"
          aria-label="Search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false); }}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.45)] hover:text-[#111111] transition-colors relative"
            aria-label="Notifications"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626]" />
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)} />
              <div className="absolute right-0 top-11 w-[calc(100vw-2rem)] max-w-sm bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
                  <span className="font-semibold text-[14px]">Notifications</span>
                  <button className="text-[12px] text-[#2563EB] hover:underline">Mark all read</button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors ${!n.read ? 'bg-[#FAFBFF]' : ''}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-[#E5E7EB] flex items-center justify-center shrink-0 text-[10px] font-bold text-[#111111]">
                        {n.user.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] text-[#111111] leading-snug">
                          <span className="font-semibold">{n.user.name}</span> {n.action} <span className="font-medium">{n.target}</span>
                        </p>
                        <p className="text-[11px] text-[rgba(17,17,17,0.4)] mt-0.5">{n.time}</p>
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-[#2563EB] mt-1 shrink-0" />}
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 text-center">
                  <button className="text-[12.5px] text-[#2563EB] hover:underline font-medium">View all notifications</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Avatar & User Dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false); }}
            className="flex items-center gap-1.5 px-1 py-0.5 rounded-lg hover:bg-[#F3F4F6] transition-colors cursor-pointer relative"
            aria-label="User menu"
          >
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center">
                <span className="text-[11px] font-bold text-white">{userAvatar}</span>
              </div>
              {expertiseRequired && (
                <span
                  title="Profile Action Required: Set Expertise Matrix"
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white ring-1 ring-red-400 animate-pulse"
                />
              )}
            </div>
            <svg className="hidden md:block" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-11 w-64 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-20 overflow-hidden py-1">
                <div className="px-4 py-3 border-b border-[#E5E7EB]">
                  <p className="text-[13px] font-semibold text-[#111111] truncate">{userName}</p>
                  <p className="text-[11px] text-[rgba(17,17,17,0.5)] truncate">{userEmail}</p>
                  <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#2563EB]">
                    {userRole}
                  </span>
                </div>

                {expertiseRequired && (
                  <div className="p-2 border-b border-red-100 bg-red-50/70">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onNavigate?.('settings');
                      }}
                      className="w-full text-left p-2 rounded-lg bg-white border border-red-200 hover:border-red-300 shadow-xs hover:shadow-sm transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 text-red-600 font-semibold text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                        <span>Action Required</span>
                      </div>
                      <p className="text-[11.5px] text-[#111111] font-medium mt-1 leading-tight group-hover:text-red-700 transition-colors">
                        Set your Expertise Matrix
                      </p>
                      <p className="text-[10px] text-[rgba(17,17,17,0.5)] mt-0.5">
                        Required for skill allocation →
                      </p>
                    </button>
                  </div>
                )}

                <div className="p-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onNavigate?.('settings');
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] text-[rgba(17,17,17,0.8)] hover:bg-[#F3F4F6] transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                      <span>Settings & Profile</span>
                    </div>
                    {expertiseRequired && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      signOut({ callbackUrl: '/' });
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-red-600 hover:bg-red-50 transition-colors font-medium text-left cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
