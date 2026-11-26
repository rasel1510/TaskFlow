import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { hasActivePlan } from '@/lib/billing';
import { stripe } from '@/lib/stripe';
import { switchWorkspace } from '@/lib/workspaces';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    // Company type: "software" switches on the Software Company suite; anything else is "general"
    const workspaceType = body.workspaceType === 'software' ? 'software' : 'general';
    const industry = typeof body.industry === 'string' ? body.industry.trim().slice(0, 80) || null : null;

    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid organization or company name (min 2 characters)' },
        { status: 400 }
      );
    }
    // "FlowSync" is reserved for the platform owner's organization
    if (name.replace(/\s+/g, '').toLowerCase() === 'flowsync') {
      return NextResponse.json({ success: false, error: 'That name is reserved. Please choose another name.' }, { status: 400 });
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
    // A new team is created from the Personal workspace (its plan was chosen there). From inside a
    // company, the open plan belongs to that company and must not be reused for a new team.
    const openTeam = user.teamId
      ? await prisma.team.findUnique({ where: { id: user.teamId }, select: { kind: true } })
      : null;
    if (openTeam?.kind === 'company') {
      return NextResponse.json(
        { success: false, error: 'Switch to your personal workspace to create a new team.', alreadyOnboarded: true },
        { status: 409 }
      );
    }

    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    // Create the company with the plan chosen for it; the creator is its first Admin.
    // DO NOT seed any default tasks or projects — company workspace starts 100% fresh & empty
    const plan = user.plan === 'pro' ? 'pro' : 'basic';
    const team = await prisma.team.create({
      data: {
        name,
        slug: uniqueSlug,
        kind: 'company',
        workspaceType,
        industry,
        plan,
        ...(plan === 'pro' ? { billingUserId: user.id } : {}),
        memberships: {
          create: { userId: user.id, role: 'Admin', ...(workspaceType === 'software' ? { department: 'leadership', jobTitle: 'CEO / Founder' } : {}) },
        },
      },
    });
    await prisma.user.update({ where: { id: user.id }, data: { pendingTeamPlan: null } });
    // Open the new company (sets role Admin and mirrors its plan)
    await switchWorkspace(user.id, team.id);

    // Tag the Pro subscription that paid for this team, so renewals keep it on Pro (best effort)
    if (plan === 'pro' && user.stripeCustomerId) {
      try {
        const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'active', limit: 10 });
        const untagged = subs.data.find(sub => !sub.metadata?.teamId);
        if (untagged) await stripe.subscriptions.update(untagged.id, { metadata: { ...untagged.metadata, teamId: team.id } });
      } catch (err) {
        console.warn('[organization/create] Could not tag the subscription with the new team:', (err as Error)?.message);
      }
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
