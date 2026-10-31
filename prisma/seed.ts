import { PrismaClient, Priority, Status, ProjectHealth } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  // Create Users
  const rasel = await prisma.user.upsert({
    where: { email: 'rasel@flowsync.io' },
    update: {},
    create: {
      name: 'Rasel Ahmed',
      avatar: 'RA',
      role: 'Product Manager',
      email: 'rasel@flowsync.io',
    },
  });

  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@flowsync.io' },
    update: {},
    create: {
      name: 'Sarah Chen',
      avatar: 'SC',
      role: 'Frontend Engineer',
      email: 'sarah@flowsync.io',
    },
  });

  const ahmed = await prisma.user.upsert({
    where: { email: 'ahmed@flowsync.io' },
    update: {},
    create: {
      name: 'Ahmed Malik',
      avatar: 'AM',
      role: 'Backend Engineer',
      email: 'ahmed@flowsync.io',
    },
  });

  // Create Project
  const project = await prisma.project.upsert({
    where: { id: 'proj-1' },
    update: {},
    create: {
      id: 'proj-1',
      name: 'FlowSync Platform v2',
      description: 'Core web application revamp with Next.js, shadcn/ui, and Prisma ORM.',
      color: '#2563EB',
      health: ProjectHealth.on_track,
      progress: 68,
      ownerId: rasel.id,
    },
  });

  // Create Initial Tasks
  await prisma.task.upsert({
    where: { id: 'task-1' },
    update: {},
    create: {
      id: 'task-1',
      taskNumber: 'TF-001',
      title: 'Design System & Token Migration',
      description: 'Implement shadcn/ui primitives and sync color variables.',
      status: Status.in_progress,
      priority: Priority.high,
      estimate: '6h',
      labels: ['Design', 'Frontend'],
      progress: 75,
      projectId: project.id,
      assigneeId: sarah.id,

    },
  });

  await prisma.task.upsert({
    where: { id: 'task-2' },
    update: {},
    create: {
      id: 'task-2',
      taskNumber: 'TF-002',
      title: 'Database Schema & Prisma ORM setup',
      description: 'Setup PostgreSQL models for users, projects, and tasks.',
      status: Status.done,
      priority: Priority.urgent,
      estimate: '4h',
      labels: ['Backend', 'Database'],
      progress: 100,
      projectId: project.id,
      assigneeId: ahmed.id,
    },
  });

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
