import { weeklyData, teamWorkload, projects, tasks, healthColors, statusColors } from '../data/mockData';

function BarChart({ data }: { data: typeof weeklyData }) {
  const max = Math.max(...data.map(d => d.completed));
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[11px] font-semibold text-[#111111]">{d.completed}</span>
          <div
            className="w-full rounded-t-md bg-[#2563EB] transition-all hover:bg-[#1D4ED8]"
            style={{ height: `${(d.completed / max) * 100}%`, minHeight: 4 }}
          />
          <span className="text-[10px] text-[rgba(17,17,17,0.4)]">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, b) => a + b.value, 0);
  let offset = 0;
  const r = 52;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-6">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circ;
          const gap = circ - dash;
          const o = circ - offset * (circ / total);
          const el = (
            <circle
              key={i}
              cx="60" cy="60" r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={o}
              transform="rotate(-90 60 60)"
            />
          );
          offset += seg.value;
          return el;
        })}
        <text x="60" y="56" textAnchor="middle" fontSize="18" fontWeight="700" fill="#111111">{total}</text>
        <text x="60" y="70" textAnchor="middle" fontSize="10" fill="rgba(17,17,17,0.45)">Tasks</text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
            <span className="text-[12px] text-[rgba(17,17,17,0.7)]">{seg.label}</span>
            <span className="ml-auto text-[12px] font-semibold text-[#111111] pl-4">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const statusSegments = [
  { label: 'Backlog', value: tasks.filter(t => t.status === 'backlog').length, color: '#9CA3AF' },
  { label: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: '#2563EB' },
  { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: '#EA580C' },
  { label: 'In Review', value: tasks.filter(t => t.status === 'in_review').length, color: '#7C3AED' },
  { label: 'Done', value: tasks.filter(t => t.status === 'done').length, color: '#16A34A' },
];

const prioritySegments = [
  { label: 'Low', value: tasks.filter(t => t.priority === 'low').length, color: '#9CA3AF' },
  { label: 'Medium', value: tasks.filter(t => t.priority === 'medium').length, color: '#F59E0B' },
  { label: 'High', value: tasks.filter(t => t.priority === 'high').length, color: '#EA580C' },
  { label: 'Urgent', value: tasks.filter(t => t.priority === 'urgent').length, color: '#DC2626' },
];

const kpis = [
  { label: 'Total Tasks', value: tasks.length, change: '+12%', color: '#2563EB' },
  { label: 'Completed', value: tasks.filter(t => t.status === 'done').length, change: '+18%', color: '#16A34A' },
  { label: 'Overdue', value: tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length, change: '-1', color: '#DC2626' },
  { label: 'Avg. Cycle Time', value: '2.4d', change: '-8%', color: '#7C3AED' },
  { label: 'On-Time Rate', value: '87%', change: '+4%', color: '#0891B2' },
  { label: 'Time Tracked', value: '142h', change: '+6%', color: '#EA580C' },
];

export default function Reports() {
  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-[1280px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[24px] font-bold text-[#111111]">Reports & Analytics</h1>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mt-0.5">Sep 1 – Sep 19, 2026</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-[12.5px] text-[rgba(17,17,17,0.6)] hover:bg-[#F9FAFB] transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Date Range
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-[12.5px] text-[rgba(17,17,17,0.6)] hover:bg-[#F9FAFB] transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
              Export CSV
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-[12.5px] font-semibold hover:bg-[#1D4ED8] transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Generate PDF
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-6 gap-3 mb-6">
          {kpis.map((k, i) => {
            const positive = k.change.startsWith('+') && k.label !== 'Overdue';
            const negative = k.label === 'Overdue' ? k.change.startsWith('+') : k.change.startsWith('-');
            return (
              <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
                <div className="text-[11px] text-[rgba(17,17,17,0.45)] mb-1.5">{k.label}</div>
                <div className="text-[22px] font-bold text-[#111111] mb-1">{k.value}</div>
                <div className={`text-[11px] font-medium ${negative ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                  {k.change} vs last period
                </div>
                <div className="mt-2 h-0.5 rounded-full" style={{ backgroundColor: k.color + '40' }}>
                  <div className="h-full rounded-full" style={{ width: '65%', backgroundColor: k.color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-3 gap-5 mb-5">
          {/* Bar chart */}
          <div className="col-span-2 bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[15px] font-semibold text-[#111111]">Task Completion Trend</h2>
                <p className="text-[12px] text-[rgba(17,17,17,0.4)] mt-0.5">Tasks completed per day this week</p>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-[#F3F4F6] rounded-lg text-[11.5px]">
                {['Week', 'Month', 'Quarter'].map((p, i) => (
                  <button key={p} className={`px-2.5 py-1 rounded transition-colors ${i === 0 ? 'bg-white shadow-sm text-[#111111] font-medium' : 'text-[rgba(17,17,17,0.45)]'}`}>{p}</button>
                ))}
              </div>
            </div>
            <BarChart data={weeklyData} />
          </div>

          {/* Status donut */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <h2 className="text-[15px] font-semibold text-[#111111] mb-4">Status Distribution</h2>
            <DonutChart segments={statusSegments} />
          </div>
        </div>

        {/* Second row */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Priority distribution */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <h2 className="text-[15px] font-semibold text-[#111111] mb-4">Priority Distribution</h2>
            <div className="space-y-3">
              {prioritySegments.map(seg => (
                <div key={seg.label} className="flex items-center gap-3">
                  <span className="text-[12.5px] text-[rgba(17,17,17,0.6)] w-14">{seg.label}</span>
                  <div className="flex-1 h-5 bg-[#F3F4F6] rounded overflow-hidden">
                    <div
                      className="h-full rounded flex items-center justify-end pr-2"
                      style={{ width: `${(seg.value / tasks.length) * 100}%`, backgroundColor: seg.color }}
                    >
                      <span className="text-[10px] font-bold text-white">{seg.value}</span>
                    </div>
                  </div>
                  <span className="text-[12px] text-[rgba(17,17,17,0.45)] w-8 text-right">{Math.round((seg.value / tasks.length) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Team workload */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB]">
              <h2 className="text-[15px] font-semibold text-[#111111]">Team Workload</h2>
            </div>
            <div className="divide-y divide-[#F3F4F6]">
              <div className="flex items-center gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)]">
                <span className="w-36">Member</span>
                <span className="w-16 text-right">Assigned</span>
                <span className="w-16 text-right">Done</span>
                <span className="w-16 text-right">Overdue</span>
                <span className="flex-1">Capacity</span>
              </div>
              {teamWorkload.map((m, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-36 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: ['#2563EB','#7C3AED','#0891B2','#16A34A','#EA580C'][i % 5] }}>
                      {m.user.avatar}
                    </div>
                    <span className="text-[12.5px] font-medium text-[#111111] truncate">{m.user.name.split(' ')[0]}</span>
                  </div>
                  <span className="w-16 text-right text-[12.5px] font-semibold text-[#111111]">{m.assigned}</span>
                  <span className="w-16 text-right text-[12.5px] text-[#16A34A] font-semibold">{m.completed}</span>
                  <span className="w-16 text-right text-[12.5px] text-[rgba(17,17,17,0.45)]">0</span>
                  <div className="flex-1">
                    <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${(m.completed / m.assigned) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Project health */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-[15px] font-semibold text-[#111111]">Project Health Overview</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]">
                  {['Project', 'Progress', 'Open Tasks', 'Completed', 'Overdue', 'Deadline', 'Health'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] bg-[#F9FAFB]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {projects.map(p => (
                  <tr key={p.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-[13px] font-medium text-[#111111]">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${p.progress}%`, backgroundColor: p.color }} />
                        </div>
                        <span className="text-[12px] text-[rgba(17,17,17,0.6)]">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[12.5px] text-[rgba(17,17,17,0.7)]">{p.taskCount - p.completedTasks}</td>
                    <td className="px-5 py-3.5 text-[12.5px] text-[#16A34A] font-medium">{p.completedTasks}</td>
                    <td className="px-5 py-3.5 text-[12.5px] text-[#DC2626] font-medium">{p.overdueTasks}</td>
                    <td className="px-5 py-3.5 text-[12.5px] text-[rgba(17,17,17,0.6)]">{p.dueDate}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] font-medium px-2 py-1 rounded-full" style={{ backgroundColor: healthColors[p.health].bg, color: healthColors[p.health].text }}>
                        {healthColors[p.health].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
