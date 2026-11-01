import { useState, useEffect, useCallback, useRef } from 'react';
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
import { triggerParticleExplosion } from '@/lib/particleExplosion';
import {
  Copy,
  CopyCheck,
  FileText,
  Share2,
  Trash2,
  CornerDownRight,
  Pencil,
  AtSign,
  X,
  Send,
  Check,
  MessageSquare,
} from 'lucide-react';

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
}

interface DBComment {
  id: string;
  text: string;
  reactions: string[];
  isEdited?: boolean;
  createdAt: string;
  updatedAt?: string;
  timeAgo: string;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    text: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatar: string;
      role?: string;
    };
  } | null;
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
  const { tasks: ctxTasks, users, createTask, deleteTask, isLoading: ctxLoading } = useTasks();
  const [editing, setEditing] = useState(false);
  const ctxTask = ctxTasks.find(t => t.id === taskId);
  const [directTask, setDirectTask] = useState<DBTask | null>(null);
  const [isDirectLoading, setIsDirectLoading] = useState(false);

  const task = ctxTask || directTask;

  // Direct deep link task fetcher (if task is not yet loaded into context or accessed directly via URL)
  useEffect(() => {
    if (!taskId) return;
    if (ctxTask) {
      if (directTask) setDirectTask(null);
      return;
    }

    let isMounted = true;
    setIsDirectLoading(true);

    fetch(`/api/tasks/${taskId}`)
      .then(res => {
        if (!res.ok) throw new Error('Task not found');
        return res.json();
      })
      .then(envelope => {
        if (!isMounted) return;
        const data = envelope?.data ?? envelope;
        if (data && data.id) {
          setDirectTask(data);
        }
      })
      .catch(err => {
        console.warn('[TaskDetail] Direct fetch failed:', err);
      })
      .finally(() => {
        if (isMounted) setIsDirectLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [taskId, ctxTask, directTask]);
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [replyingTo, setReplyingTo] = useState<DBComment | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const currentUserId = (session?.user as { id?: string })?.id;
  const currentUserRole = ((session?.user as { role?: string })?.role || '').toLowerCase();
  const isElevated = currentUserRole === 'admin' || currentUserRole === 'administrator' || currentUserRole.includes('manager');

  // Resolved Task Creator
  const taskCreator =
    (task as { creator?: { id: string; name: string; avatar?: string; role?: string } | null })?.creator ||
    ((task as { creatorId?: string | null })?.creatorId
      ? users.find(u => u.id === (task as { creatorId?: string | null }).creatorId)
      : null) ||
    task?.assignee;

  // Filter users for @mentions
  const filteredMentionUsers = (users || []).filter(u => {
    if (!mentionQuery) return true;
    const q = mentionQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleCopyLink = () => {
    if (!task) return;
    const url = `${window.location.origin}/app?task=${task.id}`;
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
    const url = `${window.location.origin}/app?task=${task.id}`;
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



  const handleCommentTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);

    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@([a-zA-Z0-9_]*)$/);

    if (atMatch && atMatch[1].length <= 25) {
      setMentionQuery(atMatch[1]);
      setShowMentionMenu(true);
    } else {
      setShowMentionMenu(false);
      setMentionQuery(null);
    }
  };

  const handleSelectMention = (userToMention: { name: string }) => {
    if (!commentTextareaRef.current) return;
    const textarea = commentTextareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBefore = commentText.slice(0, cursorPos);
    const textAfter = commentText.slice(cursorPos);

    const atIndex = textBefore.lastIndexOf('@');
    if (atIndex !== -1) {
      const newText = textBefore.slice(0, atIndex) + `@${userToMention.name} ` + textAfter;
      setCommentText(newText);
      setShowMentionMenu(false);
      setMentionQuery(null);
      setTimeout(() => {
        textarea.focus();
        const newCursor = atIndex + userToMention.name.length + 2;
        textarea.setSelectionRange(newCursor, newCursor);
      }, 0);
    }
  };

  const handleMentionUser = (userToMention: { name: string }) => {
    setCommentText(prev => {
      const tag = `@${userToMention.name} `;
      if (prev.includes(tag)) return prev;
      return prev ? `${prev.trim()} ${tag}` : tag;
    });
    commentTextareaRef.current?.focus();
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !taskId || submittingComment) return;
    const textToSend = commentText.trim();
    const replyTarget = replyingTo;
    const tempId = `temp_comment_${Date.now()}`;
    setSubmittingComment(true);

    // Instant optimistic comment UI
    const optimisticComment: DBComment = {
      id: tempId,
      text: textToSend,
      reactions: [],
      isEdited: false,
      createdAt: new Date().toISOString(),
      timeAgo: 'Just now',
      replyToId: replyTarget?.id || null,
      replyTo: replyTarget
        ? {
            id: replyTarget.id,
            text: replyTarget.text,
            user: { ...replyTarget.user },
          }
        : null,
      user: {
        id: currentUserId || 'me',
        name: session?.user?.name || 'Member',
        email: session?.user?.email || '',
        avatar: (session?.user as { avatar?: string })?.avatar || session?.user?.name?.slice(0, 2).toUpperCase() || 'ME',
        role: currentUserRole,
      },
    };

    setComments(prev => [...prev, optimisticComment]);
    setCommentText('');
    setReplyingTo(null);
    setShowMentionMenu(false);
    toast.success('Comment added');

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSend,
          replyToId: replyTarget?.id || undefined,
        }),
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
      setReplyingTo(replyTarget);
      toast.error(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStartEditComment = (c: DBComment) => {
    setEditingCommentId(c.id);
    setEditingCommentText(c.text);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!editingCommentText.trim() || !taskId || submittingEdit) return;
    const newText = editingCommentText.trim();
    const oldComments = [...comments];
    setSubmittingEdit(true);

    // Optimistic update
    setComments(prev =>
      prev.map(c => (c.id === commentId ? { ...c, text: newText, isEdited: true } : c))
    );
    setEditingCommentId(null);
    setEditingCommentText('');
    toast.success('Comment updated');

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, text: newText }),
      });
      const envelope = await res.json();
      if (!res.ok) {
        throw new Error(envelope?.error?.message || 'Failed to update comment');
      }
      const updated = envelope.data ?? envelope;
      setComments(prev => prev.map(c => (c.id === commentId ? { ...c, ...updated } : c)));
    } catch (err) {
      setComments(oldComments);
      toast.error(err instanceof Error ? err.message : 'Failed to update comment');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!taskId || deletingCommentId) return;
    const oldComments = [...comments];
    setDeletingCommentId(commentId);

    // Optimistic deletion
    setComments(prev => prev.filter(c => c.id !== commentId));
    toast.success('Comment deleted');

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
      });
      if (!res.ok) {
        const envelope = await res.json();
        throw new Error(envelope?.error?.message || 'Failed to delete comment');
      }
    } catch (err) {
      setComments(oldComments);
      toast.error(err instanceof Error ? err.message : 'Failed to delete comment');
    } finally {
      setDeletingCommentId(null);
    }
  };

  function renderCommentBody(text: string) {
    const parts = text.split(/(@[a-zA-Z0-9_s.-]+?)(?=s|$|[,.!?])/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const name = part.slice(1);
        return (
          <span
            key={index}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#EFF6FF] text-[#2563EB] font-medium text-[12px] border border-[#BFDBFE] mx-0.5"
          >
            <AtSign size={10} className="shrink-0 text-[#2563EB]" />
            {name}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  }

  if (!task) {
    if (isDirectLoading || ctxLoading) {
      return (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
          <div className="fixed inset-y-0 right-0 w-full sm:w-[520px] max-w-full bg-white sm:border-l border-[#E5E7EB] z-50 flex flex-col shadow-2xl pt-safe pb-safe animate-fadeIn">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#E5E7EB]">
              <div className="h-5 w-48 bg-gray-200 animate-pulse rounded" />
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.4)] transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-gray-100 animate-pulse rounded" />
                <div className="h-10 bg-gray-100 animate-pulse rounded" />
              </div>
              <div className="h-24 bg-gray-100 animate-pulse rounded" />
            </div>
          </div>
        </>
      );
    }
    return null;
  }

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
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5E7EB] shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="text-[15px] sm:text-[16px] font-semibold text-[#111111] truncate leading-tight" title={task.title}>
              {task.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setEditing(true)}
              type="button"
              title="Edit task"
              aria-label="Edit task"
              className="w-7 h-7 flex items-center justify-center text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] rounded transition-colors cursor-pointer"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
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
                  comments.map(c => {
                    const isCommentOwner = currentUserId && c.user?.id === currentUserId;
                    const canModify = isCommentOwner || isElevated;
                    const isEditing = editingCommentId === c.id;
                    const isAuthorTaskCreator = taskCreator && c.user?.id === taskCreator.id;
                    const authorRole = (c.user?.role || '').toLowerCase();

                    return (
                      <div key={c.id} className="group relative flex gap-3 p-2 -mx-2 rounded-xl hover:bg-[#F9FAFB] transition-colors">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                          style={{ backgroundColor: getAvatarColor(c.user?.name || '') }}
                        >
                          {c.user?.avatar || (c.user?.name ? c.user.name.slice(0, 2).toUpperCase() : 'U')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[13px] font-semibold text-[#111111] truncate">{c.user?.name || 'User'}</span>
                              {isAuthorTaskCreator && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                  Creator
                                </span>
                              )}
                              {authorRole.includes('admin') && !isAuthorTaskCreator && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  Admin
                                </span>
                              )}
                              {authorRole.includes('manager') && !isAuthorTaskCreator && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  PM
                                </span>
                              )}
                              <span className="text-[11px] text-[rgba(17,17,17,0.4)] shrink-0">{c.timeAgo}</span>
                              {c.isEdited && (
                                <span className="text-[10px] text-[rgba(17,17,17,0.38)] italic" title="Edited">
                                  (edited)
                                </span>
                              )}
                            </div>

                            {/* Action buttons on hover */}
                            {!isEditing && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingTo(c);
                                    setCommentText(prev => (prev.includes(`@${c.user?.name}`) ? prev : `@${c.user?.name} ${prev}`));
                                    commentTextareaRef.current?.focus();
                                  }}
                                  className="px-1.5 py-0.5 text-[11px] font-medium text-[rgba(17,17,17,0.55)] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Reply to comment"
                                >
                                  <CornerDownRight size={11} />
                                  <span>Reply</span>
                                </button>

                                {canModify && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditComment(c)}
                                      className="p-1 text-[rgba(17,17,17,0.45)] hover:text-[#111111] hover:bg-[#E5E7EB] rounded transition-colors cursor-pointer"
                                      title="Edit comment"
                                    >
                                      <Pencil size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(c.id)}
                                      className="p-1 text-[rgba(17,17,17,0.45)] hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                      title="Delete comment"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Quoted parent reply if replyTo exists */}
                          {c.replyTo && (
                            <div className="flex items-center gap-1.5 text-[11px] text-[rgba(17,17,17,0.55)] mb-1.5 pl-2 border-l-2 border-[#2563EB] bg-[#F8FAFC] py-0.5 px-2 rounded-r">
                              <CornerDownRight size={11} className="text-[#2563EB] shrink-0" />
                              <span className="truncate">
                                Replying to <strong className="font-semibold text-[#111111]">@{c.replyTo.user?.name || 'Member'}</strong>:{' '}
                                <span className="italic opacity-85">"{c.replyTo.text.slice(0, 40)}"</span>
                              </span>
                            </div>
                          )}

                          {/* Comment Text or Inline Edit Mode */}
                          {isEditing ? (
                            <div className="mt-1 space-y-2">
                              <textarea
                                value={editingCommentText}
                                onChange={e => setEditingCommentText(e.target.value)}
                                onKeyDown={e => {
                                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEditComment(c.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditComment();
                                  }
                                }}
                                rows={3}
                                className="w-full p-2.5 text-[13px] text-[#111111] border border-[#2563EB] ring-2 ring-[#DBEAFE] rounded-xl outline-none resize-none bg-white shadow-xs"
                                placeholder="Edit your comment..."
                                autoFocus
                              />
                              <div className="flex items-center justify-between">
                                <span className="text-[10.5px] text-[rgba(17,17,17,0.4)]">Ctrl+Enter to save · Esc to cancel</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={handleCancelEditComment}
                                    className="px-2.5 py-1 text-[11.5px] font-medium text-[rgba(17,17,17,0.6)] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!editingCommentText.trim() || submittingEdit}
                                    onClick={() => handleSaveEditComment(c.id)}
                                    className="px-3 py-1 text-[11.5px] font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                                  >
                                    {submittingEdit ? 'Saving...' : 'Save changes'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[13px] text-[rgba(17,17,17,0.85)] leading-relaxed whitespace-pre-wrap break-words">
                              {renderCommentBody(c.text)}
                            </p>
                          )}

                          {c.reactions && c.reactions.length > 0 && (
                            <div className="flex gap-1.5 mt-2">
                              {c.reactions.map(r => (
                                <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] cursor-pointer hover:bg-[#E5E7EB] transition-colors">{r}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
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
          <div className="border-t border-[#E5E7EB] p-3.5 sm:p-4 shrink-0 bg-white relative">
            {/* Mention Autocomplete Dropdown */}
            {showMentionMenu && filteredMentionUsers.length > 0 && (
              <div className="absolute left-10 sm:left-12 bottom-full mb-2 w-72 max-h-56 overflow-y-auto bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-50 py-1 divide-y divide-[#F1F3F5] animate-in fade-in slide-in-from-bottom-2">
                <div className="px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.4)]">
                  Mention Member
                </div>
                {filteredMentionUsers.slice(0, 8).map(u => {
                  const isCreator = taskCreator && u.id === taskCreator.id;
                  const uRole = (u.role || '').toLowerCase();
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectMention(u)}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#EFF6FF] text-left transition-colors cursor-pointer group"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9.5px] font-bold text-white shrink-0"
                        style={{ backgroundColor: getAvatarColor(u.name) }}
                      >
                        {u.avatar || u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-medium text-[#111111] truncate">{u.name}</span>
                          {isCreator && (
                            <span className="text-[9.5px] font-semibold px-1 py-0.1 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              Creator
                            </span>
                          )}
                          {uRole.includes('admin') && !isCreator && (
                            <span className="text-[9.5px] font-semibold px-1 py-0.1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Admin
                            </span>
                          )}
                          {uRole.includes('manager') && !isCreator && (
                            <span className="text-[9.5px] font-semibold px-1 py-0.1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              PM
                            </span>
                          )}
                        </div>
                        <span className="text-[10.5px] text-[rgba(17,17,17,0.4)] truncate block">{u.email}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick Mentions & Task Creator Bar */}
            <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-0.5">
              <span className="text-[11px] font-medium text-[rgba(17,17,17,0.45)] shrink-0 flex items-center gap-1">
                <AtSign size={11} className="text-[#2563EB]" /> Mention:
              </span>

              {taskCreator && (
                <button
                  type="button"
                  onClick={() => handleMentionUser(taskCreator)}
                  className="px-2 py-0.5 text-[11px] font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-full transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Tag Task Creator"
                >
                  <span>@{taskCreator.name}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-200 text-purple-800 px-1 rounded-sm">Creator</span>
                </button>
              )}

              {task.assignee && task.assignee.id !== taskCreator?.id && (
                <button
                  type="button"
                  onClick={() => handleMentionUser(task.assignee!)}
                  className="px-2 py-0.5 text-[11px] font-medium bg-blue-50 text-[#2563EB] hover:bg-blue-100 border border-blue-200 rounded-full transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Tag Assignee"
                >
                  <span>@{task.assignee.name}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-200 text-blue-800 px-1 rounded-sm">Assignee</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCommentText(prev => prev + '@');
                  setShowMentionMenu(true);
                  commentTextareaRef.current?.focus();
                }}
                className="px-2 py-0.5 text-[11px] text-[rgba(17,17,17,0.5)] hover:text-[#111111] hover:bg-[#F3F4F6] rounded-full border border-dashed border-[#D1D5DB] transition-colors shrink-0 cursor-pointer"
              >
                + Others
              </button>
            </div>

            {/* Replying To Banner */}
            {replyingTo && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#EFF6FF] border border-b-0 border-[#BFDBFE] rounded-t-xl text-[12px] text-[#2563EB]">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <CornerDownRight size={13} className="shrink-0 text-[#2563EB]" />
                  <span className="truncate">
                    Replying to <strong className="font-semibold">{replyingTo.user?.name || 'Member'}</strong>:{' '}
                    <span className="text-[rgba(37,99,235,0.75)] italic">"{replyingTo.text.slice(0, 45)}"</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="p-0.5 hover:bg-[#DBEAFE] rounded text-[#2563EB] transition-colors shrink-0 cursor-pointer"
                  title="Cancel reply"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Comment Form */}
            <div className="flex gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                style={{ backgroundColor: getAvatarColor(session?.user?.name || 'Me') }}
              >
                {session?.user?.name
                  ? session.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  : 'ME'}
              </div>
              <div
                className={`flex-1 border border-[#E5E7EB] ${
                  replyingTo ? 'rounded-b-xl border-t-0' : 'rounded-xl'
                } overflow-hidden focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#DBEAFE] transition-all bg-white`}
              >
                <textarea
                  ref={commentTextareaRef}
                  value={commentText}
                  onChange={handleCommentTextChange}
                  onKeyDown={e => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  placeholder={
                    replyingTo
                      ? `Reply to @${replyingTo.user?.name}... (Ctrl+Enter to post)`
                      : 'Add a comment or type @ to mention... (Ctrl+Enter to post)'
                  }
                  rows={2}
                  className="w-full px-3 pt-2.5 pb-1 text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none resize-none"
                />
                <div className="flex items-center justify-between px-2.5 pb-2 pt-0.5">
                  <span className="text-[10.5px] text-[rgba(17,17,17,0.38)]">Ctrl+Enter to send</span>
                  <button
                    type="button"
                    disabled={!commentText.trim() || submittingComment}
                    onClick={handleAddComment}
                    className="px-3.5 py-1 text-[12px] font-semibold bg-[#2563EB] text-white rounded-lg disabled:opacity-40 hover:bg-[#1D4ED8] disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Send size={12} className="shrink-0" />
                    <span>{submittingComment ? 'Sending...' : replyingTo ? 'Reply' : 'Comment'}</span>
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
              onClick={(e) => {
                triggerParticleExplosion(e.currentTarget);
                handleDeleteTask();
              }}
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
