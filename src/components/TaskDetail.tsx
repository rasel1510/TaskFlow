import { useState } from 'react';
import { tasks, statusColors, priorityColors, getProjectName } from '../data/mockData';

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
}

const comments = [
  { id: 'c1', user: { name: 'Sarah Chen', avatar: 'SC', color: '#7C3AED' }, text: 'I\'ve started working on the hero section. The mockup is attached — let me know if the layout works for you.', time: '2 hours ago', reactions: ['👍 3', '🔥 1'] },
  { id: 'c2', user: { name: 'Ahmed Malik', avatar: 'AM', color: '#0891B2' }, text: 'Looks great! One thing — can we make the CTA button a bit larger on mobile?', time: '1 hour ago', reactions: ['👍 2'] },
  { id: 'c3', user: { name: 'Rasel Ahmed', avatar: 'RA', color: '#2563EB' }, text: 'Good point, @Ahmed. I\'ll update the specs. Let\'s target 44px minimum touch target per accessibility guidelines.', time: '45 minutes ago', reactions: [] },
];

const activity = [
  { text: 'Rasel Ahmed changed status to In Progress', time: '3 hours ago', icon: '🔄' },
  { text: 'Sarah Chen was assigned to this task', time: '1 day ago', icon: '👤' },
  { text: 'Priority changed to High', time: '1 day ago', icon: '⚡' },
  { text: 'Task created by Rasel Ahmed', time: '2 days ago', icon: '✨' },
];

export default function TaskDetail({ taskId, onClose }: TaskDetailProps) {
  const task = tasks.find(t => t.id === taskId);
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');

  if (!task) return null;

  const s = statusColors[task.status];
  const p = priorityColors[task.priority];
  const subtaskDone = task.subtasks?.filter(s => s.done).length ?? 0;
  const subtaskTotal = task.subtasks?.length ?? 0;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[520px] bg-white border-l border-[#E5E7EB] z-50 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-semibold text-[rgba(17,17,17,0.4)] font-mono bg-[#F3F4F6] px-2 py-0.5 rounded">{task.id}</span>
            <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.text }}>{s.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.4)] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.4)] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.4)] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
                  content: (
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center text-[8px] font-bold text-white">{task.assignee.avatar}</span>
                      <span className="text-[12.5px] text-[#111111]">{task.assignee.name}</span>
                    </span>
                  ),
                },
                {
                  label: 'Project',
                  content: <span className="text-[12.5px] text-[#111111]">{getProjectName(task.projectId)}</span>,
                },
                {
                  label: 'Due Date',
                  content: <span className="text-[12.5px] text-[#111111]">{task.dueDate}</span>,
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

            {/* Subtasks */}
            {subtaskTotal > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.35)]">
                    Subtasks
                  </div>
                  <span className="text-[11.5px] text-[rgba(17,17,17,0.45)]">{subtaskDone}/{subtaskTotal} done</span>
                </div>
                <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${(subtaskDone / subtaskTotal) * 100}%` }} />
                </div>
                <div className="space-y-2">
                  {task.subtasks?.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg hover:bg-[#F9FAFB] cursor-pointer">
                      <input type="checkbox" checked={sub.done} onChange={() => {}} className="w-3.5 h-3.5 rounded border-[#D1D5DB] accent-[#2563EB]" />
                      <span className={`text-[13px] ${sub.done ? 'line-through text-[rgba(17,17,17,0.35)]' : 'text-[#111111]'}`}>{sub.title}</span>
                    </div>
                  ))}
                </div>
                <button className="flex items-center gap-1.5 mt-2 px-3 py-1.5 text-[12.5px] text-[rgba(17,17,17,0.45)] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add subtask
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-[#E5E7EB] mb-4">
              <div className="flex gap-1">
                {(['details', 'comments', 'activity'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-[13px] font-medium capitalize border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-[#2563EB] text-[#2563EB]'
                        : 'border-transparent text-[rgba(17,17,17,0.5)] hover:text-[#111111]'
                    }`}
                  >
                    {tab} {tab === 'comments' && `(${comments.length})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            {activeTab === 'comments' && (
              <div className="space-y-4">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: c.user.color }}>
                      {c.user.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[13px] font-semibold text-[#111111]">{c.user.name}</span>
                        <span className="text-[11px] text-[rgba(17,17,17,0.4)]">{c.time}</span>
                      </div>
                      <p className="text-[13px] text-[rgba(17,17,17,0.8)] leading-relaxed">{c.text}</p>
                      {c.reactions.length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          {c.reactions.map(r => (
                            <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] cursor-pointer hover:bg-[#E5E7EB] transition-colors">{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-3">
                {activity.map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[14px] mt-0.5">{a.icon}</span>
                    <div>
                      <p className="text-[12.5px] text-[rgba(17,17,17,0.75)]">{a.text}</p>
                      <p className="text-[11px] text-[rgba(17,17,17,0.4)] mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'details' && (
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.35)] mb-2">Time Tracking</div>
                  <div className="grid grid-cols-3 gap-3">
                    {[['Estimated', task.estimate], ['Tracked', '3h 20m'], ['Remaining', '4h 40m']].map(([label, val]) => (
                      <div key={label} className="bg-[#F9FAFB] rounded-lg p-3 text-center">
                        <div className="text-[14px] font-semibold text-[#111111]">{val}</div>
                        <div className="text-[10.5px] text-[rgba(17,17,17,0.4)] mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                  <button className="flex items-center gap-1.5 mt-2.5 w-full justify-center px-3 py-2 border border-[#E5E7EB] rounded-lg text-[12.5px] font-medium text-[rgba(17,17,17,0.6)] hover:bg-[#F9FAFB] transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Start Timer
                  </button>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.35)] mb-2">Attachments ({task.attachmentsCount})</div>
                  {task.attachmentsCount > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {Array.from({ length: Math.min(task.attachmentsCount, 2) }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2 p-2.5 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer transition-colors">
                          <div className="w-8 h-8 rounded bg-[#DBEAFE] flex items-center justify-center shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11.5px] font-medium text-[#111111] truncate">design-brief-{i + 1}.pdf</div>
                            <div className="text-[10px] text-[rgba(17,17,17,0.4)]">2.4 MB</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-[rgba(17,17,17,0.35)]">No attachments yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comment input — always visible */}
        {activeTab === 'comments' && (
          <div className="border-t border-[#E5E7EB] p-4 shrink-0">
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-[10px] font-bold text-white shrink-0">RA</div>
              <div className="flex-1 border border-[#E5E7EB] rounded-xl overflow-hidden focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#DBEAFE] transition-all">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment... Use @ to mention"
                  rows={2}
                  className="w-full px-3 pt-2.5 pb-1 text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none resize-none"
                />
                <div className="flex items-center gap-1 px-2 pb-1.5">
                  {[
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>,
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                  ].map((icon, i) => (
                    <button key={i} className="w-6 h-6 flex items-center justify-center rounded text-[rgba(17,17,17,0.35)] hover:text-[#111111] transition-colors">{icon}</button>
                  ))}
                  <button
                    disabled={!commentText.trim()}
                    className="ml-auto px-3 py-1 text-[12px] font-semibold bg-[#2563EB] text-white rounded-lg disabled:opacity-40 hover:bg-[#1D4ED8] disabled:cursor-not-allowed transition-colors"
                    onClick={() => setCommentText('')}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
