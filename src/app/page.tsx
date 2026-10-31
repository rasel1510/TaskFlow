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

export default async function HomePage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const taskId = searchParams?.task || searchParams?.taskId;
  const projectId = searchParams?.projectId;

  const queryParts: string[] = [];
  if (taskId && typeof taskId === 'string') queryParts.push(`task=${encodeURIComponent(taskId)}`);
  if (projectId && typeof projectId === 'string') queryParts.push(`projectId=${encodeURIComponent(projectId)}`);
  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  // If already authenticated, redirect straight to the workspace preserving deep links
  if (session?.user) {
    redirect(`/app${queryString}`);
  }

  // If not authenticated and a deep link was accessed, prompt login and return back
  if (queryString) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(`/app${queryString}`)}`);
  }

  return <LandingPage />;
}
