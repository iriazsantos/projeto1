
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const apiKey = '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmJhNjc0ZTdhLTBjZDgtNDU0Zi1hYzNkLTc2N2NmNDM1ZDU2YTo6JGFhY2hfYTBiYzA0MDAtOWEyNS00NjY0LTgyMjUtYmVjMzlhMGQ3NzU5';

async function applyKey() {
  try {
    console.log('Aplicando chave de produção...');
    
    // 1. Atualizar ou Criar Master Gateway Config
    await prisma.masterGatewayConfig.upsert({
      where: { id: 'master' },
      update: {
        provider: 'asaas',
        credentials: apiKey,
        environment: 'production',
        isActive: true,
        updatedAt: new Date(),
        lastHealthCheck: new Date()
      },
      create: {
        id: 'master',
        name: 'Master Gateway Production',
        provider: 'asaas',
        credentials: apiKey,
        environment: 'production',
        isActive: true
      }
    });
    console.log('✅ MasterGatewayConfig atualizado.');

    // 2. Atualizar ou Criar Gateway Config para o condomínio alegro (crkg4115g)
    await prisma.gatewayConfig.upsert({
      where: {
        provider_condominiumId: {
          provider: 'asaas',
          condominiumId: 'crkg4115g'
        }
      },
      update: {
        credentials: apiKey,
        environment: 'production',
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        provider: 'asaas',
        credentials: apiKey,
        environment: 'production',
        condominiumId: 'crkg4115g',
        isActive: true,
        name: 'Asaas Production'
      }
    });
    console.log('✅ GatewayConfig (Alegro) atualizado.');

    // 3. Atualizar status para conectado
    await prisma.gatewayStatus.upsert({
      where: {
        provider_condominiumId: {
          provider: 'asaas',
          condominiumId: 'crkg4115g'
        }
      },
      update: {
        isConnected: true,
        lastHealthCheck: new Date(),
        lastSuccessfulRequest: new Date()
      },
      create: {
        provider: 'asaas',
        condominiumId: 'crkg4115g',
        isConnected: true,
        lastHealthCheck: new Date(),
        lastSuccessfulRequest: new Date()
      }
    });
    console.log('✅ GatewayStatus atualizado para CONECTADO.');

  } catch (err) {
    console.error('Erro ao aplicar chave:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

applyKey();
