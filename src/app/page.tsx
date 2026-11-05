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
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const taskId = searchParams?.task || searchParams?.taskId;
  const projectId = searchParams?.projectId;

  const queryParts: string[] = [];
  if (taskId && typeof taskId === 'string') queryParts.push(`task=${encodeURIComponent(taskId)}`);
  if (projectId && typeof projectId === 'string') queryParts.push(`projectId=${encodeURIComponent(projectId)}`);
  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  // Only redirect if an explicit deep link was accessed (e.g. /?task=123 or /?projectId=456)
  if (queryString) {
    const session = await auth();
    if (session?.user) {
      redirect(`/app${queryString}`);
    } else {
      redirect(`/auth/login?callbackUrl=${encodeURIComponent(`/app${queryString}`)}`);
    }
  }

  // Root homepage ("/") displays the clean, professional Landing Page
  return <LandingPage />;
}
