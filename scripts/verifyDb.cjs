const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const projects = await prisma.project.count();
  const tasks = await prisma.task.count();
  console.log(JSON.stringify({ users, projects, tasks }));
}

main().finally(() => prisma.$disconnect());
