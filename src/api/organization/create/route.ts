import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();

    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid organization or company name (min 2 characters)' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: session.user.id ? { id: session.user.id } : { email: session.user.email! },
      include: { team: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    // Create Team
    let team = await prisma.team.create({
      data: {
        name,
        slug: uniqueSlug,
      },
    });

    // Update User with new team, Admin role, and mark onboarding as complete
    await prisma.user.update({
      where: { id: user.id },
      data: {
        teamId: team.id,
        role: 'Admin',
        hasCompletedOnboarding: true,
      },
    });

    // Seed default starter project for the new organization
    try {
      const defaultProject = await prisma.project.create({
        data: {
          name: `${name} — Product Roadmap`,
          description: `Core roadmap and task tracking for ${name}`,
          color: '#2563EB',
          progress: 35,
          ownerId: user.id,
          teamId: team.id,
          tasks: {
            create: [
              {
                title: `Welcome to ${name} on FlowSync`,
                description: 'Explore your Kanban boards, invite team members, and connect GitHub or Slack.',
                status: 'done',
                priority: 'medium',
                creatorId: user.id,
                assigneeId: user.id,
              },
              {
                title: 'Set up company sprints & milestones',
                description: 'Define your quarterly OKRs and project deliverables.',
                status: 'in_progress',
                priority: 'high',
                creatorId: user.id,
                assigneeId: user.id,
              },
              {
                title: 'Invite coworkers & team leads',
                description: 'Send invitations from Team Settings to collaborate in real-time.',
                status: 'todo',
                priority: 'urgent',
                creatorId: user.id,
                assigneeId: user.id,
              },
            ],
          },
        },
      });

      // Add user as project member
      await prisma.projectMember.create({
        data: {
          projectId: defaultProject.id,
          userId: user.id,
          role: 'OWNER',
        },
      });
    } catch (projectSeedError) {
      console.warn('Could not seed default starter project:', projectSeedError);
    }

    return NextResponse.json({
      success: true,
      data: {
        teamId: team.id,
        teamName: team.name,
        redirectUrl: '/app',
        message: 'Organization created successfully! Redirecting to your dashboard...',
      },
    });
  } catch (err: any) {
    console.error('POST /api/organization/create error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create organization. Please try again.' },
      { status: 500 }
    );
  }
}
