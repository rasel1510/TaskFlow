import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/superadmin';

export async function GET() {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const [
      totalTeams,
      totalUsers,
      totalProjects,
      totalTasks,
      tasksByStatus,
      usersByPlan,
      teams,
      recentInvoices,
      totalInvoicesAmount,
    ] = await Promise.all([
      prisma.team.count(),
      prisma.user.count(),
      prisma.project.count(),
      prisma.task.count(),
      prisma.task.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.user.groupBy({
        by: ['plan'],
        _count: { id: true },
      }),
      prisma.team.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
          members: {
            select: {
              plan: true,
              subscriptionStatus: true,
            },
          },
        },
      }),
      prisma.invoice.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              team: { select: { name: true } },
            },
          },
        },
      }),
      prisma.invoice.aggregate({
        where: { status: 'paid' },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Calculate company tier distribution
    let proCompanies = 0;
    let freeCompanies = 0;
    teams.forEach(team => {
      const hasProMember = team.members.some(m => m.plan === 'pro');
      if (hasProMember) {
        proCompanies++;
      } else {
        freeCompanies++;
      }
    });

    const mrr = proCompanies * 20.0;
    const totalRevenue = totalInvoicesAmount._sum.amount ?? (proCompanies * 20.0);

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          totalCompanies: totalTeams,
          totalUsers,
          totalProjects,
          totalTasks,
          proCompanies,
          freeCompanies,
          mrr,
          totalRevenue,
          paidInvoicesCount: totalInvoicesAmount._count.id ?? 0,
        },
        taskBreakdown: tasksByStatus.reduce((acc, curr) => {
          acc[curr.status] = curr._count.id;
          return acc;
        }, {} as Record<string, number>),
        userPlanBreakdown: usersByPlan.reduce((acc, curr) => {
          acc[curr.plan] = curr._count.id;
          return acc;
        }, {} as Record<string, number>),
        recentInvoices,
        systemStatus: {
          database: 'healthy',
          provider: 'Neon PostgreSQL',
          software: 'FlowSync SaaS Platform',
          ownerCompany: 'FlowSync',
          superAdmin: authCheck.user?.email,
          serverTime: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[Admin Metrics Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to aggregate platform metrics' } },
      { status: 500 }
    );
  }
}

