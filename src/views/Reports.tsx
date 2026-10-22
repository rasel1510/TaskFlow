'use client';

import { useState, useEffect, useCallback } from 'react';
import { healthColors, type ProjectHealth } from '../data/mockData';
import { useToast } from '@/components/ui/Toast';

interface VelocityItem {
  day: string;
  completed: number;
  created: number;
}

interface SegmentItem {
  label: string;
  value: number;
  color: string;
}

interface KPIItem {
  label: string;
  value: string | number;
  change: string;
  color: string;
}

interface TeamMemberWorkload {
  user: {
    id: string;
    name: string;
    avatar: string;
    role: string;
  };
  assigned: number;
  completed: number;
  remaining: number;
}

interface ProjectSummaryItem {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  completedTasks: number;
  progress: number;
  dueDate: string;
  health: ProjectHealth;
}

interface ReportData {
  totalTasks: number;
  completedTasks: number;
  inProgressCount: number;
  overdueCount: number;
  statusSegments: SegmentItem[];
  prioritySegments: SegmentItem[];
  weeklyVelocity: VelocityItem[];
  projectSummary: ProjectSummaryItem[];
  teamWorkload: TeamMemberWorkload[];
  kpis: KPIItem[];
}

function BarChart({ data }: { data: VelocityItem[] }) {
  const max = Math.max(1, ...data.map(d => d.completed));
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

function DonutChart({ segments }: { segments: SegmentItem[] }) {
  const total = segments.reduce((a, b) => a + b.value, 0);
  let offset = 0;
  const r = 52;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
        {total === 0 ? (
          <circle cx="60" cy="60" r={r} fill="none" stroke="#F3F4F6" strokeWidth="14" />
        ) : (
          segments.map((seg, i) => {
            if (seg.value === 0) return null;
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
          })
        )}
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

export default function Reports() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reports/summary', { signal: controller.signal })
      .then(r => r.json())
      .then(envelope => {
        if (envelope.success && envelope.data) {
          setReport(envelope.data);
        }
      })
      .catch(err => { if (err.name !== 'AbortError') console.error('[Reports] Error loading report data:', err); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const handleExportCSV = useCallback(async () => {
    setExporting(true);
    toast.info('⏳ Preparing CSV export...');
    try {
      const res = await fetch('/api/reports/export?format=csv');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStamp = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `flowsync-tasks-${dateStamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('✅ CSV export downloaded successfully!');
    } catch (err) {
      console.error('[Reports] CSV export error:', err);
      toast.error('❌ Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [toast]);

  const totalTasks = report?.totalTasks ?? 0;

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-[20px] md:text-[24px] font-bold text-[#111111]">Reports & Analytics</h1>
            <p className="text-[12px] md:text-[13px] text-[rgba(17,17,17,0.45)] mt-0.5">Live PostgreSQL Aggregations</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[12px] sm:text-[12.5px] font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60 shadow-2xs"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-[12px] sm:text-[12.5px] font-semibold hover:bg-[#1D4ED8] transition-colors shadow-2xs"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Print Report
            </button>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4 h-24 animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2 bg-white border border-[#E5E7EB] rounded-xl p-5 h-64 animate-pulse" />
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 h-64 animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {(report?.kpis ?? []).map((k, i) => {
                const positive = k.change.startsWith('+') && k.label !== 'Overdue';
                const negative = k.label === 'Overdue' ? k.change.startsWith('+') : k.change.startsWith('-');
                return (
                  <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
                    <div className="text-[11px] text-[rgba(17,17,17,0.45)] mb-1.5">{k.label}</div>
                    <div className="text-[22px] font-bold text-[#111111] mb-1">{k.value}</div>
                    <div className={`text-[11px] font-medium ${negative ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                      {k.change} vs baseline
                    </div>
                    <div className="mt-2 h-0.5 rounded-full" style={{ backgroundColor: k.color + '40' }}>
                      <div className="h-full rounded-full" style={{ width: '65%', backgroundColor: k.color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              {/* Bar chart */}
              <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[#111111]">Task Completion Trend</h2>
                    <p className="text-[12px] text-[rgba(17,17,17,0.4)] mt-0.5">Tasks completed per day over the last 7 days</p>
                  </div>
                </div>
                <BarChart data={report?.weeklyVelocity ?? []} />
              </div>

              {/* Status donut */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
                <h2 className="text-[15px] font-semibold text-[#111111] mb-4">Status Distribution</h2>
                <DonutChart segments={report?.statusSegments ?? []} />
              </div>
            </div>

            {/* Second row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              {/* Priority distribution */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
                <h2 className="text-[15px] font-semibold text-[#111111] mb-4">Priority Distribution</h2>
                <div className="space-y-3">
                  {(report?.prioritySegments ?? []).map(seg => {
                    const pct = totalTasks > 0 ? Math.round((seg.value / totalTasks) * 100) : 0;
                    return (
                      <div key={seg.label} className="flex items-center gap-3">
                        <span className="text-[12.5px] text-[rgba(17,17,17,0.6)] w-14">{seg.label}</span>
                        <div className="flex-1 h-5 bg-[#F3F4F6] rounded overflow-hidden">
                          <div
                            className="h-full rounded flex items-center justify-end pr-2 transition-all"
                            style={{ width: `${pct}%`, minWidth: seg.value > 0 ? 20 : 0, backgroundColor: seg.color }}
                          >
                            {seg.value > 0 && <span className="text-[10px] font-bold text-white">{seg.value}</span>}
                          </div>
                        </div>
                        <span className="text-[12px] text-[rgba(17,17,17,0.45)] w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
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
                    <span className="flex-1 text-right">Progress</span>
                  </div>
                  {(!report?.teamWorkload || report.teamWorkload.length === 0) ? (
                    <div className="py-6 text-center text-[12.5px] text-[rgba(17,17,17,0.4)]">
                      No team members assigned yet.
                    </div>
                  ) : (
                    report.teamWorkload.map((m, i) => (
                      <div key={m.user.id || i} className="flex items-center gap-4 px-5 py-3">
                        <div className="w-36 flex items-center gap-2 min-w-0">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                            style={{ backgroundColor: ['#2563EB','#7C3AED','#0891B2','#16A34A','#EA580C'][i % 5] }}
                          >
                            {m.user.avatar}
                          </div>
                          <span className="text-[12.5px] font-medium text-[#111111] truncate">{m.user.name}</span>
                        </div>
                        <span className="w-16 text-right text-[12.5px] font-semibold text-[#111111]">{m.assigned}</span>
                        <span className="w-16 text-right text-[12.5px] text-[#16A34A] font-semibold">{m.completed}</span>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#2563EB]"
                              style={{ width: `${m.assigned > 0 ? (m.completed / m.assigned) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-[rgba(17,17,17,0.45)] w-8 text-right">
                            {m.assigned > 0 ? Math.round((m.completed / m.assigned) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Project health table */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E5E7EB]">
                <h2 className="text-[15px] font-semibold text-[#111111]">Project Health Overview</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#F3F4F6]">
                      {['Project', 'Progress', 'Total Tasks', 'Completed', 'Deadline', 'Health'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] bg-[#F9FAFB]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {(!report?.projectSummary || report.projectSummary.length === 0) ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-6 text-center text-[12.5px] text-[rgba(17,17,17,0.4)]">
                          No projects recorded yet.
                        </td>
                      </tr>
                    ) : (
                      report.projectSummary.map(p => {
                        const hc = healthColors[p.health] ?? healthColors['on_track'];
                        return (
                          <tr key={p.id} className="hover:bg-[#F9FAFB] transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
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
                            <td className="px-5 py-3.5 text-[12.5px] text-[rgba(17,17,17,0.7)]">{p.taskCount}</td>
                            <td className="px-5 py-3.5 text-[12.5px] text-[#16A34A] font-medium">{p.completedTasks}</td>
                            <td className="px-5 py-3.5 text-[12.5px] text-[rgba(17,17,17,0.6)]">{p.dueDate}</td>
                            <td className="px-5 py-3.5">
                              <span className="text-[11px] font-medium px-2 py-1 rounded-full" style={{ backgroundColor: hc.bg, color: hc.text }}>
                                {hc.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
