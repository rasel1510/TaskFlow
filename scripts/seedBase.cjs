const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
  const rasel = await prisma.user.upsert({
    where: { email: 'rasel@taskflow.io' },
    update: {},
    create: { id: 'u1', name: 'Rasel Ahmed', avatar: 'RA', role: 'Product Manager', email: 'rasel@taskflow.io' }
  });
  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@taskflow.io' },
    update: {},
    create: { id: 'u2', name: 'Sarah Chen', avatar: 'SC', role: 'Frontend Engineer', email: 'sarah@taskflow.io' }
  });
  const ahmed = await prisma.user.upsert({
    where: { email: 'ahmed@taskflow.io' },
    update: {},
    create: { id: 'u3', name: 'Ahmed Malik', avatar: 'AM', role: 'Backend Engineer', email: 'ahmed@taskflow.io' }
  });

  // Seed users from users.json if any
  if (fs.existsSync('src/data/users.json')) {
    const customUsers = JSON.parse(fs.readFileSync('src/data/users.json', 'utf8'));
    for (const u of customUsers) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: { password: u.password, role: u.role, name: u.name },
        create: { id: u.id, name: u.name, avatar: u.avatar || 'US', role: u.role, email: u.email, password: u.password }
      });
    }
  }

  // Seed standard projects
  await prisma.project.upsert({
    where: { id: 'p1' },
    update: {},
    create: { id: 'p1', name: 'Website Redesign', description: 'Complete overhaul of marketing website', color: '#2563EB', ownerId: sarah.id }
  });
  await prisma.project.upsert({
    where: { id: 'p2' },
    update: {},
    create: { id: 'p2', name: 'Mobile App v2.0', description: 'Native mobile app rewrite', color: '#7C3AED', ownerId: ahmed.id }
  });
  await prisma.project.upsert({
    where: { id: 'p3' },
    update: {},
    create: { id: 'p3', name: 'Research Portal', description: 'Internal knowledge base and research platform', color: '#059669', ownerId: rasel.id }
  });

  console.log('Seeded users and projects successfully.');
}

run()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
