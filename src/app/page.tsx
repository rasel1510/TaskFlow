import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import LandingPage from '@/views/LandingPage';

export const metadata: Metadata = {
  title: 'FlowSync — Simple & Professional Project Management',
  description:
    'Plan project roadmaps, track tasks on fluid Kanban boards, organize sprints with calendar views, and manage deliverables with zero cognitive clutter.',
  openGraph: {
    title: 'FlowSync — Simple & Professional Project Management',
    description: 'Plan project roadmaps, track tasks on fluid Kanban boards, and organize sprints.',
  },
};

export default async function HomePage() {
  const session = await auth();

  // If already authenticated, redirect straight to the workspace
  if (session?.user) {
    redirect('/app');
  }

  return <LandingPage />;
}
