const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
  const users = [
    { id: 'u1', name: 'Rasel Ahmed', avatar: 'RA', role: 'Product Manager', email: 'rasel@flowsync.io' },
    { id: 'u2', name: 'Sarah Chen', avatar: 'SC', role: 'Frontend Engineer', email: 'sarah@flowsync.io' },
    { id: 'u3', name: 'Ahmed Malik', avatar: 'AM', role: 'Backend Engineer', email: 'ahmed@flowsync.io' },
    { id: 'u4', name: 'John Torres', avatar: 'JT', role: 'QA Engineer', email: 'john@flowsync.io' },
    { id: 'u5', name: 'Maria Lopez', avatar: 'ML', role: 'UI Designer', email: 'maria@flowsync.io' },
    { id: 'u6', name: 'David Kim', avatar: 'DK', role: 'DevOps Engineer', email: 'david@flowsync.io' },
  ];

  for (const u of users) {
    // Check if user exists by ID first, or by email
    const existingById = await prisma.user.findUnique({ where: { id: u.id } });
    if (existingById) {
      await prisma.user.update({
        where: { id: u.id },
        data: { name: u.name, avatar: u.avatar, role: u.role }
      });
    } else {
      const existingByEmail = await prisma.user.findUnique({ where: { email: u.email } });
      if (existingByEmail) {
        await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { name: u.name, avatar: u.avatar, role: u.role }
        });
      } else {
        await prisma.user.create({
          data: { id: u.id, name: u.name, avatar: u.avatar, role: u.role, email: u.email }
        });
      }
    }
  }

  // Seed users from users.json if any
  if (fs.existsSync('src/data/users.json')) {
    const customUsers = JSON.parse(fs.readFileSync('src/data/users.json', 'utf8'));
    for (const u of customUsers) {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ id: u.id }, { email: u.email }] }
      });
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { password: u.password, role: u.role, name: u.name }
        });
      } else {
        await prisma.user.create({
          data: { id: u.id, name: u.name, avatar: u.avatar || 'US', role: u.role, email: u.email, password: u.password }
        });
      }
    }
  }

  // Seed standard projects
  await prisma.project.upsert({
    where: { id: 'p1' },
    update: {},
    create: { id: 'p1', name: 'Website Redesign', description: 'Complete overhaul of marketing website', color: '#2563EB', ownerId: 'u2' }
  });
  await prisma.project.upsert({
    where: { id: 'p2' },
    update: {},
    create: { id: 'p2', name: 'Mobile App v2.0', description: 'Native mobile app rewrite', color: '#7C3AED', ownerId: 'u3' }
  });
  await prisma.project.upsert({
    where: { id: 'p3' },
    update: {},
    create: { id: 'p3', name: 'Research Portal', description: 'Internal knowledge base and research platform', color: '#059669', ownerId: 'u1' }
  });

  console.log('Seeded users and projects successfully.');
}

run()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
