import { useState } from 'react';
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
}

export default function Header({ currentView, onMenuToggle }: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const unread = notifications.filter(n => !n.read).length;
  const crumbs = breadcrumbs[currentView];

  const { data: session } = useSession();
  const userName = session?.user?.name || currentUser.name;
  const userEmail = session?.user?.email || currentUser.email;
  const userRole = (session?.user as { role?: string })?.role || currentUser.role;
  const userAvatar =
    (session?.user as { avatar?: string })?.avatar ||
    (session?.user?.name ? session.user.name.slice(0, 2).toUpperCase() : currentUser.avatar);

  return (
    <header className="flex items-center gap-2 md:gap-4 px-4 md:px-6 bg-white border-b border-[#E5E7EB] shrink-0" style={{ height: 57 }}>

      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.6)] transition-colors shrink-0"
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

      {/* Search — desktop only */}
      <div className="hidden md:flex flex-1 justify-center">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            searchFocused ? 'border-[#2563EB] ring-2 ring-[#DBEAFE]' : 'border-[#E5E7EB]'
          } bg-[#F9FAFB]`}
          style={{ width: 320 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search tasks, projects, people..."
            className="flex-1 bg-transparent text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="text-[10px] text-[#9CA3AF] border border-[#E5E7EB] rounded px-1 py-0.5 font-mono">⌘K</kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
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
            className="flex items-center gap-1.5 px-1 py-0.5 rounded-lg hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            aria-label="User menu"
          >
            <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center">
              <span className="text-[11px] font-bold text-white">{userAvatar}</span>
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
                <div className="p-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      signOut({ callbackUrl: '/auth/login' });
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
