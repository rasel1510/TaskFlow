import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { currentUser, notifications } from '../data/mockData';

type View = 'dashboard' | 'tasks' | 'kanban' | 'projects' | 'calendar' | 'timeline' | 'reports' | 'settings' | 'inbox';

const breadcrumbs: Record<View, string[]> = {
  dashboard: ['TaskFlow Inc.', 'Dashboard'],
  tasks: ['TaskFlow Inc.', 'My Tasks'],
  kanban: ['TaskFlow Inc.', 'Board'],
  projects: ['TaskFlow Inc.', 'Projects'],
  calendar: ['TaskFlow Inc.', 'Calendar'],
  timeline: ['TaskFlow Inc.', 'Timeline'],
  reports: ['TaskFlow Inc.', 'Reports'],
  settings: ['TaskFlow Inc.', 'Settings'],
  inbox: ['TaskFlow Inc.', 'Inbox'],
};

interface HeaderProps {
  currentView: View;
  onCreateTask: () => void;
}

export default function Header({ currentView, onCreateTask }: HeaderProps) {
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
    <header className="flex items-center gap-4 px-6 bg-white border-b border-[#E5E7EB] shrink-0" style={{ height: 57 }}>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px]">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[#D1D5DB]">/</span>}
            <span className={i === crumbs.length - 1 ? 'font-semibold text-[#111111]' : 'text-[rgba(17,17,17,0.45)]'}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {/* Search */}
      <div className="flex-1 flex justify-center">
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
      <div className="flex items-center gap-2">
        <button
          onClick={onCreateTask}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Task
        </button>

        {/* Help */}
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.45)] hover:text-[#111111] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>
          </svg>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.45)] hover:text-[#111111] transition-colors relative"
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
              <div className="absolute right-0 top-10 w-80 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
                  <span className="font-semibold text-[14px]">Notifications</span>
                  <button className="text-[12px] text-[#2563EB] hover:underline">Mark all read</button>
                </div>
                <div className="max-h-80 overflow-y-auto">
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
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-1 py-0.5 rounded-lg hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center">
              <span className="text-[11px] font-bold text-white">{userAvatar}</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-10 w-64 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-20 overflow-hidden py-1">
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
