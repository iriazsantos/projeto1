import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'inovatech' },
    update: {
      password: '$2a$10$X8lOj03zJO6u.4vQkFIEu.ZQGtaCtBlyjTXKf99H1iJkk.0OH5cQ2',
      name: 'Inovatech',
      role: 'admin',
      active: true
    },
    create: {
      email: 'inovatech',
      password: '$2a$10$X8lOj03zJO6u.4vQkFIEu.ZQGtaCtBlyjTXKf99H1iJkk.0OH5cQ2',
      name: 'Inovatech',
      role: 'admin',
      active: true
    }
  });
  console.log('Usuário garantido:', user);
}

main().finally(() => prisma.$disconnect());
