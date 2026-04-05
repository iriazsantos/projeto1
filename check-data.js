import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  console.log('=== CONDOMÍNIOS ===');
  const condos = await prisma.condominium.findMany({
    select: {
      id: true,
      name: true,
      units: true,
    }
  });
  console.log(condos);

  console.log('\n=== USUÁRIOS ===');
  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      condoId: true,
      unit: true
    }
  });
  console.log(users);

  console.log('\n=== CONTAGEM POR CONDOMÍNIO ===');
  for (const condo of condos) {
    const count = await prisma.user.count({
      where: { condoId: condo.id, active: true }
    });
    const units = await prisma.user.groupBy({
      by: ['unit'],
      where: { condoId: condo.id, active: true, unit: { not: null } }
    });
    console.log(`${condo.name}: ${count} usuários, ${units.length} unidades`);
  }
}

checkData()
  .then(() => prisma.$disconnect())
  .catch(console.error);