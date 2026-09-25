import type { Metadata } from 'next';
import LandingPage from '@/views/LandingPage';

export const metadata: Metadata = {
  title: 'FlowSync — Next-Gen Project & Task Management',
  description:
    'Sub-50ms task execution, fluid Kanban boards, native Gantt timelines, bidirectional calendar sync, and true offline PWA capability for high-velocity teams.',
  openGraph: {
    title: 'FlowSync — Modern Project & Task Management',
    description: 'Sub-50ms task execution, fluid Kanban boards, native Gantt timelines, and offline PWA capability.',
  },
};

export default function LandingPageRoute() {
  return <LandingPage />;
}
