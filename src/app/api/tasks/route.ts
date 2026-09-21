import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { tasks as mockTasks } from '@/data/mockData';

export async function GET() {
  try {
    const dbTasks = await prisma.task.findMany({
      include: {
        assignee: true,
        project: true,
        subtasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (dbTasks && dbTasks.length > 0) {
      return NextResponse.json(dbTasks);
    }
    return NextResponse.json(mockTasks);
  } catch {
    // If PostgreSQL is not connected yet, gracefully fallback to mock data
    return NextResponse.json(mockTasks);
  }
}
