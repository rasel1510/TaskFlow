'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useTasks, type DBTask } from '@/context/TaskContext';
import { cn } from '@/lib/utils';
import { healthColors, priorityColors, statusColors, type ProjectHealth } from '../data/mockData';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Delta, DeltaIcon, DeltaValue } from '@/components/delta';
import { StatusIndicator } from '@/components/indicator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCardSkeleton, TaskRowSkeleton } from '@/components/ui/Skeleton';
import { Area, AreaChart, CartesianGrid, LabelList, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { NumberPopIn } from '@/components/NumberPopIn';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  TrendingUp,
  Users,
} from 'lucide-react';

interface DashboardProps {
  onTaskClick: (taskId: string) => void;
  onViewChange: (view: 'tasks' | 'kanban' | 'projects' | 'reports') => void;
}

interface VelocityItem {
  day: string;
  completed: number;
  created: number;
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

const DEFAULT_VELOCITY: VelocityItem[] = [
  { day: 'Mon', completed: 4, created: 3 },
  { day: 'Tue', completed: 6, created: 5 },
  { day: 'Wed', completed: 8, created: 4 },
  { day: 'Thu', completed: 5, created: 7 },
  { day: 'Fri', completed: 9, created: 6 },
  { day: 'Sat', completed: 3, created: 2 },
  { day: 'Sun', completed: 4, created: 1 },
];

const circularChartConfig = {
  count: {
    label: 'Tasks',
  },
  done: {
    label: 'Done',
    color: '#16A34A',
  },
  in_progress: {
    label: 'In Progress',
    color: '#2563EB',
  },
  in_review: {
    label: 'In Review',
    color: '#F59E0B',
  },
  todo: {
    label: 'Todo',
    color: '#94A3B8',
  },
} satisfies ChartConfig;

const volumeChartConfig = {
  completed: {
    label: 'Completed Tasks',
    color: '#16A34A',
  },
  created: {
    label: 'Created Tasks',
    color: '#2563EB',
  },
} satisfies ChartConfig;

function formatDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
}

export default function Dashboard({ onTaskClick, onViewChange }: DashboardProps) {
  const { tasks, isLoading } = useTasks();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [velocityPeriod, setVelocityPeriod] = useState<'7' | '30'>('7');
  const sessionTeamName = (session?.user as { teamName?: string })?.teamName;
  const [companyName, setCompanyName] = useState<string>(sessionTeamName || '');

  useEffect(() => {
    const tName = (session?.user as { teamName?: string })?.teamName;
    if (tName) {
      setCompanyName(tName);
    } else if (session?.user) {
      fetch('/api/team/members', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data?.team?.name) {
            setCompanyName(d.data.team.name);
          }
        })
        .catch(() => { });
    }
  }, [session?.user]);

  const [summary, setSummary] = useState<{
    weeklyVelocity: VelocityItem[];
    projectSummary: ProjectSummaryItem[];
    teamWorkload: TeamMemberWorkload[];
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    const controller = new AbortController();
    const userId = (session?.user as { id?: string })?.id;
    const url = userId ? `/api/reports/summary?userId=${encodeURIComponent(userId)}` : '/api/reports/summary';
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setSummary(d.data);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          // graceful fallback to local computed data
        }
      });

    return () => {
      controller.abort();
    };
  }, [session?.user]);

  const [customName, setCustomName] = useState<string>('');

  useEffect(() => {
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;
    let isMounted = true;
    fetch(`/api/users/${userId}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success && json.data?.name) {
          setCustomName(json.data.name);
        }
      })
      .catch(() => {});

    const onProfileUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.name) {
        setCustomName(detail.name);
      }
    };
    window.addEventListener('user-profile-updated', onProfileUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('user-profile-updated', onProfileUpdate);
    };
  }, [session?.user]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const effectiveName = customName || session?.user?.name || '';
  const userName = effectiveName.trim()
    ? (effectiveName.includes('@') ? effectiveName.split('@')[0] : effectiveName.split(' ')[0])
    : 'Founder';

  // Live computed stats
  const totalTasks = tasks.length;
  const overdueCount = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now
  ).length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const inReview = tasks.filter((t) => t.status === 'in_review').length;
  const todo = tasks.filter((t) => t.status === 'todo').length;

  const completionRate = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;
  const activeRate = totalTasks > 0 ? Math.round(((inProgress + inReview) / totalTasks) * 100) : 0;

  // Circular Donut Chart Data (Status Breakdown)
  const circularData = useMemo(() => {
    if (totalTasks === 0) {
      return [
        { status: 'done', count: 4, share: 40, fill: '#16A34A' },
        { status: 'in_progress', count: 3, share: 30, fill: '#2563EB' },
        { status: 'in_review', count: 2, share: 20, fill: '#F59E0B' },
        { status: 'todo', count: 1, share: 10, fill: '#94A3B8' },
      ];
    }
    const safeTotal = Math.max(1, totalTasks);
    return [
      { status: 'done', count: done, share: Math.round((done / safeTotal) * 100), fill: '#16A34A' },
      { status: 'in_progress', count: inProgress, share: Math.round((inProgress / safeTotal) * 100), fill: '#2563EB' },
      { status: 'in_review', count: inReview, share: Math.round((inReview / safeTotal) * 100), fill: '#F59E0B' },
      { status: 'todo', count: todo, share: Math.round((todo / safeTotal) * 100), fill: '#94A3B8' },
    ].filter((item) => item.count > 0 || totalTasks === 0);
  }, [totalTasks, done, inProgress, inReview, todo]);

  // Velocity chart data
  const velocityData = useMemo(() => {
    const raw = summary?.weeklyVelocity && summary.weeklyVelocity.length > 0
      ? summary.weeklyVelocity
      : DEFAULT_VELOCITY;
    return raw;
  }, [summary]);

  const totalCompletedVelocity = velocityData.reduce((acc, v) => acc + v.completed, 0);
  const totalCreatedVelocity = velocityData.reduce((acc, v) => acc + v.created, 0);

  // My tasks = latest 5 tasks
  const myTasks: DBTask[] = tasks.slice(0, 5);

  // Upcoming deadlines
  const upcomingDeadlines = tasks
    .filter((t) => t.status !== 'done' && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 md:py-8 space-y-6">

        {/* Panoramic Dashboard Banner with Overlay Text */}
        <div className="relative w-full h-36 sm:h-44 md:h-52 rounded-xl overflow-hidden border border-border/60 bg-gradient-to-r from-sky-100 via-indigo-50 to-blue-100 dark:from-slate-900 dark:to-slate-800">
          <img
            src="/dashboard-banner.jpg"
            alt="Dashboard Banner"
            className="w-full h-full object-cover object-[center_45%] select-none"
            loading="eager"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />

          {/* Banner Content: Text with transitions.dev Text Reveal */}
          <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6 z-10 t-stagger is-shown pointer-events-none">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 t-stagger-line drop-shadow-sm">
              Good {greeting}, {userName}
            </h1>
            {companyName && (
              <div className="mt-1.5 flex items-center t-stagger-line">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-medium bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700/70 shadow-xs">
                  <Building2 className="size-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span>{companyName}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 1. SaaS Founder KPI 
        Cards Grid (@efferd/dashboard-3 Style) */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Backlog */}
            <Card className="shadow-none border-border t-card-enter t-card-stagger-1 t-hover-lift">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-normal text-muted-foreground text-xs">
                  Total Backlog & Tasks
                </CardTitle>
                <Layers className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                  <NumberPopIn value={totalTasks} />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Delta value={8.5} variant="badge">
                    <DeltaIcon variant="trend" />
                    <DeltaValue />
                  </Delta>
                </div>
              </CardContent>
            </Card>

            {/* In Progress */}
            <Card className="shadow-none border-border t-card-enter t-card-stagger-2 t-hover-lift">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-normal text-muted-foreground text-xs">
                  Active Execution
                </CardTitle>
                <Clock className="size-4 text-primary" />
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-primary tabular-nums">
                  <NumberPopIn value={inProgress} />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
                    {activeRate}% of sprint
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Completed */}
            <Card className="shadow-none border-border t-card-enter t-card-stagger-3 t-hover-lift">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-normal text-muted-foreground text-xs">
                  Completed Deliverables
                </CardTitle>
                <CheckCircle2 className="size-4 text-emerald-600" />
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-emerald-600 tabular-nums">
                  <NumberPopIn value={done} />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Delta value={12.4} variant="badge">
                    <DeltaIcon variant="trend" />
                    <DeltaValue />
                  </Delta>
                </div>
              </CardContent>
            </Card>

            {/* Overdue / Blockers */}
            <Card className="shadow-none border-border t-card-enter t-card-stagger-4 t-hover-lift">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-normal text-muted-foreground text-xs">
                  Overdue
                </CardTitle>
                <StatusIndicator color={overdueCount > 0 ? 'rose' : 'emerald'} pulse={overdueCount > 0} />
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                <div className={`text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums ${overdueCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
                  <NumberPopIn value={overdueCount} />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {overdueCount > 0 ? (
                    <Delta value={-overdueCount} variant="badge">
                      <DeltaIcon variant="trend" />
                      <DeltaValue />
                    </Delta>
                  ) : (
                    <span className="font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
                      Zero overdue
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 2. Charts Row: Velocity Area Chart + The Circular Donut Figure */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Main Velocity Area Chart (@efferd ConversationVolumeChart style) */}
          <Card className="lg:col-span-2 shadow-none border-border flex flex-col justify-between t-card-enter t-card-stagger-5 t-hover-lift">
            <CardHeader className="space-y-1 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">Sprint Velocity</CardTitle>
                    <Delta value={9.4} variant="badge">
                      <DeltaIcon variant="trend" />
                      <DeltaValue />
                    </Delta>
                  </div>
                </div>
                <Select
                  value={velocityPeriod}
                  onValueChange={(val: '7' | '30') => setVelocityPeriod(val)}
                >
                  <SelectTrigger size="sm" className="w-[130px] h-8 text-xs font-medium">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary pills */}
              <div className="flex flex-wrap gap-6 border-b border-border/60 pt-3 pb-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Total Resolved</div>
                  <div className="font-semibold text-base sm:text-lg text-emerald-600 tabular-nums">
                    <NumberPopIn value={totalCompletedVelocity} /> tasks
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">New Inflow</div>
                  <div className="font-semibold text-base sm:text-lg text-primary tabular-nums">
                    <NumberPopIn value={totalCreatedVelocity} /> tasks
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Net Velocity</div>
                  <div className="font-semibold text-base sm:text-lg text-foreground tabular-nums">
                    {totalCompletedVelocity >= totalCreatedVelocity ? '+' : ''}
                    {totalCompletedVelocity - totalCreatedVelocity}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-2 pb-4">
              {mounted ? (
                <ChartContainer className="h-[240px] w-full" config={volumeChartConfig}>
                  <AreaChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16A34A" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#16A34A" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.6} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={11}
                      stroke="#9CA3AF"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={11}
                      stroke="#9CA3AF"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      stroke="#16A34A"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#fillCompleted)"
                    />
                    <Area
                      type="monotone"
                      dataKey="created"
                      stroke="#2563EB"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      fillOpacity={1}
                      fill="url(#fillCreated)"
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">
                  Loading telemetry chart...
                </div>
              )}
            </CardContent>
          </Card>

          {/* ⭐ THE CIRCULAR FIGURE (@efferd ChannelBreakdownChart style) */}
          <Card className="shadow-none border-border flex flex-col justify-between t-card-enter t-card-stagger-5 t-hover-lift">
            <CardHeader className="space-y-1 pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Task Distribution</CardTitle>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs font-medium border-none px-2.5 py-0.5 tabular-nums flex items-center gap-1",
                    completionRate > 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {completionRate > 0 && <TrendingUp className="size-3" />}
                  <span>{completionRate}%</span>
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="my-auto py-2">
              {mounted ? (
                <ChartContainer
                  className="mx-auto aspect-square max-h-[260px] w-full"
                  config={circularChartConfig}
                >
                  <PieChart accessibilityLayer>
                    <Pie
                      cornerRadius={8}
                      data={circularData}
                      dataKey="share"
                      innerRadius={46}
                      nameKey="status"
                      outerRadius="86%"
                      stroke="var(--card)"
                      strokeWidth={3}
                    >
                      <LabelList
                        className="fill-white font-medium text-[11px]"
                        dataKey="share"
                        formatter={(label: any) => {
                          const n = Number(label);
                          return Number.isFinite(n) && n > 9 ? `${n}%` : '';
                        }}
                        position="inside"
                        stroke="none"
                      />
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">
                  Loading circular chart...
                </div>
              )}
            </CardContent>

            <div className="p-4 pt-1 border-t border-border/50 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg bg-muted/40 p-2">
                <div className="text-muted-foreground text-[11px]">Completed</div>
                <div className="font-semibold text-emerald-600 text-sm">{done}</div>
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <div className="text-muted-foreground text-[11px]">In Progress</div>
                <div className="font-semibold text-primary text-sm">{inProgress}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* 3. Secondary Grid: Active Projects & Team Workload (@efferd table format) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Project Progress Table */}
          <Card className="lg:col-span-2 shadow-none border-border t-card-enter t-card-stagger-6 t-hover-lift">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Active Project Roadmaps</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewChange('projects')}
                className="h-8 gap-1 text-xs text-primary hover:text-primary font-medium"
              >
                View all projects
                <ExternalLink className="size-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/60">
                    <TableHead className="w-[40%] text-xs">Project</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Progress</TableHead>
                    <TableHead className="text-right text-xs">Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!summary?.projectSummary || summary.projectSummary.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-28 text-center text-xs text-muted-foreground">
                        No active projects found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary.projectSummary.slice(0, 5).map((project) => {
                      const hc = healthColors[project.health] ?? healthColors['on_track'];
                      return (
                        <TableRow
                          key={project.id}
                          onClick={() => onViewChange('projects')}
                          className="cursor-pointer hover:bg-muted/40 transition-colors border-border/40"
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="size-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: project.color }}
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-xs sm:text-sm truncate">
                                  {project.name}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {project.completedTasks} of {project.taskCount} tasks
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant="secondary"
                              className="text-[10.5px] font-medium border-none px-2 py-0.5"
                              style={{ backgroundColor: hc.bg, color: hc.text }}
                            >
                              {hc.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="w-full max-w-[140px] space-y-1">
                              <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                                <span>{project.progress}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${project.progress}%`,
                                    backgroundColor: project.color,
                                  }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-right text-xs text-muted-foreground">
                            {project.dueDate}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Upcoming Deadlines Widget */}
          <Card className="shadow-none border-border t-card-enter t-card-stagger-6 t-hover-lift">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Upcoming Deadlines</CardTitle>
                <CalendarDays className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {upcomingDeadlines.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No upcoming deadlines scheduled
                </div>
              ) : (
                upcomingDeadlines.map((t) => {
                  const pc = safePriorityColor(t.priority);
                  return (
                    <div
                      key={t.id}
                      onClick={() => onTaskClick(t.id)}
                      className="group flex items-start justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-xs truncate group-hover:text-primary transition-colors">
                          {t.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                          <span className="truncate">{t.project?.name ?? 'General'}</span>
                          <span>·</span>
                          <span className="font-medium" style={{ color: pc.color }}>
                            {pc.label}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {formatDate(t.dueDate)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* 4. Bottom Grid: My Assigned Tasks & Team Workload */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pb-6">

          {/* My Tasks (@efferd recent conversations style) */}
          <Card className="lg:col-span-2 shadow-none border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">My Focus Tasks</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewChange('tasks')}
                className="h-8 gap-1 text-xs text-primary hover:text-primary font-medium"
              >
                View all
                <ExternalLink className="size-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  <TaskRowSkeleton />
                  <TaskRowSkeleton />
                </div>
              ) : myTasks.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No tasks assigned. You are all caught up!
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {myTasks.map((task) => {
                    const sc = safeStatusColor(task.status);
                    const pc = safePriorityColor(task.priority);
                    return (
                      <div
                        key={task.id}
                        onClick={() => onTaskClick(task.id)}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: sc.text }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs sm:text-sm font-medium truncate">
                            {task.title}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <span>{task.project?.name ?? 'General'}</span>
                            <span>·</span>
                            <span style={{ color: pc.color }} className="font-medium">
                              {pc.label}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium border-none px-2 py-0.5"
                            style={{ backgroundColor: sc.bg, color: sc.text }}
                          >
                            {sc.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {formatDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Workload (@efferd team-on-duty style) */}
          <Card className="shadow-none border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Team Workload</CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {(!summary?.teamWorkload || summary.teamWorkload.length === 0) ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Team telemetry initializing...
                </div>
              ) : (
                summary.teamWorkload.slice(0, 5).map((member, i) => {
                  const percent =
                    member.assigned > 0
                      ? Math.round((member.completed / member.assigned) * 100)
                      : 0;
                  return (
                    <div key={member.user.id || i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="size-6 text-[10px]">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {member.user.avatar || member.user.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate">{member.user.name}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {member.completed}/{member.assigned} ({percent}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

function safePriorityColor(priority: string) {
  const p = priority as keyof typeof priorityColors;
  return priorityColors[p] ?? priorityColors['medium'];
}

function safeStatusColor(status: string) {
  const s = status as keyof typeof statusColors;
  return statusColors[s] ?? statusColors['todo'];
}
