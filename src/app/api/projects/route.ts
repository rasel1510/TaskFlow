import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { projects as mockProjects } from '@/data/mockData';

export async function GET() {
  try {
    const dbProjects = await prisma.project.findMany({
      include: {
        owner: true,
        tasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (dbProjects && dbProjects.length > 0) {
      return NextResponse.json(dbProjects);
    }
    return NextResponse.json(mockProjects);
  } catch {
    return NextResponse.json(mockProjects);
  }
}
