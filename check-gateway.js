import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function checkGatewayConfig() {
  console.log('Checking Master Gateway Config...\n');

  const config = await prisma.masterGatewayConfig.findUnique({
    where: { id: 'master' }
  });

  if (config) {
    console.log('Found config:');
    console.log('- Provider:', config.provider);
    console.log('- Environment:', config.environment);
    console.log('- API Key starts with:', config.credentials.substring(0, 15) + '...');
    console.log('- API Key length:', config.credentials.length);
    console.log('- Is Active:', config.isActive);
    console.log('- Last Health Check:', config.lastHealthCheck);
    console.log('- Last Successful Charge:', config.lastSuccessfulCharge);
  } else {
    console.log('No master gateway config found!');
  }
}

checkGatewayConfig()
  .then(() => prisma.$disconnect())
  .catch(console.error);