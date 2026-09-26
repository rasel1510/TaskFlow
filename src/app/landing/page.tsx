import type { Metadata } from 'next';
import LandingPage from '@/views/LandingPage';

export const metadata: Metadata = {
  title: 'TaskFlow — Simple & Professional Project Management',
  description:
    'Plan project roadmaps, track tasks on fluid Kanban boards, organize sprints with calendar views, and manage deliverables with zero cognitive clutter.',
  openGraph: {
    title: 'TaskFlow — Simple & Professional Project Management',
    description: 'Plan project roadmaps, track tasks on fluid Kanban boards, and organize sprints.',
  },
};

export default function LandingPageRoute() {
  return <LandingPage />;
}
