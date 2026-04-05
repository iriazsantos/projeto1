
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMaster() {
  const masters = await prisma.masterGatewayConfig.findMany();
  console.log('MasterConfigs:', JSON.stringify(masters, null, 2));
  await prisma.$disconnect();
}

checkMaster();
