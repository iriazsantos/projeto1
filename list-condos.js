
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listCondos() {
  const condos = await prisma.condominium.findMany();
  console.log(JSON.stringify(condos, null, 2));
  await prisma.$disconnect();
}

listCondos();
