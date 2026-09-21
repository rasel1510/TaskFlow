const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const taskCount = await prisma.task.count();
    const taskNumber = `TF-${String(taskCount + 1).padStart(3, '0')}`;

    const newTask = await prisma.task.create({
      data: {
        taskNumber,
        title: "My First PostgreSQL Task",
        projectId: "p1",
        status: "todo",
        priority: "high",
        description: "This task is stored in PostgreSQL database!",
        estimate: "2h",
        labels: [],
      },
      include: {
        assignee: true,
        project: true,
        subtasks: true,
      },
    });
    console.log("Success:", newTask);
  } catch (err) {
    console.error("Prisma Error:", err);
  }
}

main().finally(() => prisma.$disconnect());
