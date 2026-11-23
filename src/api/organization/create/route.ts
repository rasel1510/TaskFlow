import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { hasActivePlan } from '@/lib/billing';

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

    // A company can only be set up on Pro (verified Stripe payment) or the free Basic plan
    if (!hasActivePlan(user.plan)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Choose a plan first. Pro is activated only after your Stripe payment succeeds.',
          requiresPayment: true,
        },
        { status: 402 }
      );
    }
    if (user.teamId) {
      return NextResponse.json(
        { success: false, error: 'Your company is already set up.', alreadyOnboarded: true },
        { status: 409 }
      );
    }

    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    // Create Team
    const team = await prisma.team.create({
      data: {
        name,
        slug: uniqueSlug,
      },
    });

    // Update User with new team, Admin role, and mark onboarding as complete
    // DO NOT seed any default tasks or projects — company workspace starts 100% fresh & empty
    await prisma.user.update({
      where: { id: user.id },
      data: {
        teamId: team.id,
        role: 'Admin',
        hasCompletedOnboarding: true,
      },
    });

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
