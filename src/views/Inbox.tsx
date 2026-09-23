'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  taskId?: string | null;
  read: boolean;
  createdAt: string;
  timeAgo: string;
}

interface InboxProps {
  onTaskClick: (taskId: string) => void;
}

export default function Inbox({ onTaskClick }: InboxProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'unread' | 'assigned' | 'comments'>('all');
  const toast = useToast();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setNotifications(json.data);
      }
    } catch (err) {
      console.error('[Inbox] Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string, read = true) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read } : n))
    );

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, read }),
      });
    } catch (err) {
      console.error('[Inbox] Error marking notification as read:', err);
      // Rollback on error
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('All notifications marked as read');
      }
    } catch (err) {
      console.error('[Inbox] Error marking all as read:', err);
      toast.error('Failed to update notifications');
      fetchNotifications();
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.read) {
      markAsRead(item.id, true);
    }
    if (item.taskId) {
      onTaskClick(item.taskId);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(item => {
    if (tab === 'unread') return !item.read;
    if (tab === 'assigned') return item.type === 'task_assigned';
    if (tab === 'comments') return item.type === 'comment_mention';
    return true;
  });

  const getIconForType = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return (
          <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <polyline points="17 11 19 13 23 9" />
            </svg>
          </div>
        );
      case 'comment_mention':
        return (
          <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        );
      case 'task_overdue':
        return (
          <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-bold text-[#111111] tracking-tight">Inbox</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[12px] font-semibold bg-[#2563EB] text-white">
              {unreadCount} unread
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:text-[#111111] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Mark all read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-[#F3F4F6] bg-[#FAFAFB] shrink-0 text-[13px]">
        <button
          onClick={() => setTab('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            tab === 'all' ? 'bg-white shadow-2xs text-[#111111]' : 'text-[rgba(17,17,17,0.5)] hover:text-[#111111]'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setTab('unread')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            tab === 'unread' ? 'bg-white shadow-2xs text-[#111111]' : 'text-[rgba(17,17,17,0.5)] hover:text-[#111111]'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setTab('assigned')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            tab === 'assigned' ? 'bg-white shadow-2xs text-[#111111]' : 'text-[rgba(17,17,17,0.5)] hover:text-[#111111]'
          }`}
        >
          Assignments
        </button>
        <button
          onClick={() => setTab('comments')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            tab === 'comments' ? 'bg-white shadow-2xs text-[#111111]' : 'text-[rgba(17,17,17,0.5)] hover:text-[#111111]'
          }`}
        >
          Comments
        </button>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#F3F4F6]">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-[#E5E7EB] bg-white animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-[#E5E7EB] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-48 h-4 bg-[#E5E7EB] rounded" />
                  <div className="w-full h-3 bg-[#F3F4F6] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex-1 h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.75">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <h3 className="text-[15px] font-semibold text-[#111111] mb-1">
              {tab === 'unread' ? 'All caught up!' : 'No notifications'}
            </h3>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] max-w-xs">
              {tab === 'unread'
                ? "You don't have any unread notifications at this time."
                : "When you receive task assignments or mentions, they will appear here."}
            </p>
          </div>
        ) : (
          filteredNotifications.map(item => (
            <div
              key={item.id}
              onClick={() => handleNotificationClick(item)}
              className={`flex items-start gap-4 px-6 py-4 transition-colors cursor-pointer group ${
                !item.read ? 'bg-[#FAFCFF] hover:bg-[#F4F8FF]' : 'bg-white hover:bg-[#F9FAFB]'
              }`}
            >
              {/* Type Icon */}
              {getIconForType(item.type)}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />
                  )}
                  <h4 className="text-[13.5px] font-semibold text-[#111111] truncate">
                    {item.title}
                  </h4>
                  <span className="text-[12px] text-[rgba(17,17,17,0.4)] shrink-0 ml-auto">
                    {item.timeAgo}
                  </span>
                </div>
                <p className="text-[13px] text-[rgba(17,17,17,0.7)] leading-relaxed">
                  {item.body}
                </p>
              </div>

              {/* Action: Toggle Read */}
              <div className="shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    markAsRead(item.id, !item.read);
                  }}
                  className="p-1.5 rounded-md hover:bg-[#E5E7EB] text-[rgba(17,17,17,0.5)] hover:text-[#111111] transition-colors"
                  title={item.read ? 'Mark as unread' : 'Mark as read'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
