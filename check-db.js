
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDb() {
  try {
    console.log('--- DB CHECK ---');
    const configs = await prisma.gatewayConfig.findMany();
    console.log('GatewayConfigs Count:', configs.length);
    configs.forEach(c => {
      console.log(`ID: ${c.id}, Provider: ${c.provider}, CondoId: ${c.condominiumId}, Active: ${c.isActive}`);
    });

    const condos = await prisma.condominium.findMany();
    console.log('Condos Count:', condos.length);
    condos.forEach(c => {
      console.log(`ID: ${c.id}, Name: ${c.name}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDb();
