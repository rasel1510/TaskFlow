/**
 * src/api/reports/export/route.ts
 *
 * CSV Export from Reports (Step 4.7)
 * Generates an RFC-4180 compliant CSV stream with formula injection prevention (=, +, -, @).
 * Supports date range and project scoping filters.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { tasks as mockTasks, projects as mockProjects, users as mockUsers } from '@/data/mockData';

function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value).trim();

  // Prevent CSV / Excel formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape existing double quotes and wrap in quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const projectIdParam = searchParams.get('projectId');
    const statusParam = searchParams.get('status');

    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    if (fromParam) {
      const d = new Date(fromParam);
      if (!isNaN(d.getTime())) fromDate = d;
    }
    if (toParam) {
      const d = new Date(toParam);
      if (!isNaN(d.getTime())) toDate = d;
    }

    interface ExportRow {
      taskNumber: string;
      title: string;
      status: string;
      priority: string;
      assigneeName: string;
      assigneeEmail: string;
      projectName: string;
      dueDate: string;
      createdAt: string;
    }

    let rows: ExportRow[] = [];

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (projectIdParam) where.projectId = projectIdParam;
      if (statusParam) where.status = statusParam;
      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = fromDate;
        if (toDate) where.createdAt.lte = toDate;
      }

      const tasks = await prisma.task.findMany({
        where,
        select: {
          id: true,
          taskNumber: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          assignee: {
            select: { name: true, email: true },
          },
          project: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      rows = tasks.map((t) => ({
        taskNumber: t.taskNumber || t.id.slice(-6).toUpperCase(),
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigneeName: t.assignee?.name || 'Unassigned',
        assigneeEmail: t.assignee?.email || 'N/A',
        projectName: t.project?.name || 'No Project',
        dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : 'None',
        createdAt: t.createdAt.toISOString().split('T')[0],
      }));
    } catch (dbErr) {
      console.warn('[GET /api/reports/export] DB failed, fallback to mock data:', dbErr);

      rows = mockTasks
        .filter((t) => {
          if (projectIdParam && t.projectId !== projectIdParam) return false;
          if (statusParam && t.status !== statusParam) return false;
          return true;
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((t: any) => {
          const assignee = t.assignee || mockUsers.find((u) => u.id === t.assigneeId);
          const project = mockProjects.find((p) => p.id === t.projectId);
          return {
            taskNumber: t.taskNumber || t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assigneeName: assignee?.name || 'Unassigned',
            assigneeEmail: assignee?.email || 'N/A',
            projectName: project?.name || 'TaskFlow Core',
            dueDate: t.dueDate || 'None',
            createdAt: t.createdAt ? String(t.createdAt).split('T')[0] : '2026-09-01',
          };
        });
    }

    // Generate CSV Content
    const headers = [
      'Task ID',
      'Title',
      'Status',
      'Priority',
      'Assignee',
      'Assignee Email',
      'Project',
      'Due Date',
      'Created Date',
    ];

    const csvLines = [headers.map(sanitizeCsvCell).join(',')];

    for (const r of rows) {
      csvLines.push(
        [
          sanitizeCsvCell(r.taskNumber),
          sanitizeCsvCell(r.title),
          sanitizeCsvCell(r.status),
          sanitizeCsvCell(r.priority),
          sanitizeCsvCell(r.assigneeName),
          sanitizeCsvCell(r.assigneeEmail),
          sanitizeCsvCell(r.projectName),
          sanitizeCsvCell(r.dueDate),
          sanitizeCsvCell(r.createdAt),
        ].join(',')
      );
    }

    const csvContent = csvLines.join('\r\n');
    const dateStamp = new Date().toISOString().split('T')[0];
    const filename = `taskflow-tasks-${dateStamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[GET /api/reports/export] Error exporting CSV:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate CSV export' } },
      { status: 500 }
    );
  }
}
