import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { currentUser, notifications } from '../data/mockData';

interface HeaderNotificationItem {
  id: string;
  category?: 'user' | 'project' | 'admin';
  type?: string;
  title?: string;
  body?: string;
  time?: string;
  timeAgo?: string;
  read: boolean;
  actor?: { name: string; avatar: string };
  user?: { name: string; avatar: string };
  action?: string;
  target?: string;
  taskId?: string | null;
  meta?: string;
}

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
  dashboard: ['TaskFlow', 'Dashboard'],
  tasks: ['TaskFlow', 'My Tasks'],
  kanban: ['TaskFlow', 'Board'],
  projects: ['TaskFlow', 'Projects'],
  calendar: ['TaskFlow', 'Calendar'],
  timeline: ['TaskFlow', 'Timeline'],
  reports: ['TaskFlow', 'Reports'],
  settings: ['TaskFlow', 'Settings'],
  inbox: ['TaskFlow', 'Inbox'],
};

interface HeaderProps {
  currentView: View;
  onCreateTask?: () => void;
  onMenuToggle: () => void;
  onOpenCommandPalette?: () => void;
  onOpenCopilot?: () => void;
  onNavigate?: (view: View) => void;
  onOpenPWA?: () => void;
}

export default function Header({ currentView, onMenuToggle, onOpenCommandPalette, onOpenCopilot, onNavigate, onOpenPWA }: HeaderProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [expertiseRequired, setExpertiseRequired] = useState(false);
  const [notificationsList, setNotificationsList] = useState<HeaderNotificationItem[]>(() =>
    notifications.map(n => ({
      id: n.id,
      category: n.category,
      type: n.type,
      title: n.title,
      body: n.body,
      timeAgo: n.timeAgo || n.time,
      read: n.read,
      actor: n.user ? { name: n.user.name, avatar: n.user.avatar } : undefined,
      taskId: n.taskId,
      meta: n.meta,
    }))
  );
  const [notifCategory, setNotifCategory] = useState<'all' | 'user' | 'project' | 'admin'>('all');
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/notifications', { signal });
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setNotificationsList(json.data);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[Header] Failed to fetch notifications:', err);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadNotifications(controller.signal);
    return () => controller.abort();
  }, [loadNotifications]);

  useEffect(() => {
    const handleUpdate = () => {
      loadNotifications();
    };
    window.addEventListener('notifications-updated', handleUpdate);
    return () => window.removeEventListener('notifications-updated', handleUpdate);
  }, [loadNotifications]);

  const markAsRead = async (id: string, read = true) => {
    setNotificationsList(prev => prev.map(n => (n.id === id ? { ...n, read } : n)));
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, read }),
      });
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('[Header] Failed to update notification:', err);
    }
  };

  const markAllAsRead = async () => {
    setNotificationsList(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('[Header] Failed to mark all as read:', err);
    }
  };

  const unreadTotal = notificationsList.filter(n => !n.read).length;
  const unreadUser = notificationsList.filter(n => (n.category === 'user' || !n.category) && !n.read).length;
  const unreadProject = notificationsList.filter(n => n.category === 'project' && !n.read).length;
  const unreadAdmin = notificationsList.filter(n => n.category === 'admin' && !n.read).length;

  const filteredNotifications = notificationsList.filter(n => {
    if (filterUnreadOnly && n.read) return false;
    if (notifCategory === 'all') return true;
    if (notifCategory === 'user') return n.category === 'user' || !n.category;
    return n.category === notifCategory;
  });

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

        {/* AI Copilot (MCP) */}
        {onOpenCopilot && (
          <button
            type="button"
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-200/80 bg-blue-50/60 hover:bg-blue-100/70 text-[#2563EB] transition-all cursor-pointer shadow-2xs group"
            aria-label="Open AI Copilot"
            title="FlowSync Copilot (Ctrl+J)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span className="hidden sm:inline text-[12px] font-semibold tracking-tight">Copilot</span>
            <kbd className="hidden lg:inline text-[9.5px] bg-white text-[#2563EB] border border-blue-200 rounded px-1 py-0.2 font-mono">
              ⌘J
            </kbd>
          </button>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false); }}
            className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.55)] hover:text-[#111111] transition-colors relative cursor-pointer ${
              showNotifs ? 'bg-[#F3F4F6] text-[#111111]' : ''
            }`}
            aria-label="Notifications"
            title="Notifications"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadTotal > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626] ring-2 ring-white" />
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
              <div className="absolute right-0 top-11 w-[calc(100vw-2rem)] sm:w-[420px] max-w-md bg-white border border-[#E5E7EB] rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-4 py-3 border-b border-[#F1F3F5] flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[14px] text-[#111111]">Notifications</span>
                    {unreadTotal > 0 && (
                      <span className="px-1.5 py-0.5 text-[10.5px] font-semibold bg-[#2563EB] text-white rounded-full tabular-nums">
                        {unreadTotal} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadTotal > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[12px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer border ${
                        filterUnreadOnly
                          ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'
                          : 'text-[rgba(17,17,17,0.55)] border-[#E5E7EB] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      Unread
                    </button>
                  </div>
                </div>

                {/* Role Filter Tabs */}
                <div className="flex border-b border-[#F1F3F5] px-2 bg-[#FAFBFC]">
                  {[
                    { key: 'all', label: 'All', unread: unreadTotal, count: notificationsList.length },
                    { key: 'user', label: 'User', unread: unreadUser, count: notificationsList.filter(n => n.category === 'user' || !n.category).length },
                    { key: 'project', label: 'Product Mgr', unread: unreadProject, count: notificationsList.filter(n => n.category === 'project').length },
                    { key: 'admin', label: 'Admin', unread: unreadAdmin, count: notificationsList.filter(n => n.category === 'admin').length },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setNotifCategory(tab.key as any)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 transition-all cursor-pointer relative ${
                        notifCategory === tab.key
                          ? 'border-[#2563EB] text-[#2563EB]'
                          : 'border-transparent text-[rgba(17,17,17,0.55)] hover:text-[#111111]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.unread > 0 ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                      ) : (
                        <span className="text-[10px] text-[rgba(17,17,17,0.35)] tabular-nums">({tab.count})</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Notification Items List */}
                <div className="max-h-[380px] overflow-y-auto divide-y divide-[#F1F3F5]">
                  {filteredNotifications.length === 0 ? (
                    <div className="text-center py-10 px-4">
                      <p className="text-[13px] font-medium text-[rgba(17,17,17,0.6)]">No notifications</p>
                      <p className="text-[11.5px] text-[rgba(17,17,17,0.4)] mt-0.5">
                        {filterUnreadOnly ? 'No unread notifications in this category' : 'You are all caught up!'}
                      </p>
                    </div>
                  ) : (
                    filteredNotifications.map(n => {
                      const isUser = n.category === 'user' || !n.category;
                      const isPM = n.category === 'project';
                      const isAdmin = n.category === 'admin';
                      const title = n.title || (n.action && n.user ? `${n.user.name} ${n.action} ${n.target}` : 'Notification');
                      const body = n.body || n.target || '';
                      const timeStr = n.timeAgo || n.time || 'recently';

                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.read) markAsRead(n.id, true);
                          }}
                          className={`group flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                            !n.read ? 'bg-[#FAFCFF] hover:bg-[#F0F6FF]' : 'hover:bg-[#F9FAFB]'
                          }`}
                        >
                          {/* Visual Indicator */}
                          <div className="shrink-0 mt-0.5">
                            {n.actor?.avatar ? (
                              <div className="w-7 h-7 rounded-full bg-[#E5E7EB] flex items-center justify-center text-[10px] font-bold text-[#111111]">
                                {n.actor.avatar}
                              </div>
                            ) : n.user?.avatar ? (
                              <div className="w-7 h-7 rounded-full bg-[#E5E7EB] flex items-center justify-center text-[10px] font-bold text-[#111111]">
                                {n.user.avatar}
                              </div>
                            ) : (
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  isAdmin
                                    ? 'bg-[#F3E8FF] text-[#7C3AED]'
                                    : isPM
                                    ? 'bg-[#FEF3C7] text-[#D97706]'
                                    : 'bg-[#EFF6FF] text-[#2563EB]'
                                }`}
                              >
                                {isAdmin ? 'AD' : isPM ? 'PM' : 'UR'}
                              </div>
                            )}
                          </div>

                          {/* Text Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[12.5px] font-semibold text-[#111111] truncate">{title}</span>
                              <span
                                className={`text-[9.5px] font-medium px-1.5 py-0.2 rounded uppercase tracking-wider ${
                                  isAdmin
                                    ? 'bg-[#F3E8FF] text-[#7C3AED]'
                                    : isPM
                                    ? 'bg-[#FEF3C7] text-[#B45309]'
                                    : 'bg-[#EFF6FF] text-[#2563EB]'
                                }`}
                              >
                                {isAdmin ? 'Admin' : isPM ? 'Product' : 'User'}
                              </span>
                            </div>
                            <p className="text-[12px] text-[rgba(17,17,17,0.7)] leading-relaxed break-words">{body}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10.5px] text-[rgba(17,17,17,0.4)] tabular-nums">{timeStr}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(n.id, !n.read);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-[11px] text-[#2563EB] hover:underline transition-opacity cursor-pointer"
                              >
                                {n.read ? 'Mark unread' : 'Mark read'}
                              </button>
                            </div>
                          </div>

                          {/* Unread blue dot */}
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-[#2563EB] mt-1.5 shrink-0" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 bg-[#FAFBFC] border-t border-[#F1F3F5] flex items-center justify-between">
                  <span className="text-[11px] text-[rgba(17,17,17,0.4)]">
                    {unreadTotal} unread of {notificationsList.length} total
                  </span>
                  <button
                    onClick={() => {
                      setShowNotifs(false);
                      onNavigate?.('inbox');
                    }}
                    className="text-[12px] text-[#2563EB] hover:text-[#1D4ED8] font-medium transition-colors cursor-pointer"
                  >
                    View all in Inbox →
                  </button>
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

                  {onOpenPWA && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenPWA();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#2563EB] hover:bg-blue-50 transition-colors font-medium text-left cursor-pointer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>Install App (PWA)</span>
                    </button>
                  )}

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
