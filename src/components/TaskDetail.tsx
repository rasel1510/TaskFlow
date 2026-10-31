import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTasks, type DBTask } from '@/context/TaskContext';
import { useToast } from '@/components/ui/Toast';
import EditTaskModal from './EditTaskModal';
import { statusColors, priorityColors, getProjectName, type Status, type Priority } from '../data/mockData';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Copy,
  CopyCheck,
  FileText,
  Share2,
  Trash2,
} from 'lucide-react';

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
}

interface DBComment {
  id: string;
  text: string;
  reactions: string[];
  createdAt: string;
  timeAgo: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    role?: string;
  };
}

interface DBActivity {
  id: string;
  text: string;
  icon: string;
  createdAt: string;
  timeAgo: string;
}

function getAvatarColor(name: string): string {
  const colors = ['#2563EB', '#7C3AED', '#0891B2', '#16A34A', '#D97706', '#DC2626'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatActivityText(text: string) {
  if (text.includes('"')) {
    const parts = text.split(/(".*?")/g);
    return (
      <span>
        {parts.map((part, idx) =>
          part.startsWith('"') && part.endsWith('"') ? (
            <span key={idx} className="font-medium text-[#111111]">
              {part}
            </span>
          ) : (
            <span key={idx}>{part}</span>
          )
        )}
      </span>
    );
  }

  const statusMatch = text.match(/^Status changed from (.+?) to (.+)$/);
  if (statusMatch) {
    return (
      <span>
        Status changed from <span className="font-medium text-[#111111]">{statusMatch[1]}</span> to{' '}
        <span className="font-medium text-[#111111]">{statusMatch[2]}</span>
      </span>
    );
  }

  const priorityMatch = text.match(/^Priority changed to (.+)$/);
  if (priorityMatch) {
    return (
      <span>
        Priority changed to{' '}
        <span className="font-medium text-[#111111] capitalize">{priorityMatch[1]}</span>
      </span>
    );
  }

  const assignMatch = text.match(/^Assigned to (.+)$/);
  if (assignMatch) {
    return (
      <span>
        Assigned to <span className="font-medium text-[#111111]">{assignMatch[1]}</span>
      </span>
    );
  }

  const dueMatch = text.match(/^Due date set to (.+)$/);
  if (dueMatch) {
    return (
      <span>
        Due date set to <span className="font-medium text-[#111111]">{dueMatch[1]}</span>
      </span>
    );
  }

  return <span>{text}</span>;
}


export default function TaskDetail({ taskId, onClose }: TaskDetailProps) {
  const { data: session } = useSession();
  const toast = useToast();
  const { tasks: ctxTasks, createTask, deleteTask } = useTasks();
  const [editing, setEditing] = useState(false);
  const task = ctxTasks.find(t => t.id === taskId);
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleCopyLink = () => {
    if (!task) return;
    const url = `${window.location.origin}/?task=${task.id}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Task link copied to clipboard'),
      () => toast.error('Failed to copy link')
    );
  };

  const handleCopyId = () => {
    if (!task) return;
    const idText = task.taskNumber ?? task.id;
    navigator.clipboard.writeText(idText).then(
      () => toast.success(`Copied ${idText} to clipboard`),
      () => toast.error('Failed to copy ID')
    );
  };

  const handleDuplicateTask = async () => {
    if (!task || isDuplicating) return;
    setIsDuplicating(true);
    try {
      await createTask({
        title: `${task.title} (Copy)`,
        description: task.description || undefined,
        status: task.status,
        priority: task.priority,
        projectId: task.projectId || undefined,
        assigneeId: (task as { assigneeId?: string; assignee?: { id: string } }).assigneeId || (task as { assigneeId?: string; assignee?: { id: string } }).assignee?.id || undefined,
        estimate: task.estimate || undefined,
        labels: task.labels || [],
      });
      toast.success('Task duplicated successfully');
    } catch (err) {
      console.error('[TaskDetail] Failed to duplicate task:', err);
      toast.error('Failed to duplicate task');
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleShare = async () => {
    if (!task) return;
    const url = `${window.location.origin}/?task=${task.id}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: task.title,
          text: `Task: ${task.title}`,
          url,
        });
        return;
      } catch {
        // Fallback to copy link if user dismisses or share is not supported
      }
    }
    handleCopyLink();
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    const targetId = task.id;

    // Instant optimistic drawer & modal dismissal
    setShowDeleteConfirm(false);
    onClose();

    // Trigger TaskContext optimistic deletion & rollback handling
    deleteTask(targetId).catch(err => {
      console.error('[TaskDetail] Failed to delete task in background:', err);
    });
  };

  const [comments, setComments] = useState<DBComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [activities, setActivities] = useState<DBActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);



  const loadComments = useCallback(async (signal?: AbortSignal) => {
    if (!taskId) return;
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, { signal });
      const envelope = await res.json();
      const list: DBComment[] = Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
      setComments(list);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[TaskDetail] Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  }, [taskId]);

  const loadActivities = useCallback(async (signal?: AbortSignal) => {
    if (!taskId) return;
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/activities`, { signal });
      const envelope = await res.json();
      const list: DBActivity[] = Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
      setActivities(list);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[TaskDetail] Failed to load activities:', err);
    } finally {
      setLoadingActivities(false);
    }
  }, [taskId]);

  useEffect(() => {
    const controller = new AbortController();
    loadActivities(controller.signal);
    return () => {
      controller.abort();
    };
  }, [taskId, loadActivities]);

  useEffect(() => {
    const controller = new AbortController();
    if (activeTab === 'comments') loadComments(controller.signal);
    if (activeTab === 'activity') loadActivities(controller.signal);
    return () => {
      controller.abort();
    };
  }, [activeTab, loadComments, loadActivities]);



  const handleAddComment = async () => {
    if (!commentText.trim() || !taskId) return;
    const textToSend = commentText.trim();
    const tempId = `temp_comment_${Date.now()}`;

    // Instant optimistic comment UI
    const optimisticComment: DBComment = {
      id: tempId,
      text: textToSend,
      reactions: [],
      createdAt: new Date().toISOString(),
      timeAgo: 'Just now',
      user: {
        id: (session?.user as { id?: string })?.id || 'me',
        name: session?.user?.name || 'Member',
        email: session?.user?.email || '',
        avatar: (session?.user as { avatar?: string })?.avatar || session?.user?.name?.slice(0, 2).toUpperCase() || 'ME',
      },
    };

    setComments(prev => [...prev, optimisticComment]);
    setCommentText('');
    toast.success('Comment added');

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend }),
      });
      const envelope = await res.json();
      if (!res.ok) {
        throw new Error(envelope?.error?.message || 'Failed to post comment');
      }
      const newComment = envelope.data ?? envelope;
      setComments(prev => prev.map(c => c.id === tempId ? newComment : c));
    } catch (err) {
      // Rollback on network failure
      setComments(prev => prev.filter(c => c.id !== tempId));
      setCommentText(textToSend);
      toast.error(err instanceof Error ? err.message : 'Failed to post comment');
    }
  };

  if (!task) return null;

  const statusKey = (task.status in statusColors ? task.status : 'todo') as Status;
  const priorityKey = (task.priority in priorityColors ? task.priority : 'medium') as Priority;
  const s = statusColors[statusKey];
  const p = priorityColors[priorityKey];


  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[520px] max-w-full bg-white sm:border-l border-[#E5E7EB] z-50 flex flex-col shadow-2xl pt-safe pb-safe">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.text }}>{s.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] rounded-md transition-colors mr-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>Edit</span>
            </button>
            {/* 3-Dot More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.45)] hover:text-[#111111] transition-colors cursor-pointer"
                  title="More actions"
                  aria-label="More actions"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 p-1.5 shadow-lg border border-[#E5E7EB]">
                <DropdownMenuItem
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-[12.5px] text-[rgba(17,17,17,0.8)] hover:text-[#111111]"
                >
                  <Copy size={13} className="text-[rgba(17,17,17,0.5)] shrink-0" />
                  <span>Copy task link</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopyId}
                  className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-[12.5px] text-[rgba(17,17,17,0.8)] hover:text-[#111111]"
                >
                  <FileText size={13} className="text-[rgba(17,17,17,0.5)] shrink-0" />
                  <span>Copy identifier</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleDuplicateTask}
                  disabled={isDuplicating}
                  className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-[12.5px] text-[rgba(17,17,17,0.8)] hover:text-[#111111]"
                >
                  <CopyCheck size={13} className="text-[rgba(17,17,17,0.5)] shrink-0" />
                  <span>{isDuplicating ? 'Duplicating...' : 'Duplicate task'}</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleShare}
                  className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-[12.5px] text-[rgba(17,17,17,0.8)] hover:text-[#111111]"
                >
                  <Share2 size={13} className="text-[rgba(17,17,17,0.5)] shrink-0" />
                  <span>Share task</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-[#F1F3F5]" />

                <DropdownMenuItem
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-[12.5px] text-red-600 focus:text-red-600 focus:bg-red-50 hover:bg-red-50"
                >
                  <Trash2 size={13} className="text-red-500 shrink-0" />
                  <span>Delete task</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.4)] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-5">
            {/* Title */}
            <h2 className="text-[18px] font-semibold text-[#111111] leading-snug mb-4">{task.title}</h2>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5">
              {[
                {
                  label: 'Status',
                  content: <span className="text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.text }}>{s.label}</span>,
                },
                {
                  label: 'Priority',
                  content: (
                    <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: p.color }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </span>
                  ),
                },
                {
                  label: 'Assignee',
                  content: task.assignee ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center text-[8px] font-bold text-white">{task.assignee.avatar}</span>
                      <span className="text-[12.5px] text-[#111111]">{task.assignee.name}</span>
                    </span>
                  ) : (
                    <span className="text-[12px] text-[rgba(17,17,17,0.35)]">Unassigned</span>
                  ),
                },
                {
                  label: 'Project',
                  content: <span className="text-[12.5px] text-[#111111]">{getProjectName(task.projectId)}</span>,
                },
                {
                  label: 'Due Date',
                  content: <span className="text-[12.5px] text-[#111111]">{task.dueDate ? String(task.dueDate).split('T')[0] : '—'}</span>,
                },
                {
                  label: 'Estimate',
                  content: <span className="text-[12.5px] text-[#111111]">{task.estimate}</span>,
                },
              ].map(({ label, content }) => (
                <div key={label}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.35)] mb-1">{label}</div>
                  {content}
                </div>
              ))}
            </div>

            {/* Labels */}
            {task.labels.length > 0 && (
              <div className="mb-5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.35)] mb-2">Labels</div>
                <div className="flex flex-wrap gap-1.5">
                  {task.labels.map(label => (
                    <span key={label} className="text-[11px] px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[rgba(17,17,17,0.6)] font-medium">{label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {task.description && (
              <div className="mb-5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.35)] mb-2">Description</div>
                <p className="text-[13.5px] text-[rgba(17,17,17,0.75)] leading-relaxed">{task.description}</p>
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-[#E5E7EB] mb-4">
              <div className="flex gap-1">
                {(['comments', 'activity'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-[13px] font-medium capitalize border-b-2 transition-colors ${activeTab === tab
                        ? 'border-[#2563EB] text-[#2563EB]'
                        : 'border-transparent text-[rgba(17,17,17,0.5)] hover:text-[#111111]'
                      }`}
                  >
                    {tab} {tab === 'comments' && `(${comments.length || task.commentsCount || 0})`}
                    {tab === 'activity' && activities.length > 0 && `(${activities.length})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            {activeTab === 'comments' && (
              <div className="space-y-4">
                {loadingComments ? (
                  <div className="space-y-3 py-2">
                    {[1, 2].map(i => (
                      <div key={i} className="flex gap-3 animate-pulse">
                        <div className="w-7 h-7 rounded-full bg-[#E5E7EB] shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="w-24 h-3 bg-[#E5E7EB] rounded" />
                          <div className="w-full h-3 bg-[#F3F4F6] rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[13px] text-[rgba(17,17,17,0.4)]">No comments yet.</p>
                    <p className="text-[12px] text-[rgba(17,17,17,0.3)] mt-0.5">Start the conversation below.</p>
                  </div>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: getAvatarColor(c.user?.name || '') }}
                      >
                        {c.user?.avatar || (c.user?.name ? c.user.name.slice(0, 2).toUpperCase() : 'U')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-[13px] font-semibold text-[#111111] truncate">{c.user?.name || 'User'}</span>
                          <span className="text-[11px] text-[rgba(17,17,17,0.4)] shrink-0">{c.timeAgo}</span>
                        </div>
                        <p className="text-[13px] text-[rgba(17,17,17,0.8)] leading-relaxed whitespace-pre-wrap break-words">{c.text}</p>
                        {c.reactions && c.reactions.length > 0 && (
                          <div className="flex gap-1.5 mt-2">
                            {c.reactions.map(r => (
                              <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] cursor-pointer hover:bg-[#E5E7EB] transition-colors">{r}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-1">
                {loadingActivities && activities.length === 0 ? (
                  <div className="divide-y divide-[#F1F3F5] py-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex items-center justify-between py-2.5 px-2 animate-pulse">
                        <div className={`h-3 bg-[#F3F4F6] rounded ${i % 2 === 0 ? 'w-3/5' : 'w-4/5'}`} />
                        <div className="w-12 h-2.5 bg-[#F3F4F6] rounded shrink-0 ml-4" />
                      </div>
                    ))}
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <p className="text-[13px] font-medium text-[rgba(17,17,17,0.6)]">No activity recorded</p>
                    <p className="text-[11.5px] text-[rgba(17,17,17,0.38)] mt-1">Actions on this task will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F1F3F5]">
                    {activities.map((a, i) => (
                      <div
                        key={a.id || i}
                        className="flex items-baseline justify-between gap-4 py-2.5 px-2 -mx-2 rounded hover:bg-[#F9FAFB] transition-colors duration-150"
                      >
                        <div className="min-w-0 flex-1 text-[12.5px] text-[rgba(17,17,17,0.72)] leading-relaxed">
                          {formatActivityText(a.text)}
                        </div>
                        <span
                          className="shrink-0 text-[11px] text-[rgba(17,17,17,0.38)] tabular-nums whitespace-nowrap pl-2"
                          title={a.createdAt ? new Date(a.createdAt).toLocaleString() : undefined}
                        >
                          {a.timeAgo}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            </div>
        </div>

        {/* Comment input — always visible when on comments tab */}
        {activeTab === 'comments' && (
          <div className="border-t border-[#E5E7EB] p-4 shrink-0">
            <div className="flex gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: getAvatarColor(session?.user?.name || 'Me') }}
              >
                {session?.user?.name
                  ? session.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  : 'ME'}
              </div>
              <div className="flex-1 border border-[#E5E7EB] rounded-xl overflow-hidden focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#DBEAFE] transition-all">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  placeholder="Add a comment... (Ctrl+Enter to post)"
                  rows={2}
                  className="w-full px-3 pt-2.5 pb-1 text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none resize-none"
                />
                <div className="flex items-center gap-1 px-2 pb-1.5">
                  <span className="text-[10.5px] text-[rgba(17,17,17,0.35)] px-1">Press Ctrl+Enter</span>
                  <button
                    disabled={!commentText.trim() || submittingComment}
                    className="ml-auto px-3 py-1 text-[12px] font-semibold bg-[#2563EB] text-white rounded-lg disabled:opacity-40 hover:bg-[#1D4ED8] disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    onClick={handleAddComment}
                  >
                    {submittingComment ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {editing && task && (
        <EditTaskModal
          task={task as unknown as DBTask}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[420px] p-6">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-[#111111]">Delete Task</DialogTitle>
            <DialogDescription className="text-[13px] text-[rgba(17,17,17,0.6)] leading-relaxed mt-1.5">
              Are you sure you want to delete <span className="font-semibold text-[#111111]">{task?.title}</span>? This action cannot be undone and will delete all comments.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              className="px-3 py-1.5 text-[12.5px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteTask}
              disabled={isDeleting}
              className="px-3.5 py-1.5 text-[12.5px] font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              {isDeleting ? 'Deleting...' : 'Delete Task'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
