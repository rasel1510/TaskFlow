/**
 * src/api/projects/[id]/burndown/route.ts
 *
 * Project Burndown & Velocity Analytics Engine (Step 4.12)
 * Computes a daily time-series comparing ideal burn trajectory vs actual remaining work.
 *
 * GET /api/projects/:id/burndown
 * Returns: daily burndown series, ideal line, velocity data, projected completion date
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { tasks as mockTasks, projects as mockProjects } from '@/data/mockData';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export interface BurndownDataPoint {
  date: string;       // YYYY-MM-DD
  ideal: number;      // ideal remaining tasks on this day (linear slope)
  actual: number | null; // actual remaining tasks (null for future dates)
  completed: number;  // cumulative tasks completed by this date
}

export interface BurndownResult {
  projectId: string;
  projectName: string;
  startDate: string;
  dueDate: string;
  totalTasks: number;
  completedTasks: number;
  velocityLast7Days: number;
  forecastedCompletionDate: string | null;
  daysUntilForecastedCompletion: number | null;
  isOnTrack: boolean;
  series: BurndownDataPoint[];
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    interface TaskRecord {
      id: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      dueDate?: Date | null;
    }

    interface ProjectRecord {
      id: string;
      name: string;
      startDate?: Date | null;
      dueDate?: Date | null;
    }

    let project: ProjectRecord | null = null;
    let allTasks: TaskRecord[] = [];

    try {
      const dbProject = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, startDate: true, dueDate: true },
      });

      if (dbProject) {
        project = dbProject;
        const dbTasks = await prisma.task.findMany({
          where: { projectId },
          select: { id: true, status: true, createdAt: true, updatedAt: true, dueDate: true },
          orderBy: { createdAt: 'asc' },
        });
        allTasks = dbTasks;
      }
    } catch (dbErr) {
      console.warn('[GET /api/projects/:id/burndown] DB warning, using mock data:', dbErr);
    }

    // Fallback to mock data
    if (!project) {
      const mockProj = mockProjects.find(p => p.id === projectId);
      if (!mockProj) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: `Project "${projectId}" not found` } },
          { status: 404 }
        );
      }
      project = {
        id: mockProj.id,
        name: mockProj.name,
        startDate: mockProj.startDate ? new Date(mockProj.startDate) : null,
        dueDate: mockProj.dueDate ? new Date(mockProj.dueDate) : null,
      };
      allTasks = mockTasks
        .filter(t => t.projectId === projectId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((t: any) => ({
          id: t.id,
          status: t.status,
          createdAt: new Date(t.createdAt || Date.now()),
          updatedAt: new Date(t.updatedAt || Date.now()),
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
        }));
    }

    // Determine project date range
    const startDate = project.startDate ? new Date(project.startDate) : (() => {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d;
    })();
    startDate.setHours(0, 0, 0, 0);

    const dueDate = project.dueDate ? new Date(project.dueDate) : (() => {
      const d = new Date(now);
      d.setDate(d.getDate() + 30);
      return d;
    })();
    dueDate.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.round((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const totalTasks = allTasks.length;

    // Linear ideal burn: slope = totalTasks / totalDays
    const idealSlope = totalTasks / totalDays;

    // Calculate velocity (tasks completed in last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const completedLast7d = allTasks.filter(
      t => t.status === 'done' && t.updatedAt >= sevenDaysAgo
    ).length;
    const dailyVelocity = Math.max(completedLast7d / 7, 0.1);

    // Compute actual cumulative completed tasks by date
    // Using task updatedAt as completion timestamp when status = 'done'
    const completedTasks = allTasks.filter(t => t.status === 'done');
    const completionsByDate = new Map<string, number>();

    for (const task of completedTasks) {
      const dateKey = task.updatedAt.toISOString().split('T')[0];
      completionsByDate.set(dateKey, (completionsByDate.get(dateKey) || 0) + 1);
    }

    // Build daily series from startDate to max(dueDate, now) 
    const endDate = new Date(Math.max(dueDate.getTime(), now.getTime()));
    const series: BurndownDataPoint[] = [];

    let cumulativeCompleted = 0;
    const cursor = new Date(startDate);
    let dayIndex = 0;

    while (cursor <= endDate) {
      const dateKey = cursor.toISOString().split('T')[0];
      const dayCompletions = completionsByDate.get(dateKey) || 0;
      cumulativeCompleted += dayCompletions;

      // Ideal remaining at this point
      const ideal = Math.max(0, Math.round((totalTasks - idealSlope * dayIndex) * 100) / 100);

      // Actual remaining: only show for past/present dates
      const isPastOrToday = cursor <= now;
      const actual = isPastOrToday ? Math.max(0, totalTasks - cumulativeCompleted) : null;

      series.push({ date: dateKey, ideal, actual, completed: cumulativeCompleted });

      cursor.setDate(cursor.getDate() + 1);
      dayIndex++;
    }

    // Forecast completion date based on current velocity
    const remainingTasks = totalTasks - completedTasks.length;
    let forecastedCompletionDate: string | null = null;
    let daysUntilForecastedCompletion: number | null = null;

    if (remainingTasks > 0 && dailyVelocity > 0) {
      const daysNeeded = Math.ceil(remainingTasks / dailyVelocity);
      const forecastDate = new Date(now);
      forecastDate.setDate(forecastDate.getDate() + daysNeeded);
      forecastedCompletionDate = forecastDate.toISOString().split('T')[0];
      daysUntilForecastedCompletion = daysNeeded;
    } else if (remainingTasks === 0) {
      forecastedCompletionDate = now.toISOString().split('T')[0];
      daysUntilForecastedCompletion = 0;
    }

    const isOnTrack = forecastedCompletionDate !== null
      ? new Date(forecastedCompletionDate) <= dueDate
      : true;

    const result: BurndownResult = {
      projectId,
      projectName: project.name,
      startDate: startDate.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      totalTasks,
      completedTasks: completedTasks.length,
      velocityLast7Days: completedLast7d,
      forecastedCompletionDate,
      daysUntilForecastedCompletion,
      isOnTrack,
      series,
    };

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/projects/:id/burndown] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to compute burndown analytics' } },
      { status: 500 }
    );
  }
}
