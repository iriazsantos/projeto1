
import { PrismaClient } from '@prisma/client';
import { createGatewayIntegration } from './server/gateway-integrations.js';

const prisma = new PrismaClient();

async function testCreatePayment() {
  try {
    console.log('--- TESTE DE CRIAÇÃO DE PAGAMENTO ---');
    
    // 1. Verificar se existe algum condomínio
    const condo = await prisma.condominium.findFirst();
    if (!condo) {
      console.error('Nenhum condomínio encontrado no banco.');
      return;
    }
    console.log('Condomínio:', condo.name, '(', condo.id, ')');

    // 2. Verificar gateway config
    const config = await prisma.gatewayConfig.findFirst({
      where: { condominiumId: condo.id, isActive: true }
    });
    
    if (!config) {
      console.warn('⚠️ Nenhum gateway configurado para este condomínio. Teste não pode prosseguir.');
      return;
    }
    console.log('Gateway Configurado:', config.provider, 'na', config.environment);

    // 3. Simular dados de cobrança
    const chargeData = {
      condoId: condo.id,
      amount: 1.00,
      customerName: 'Teste de Diagnóstico',
      customerEmail: 'teste@inovatech.com',
      customerCpf: '12345678901',
      method: 'pix',
      description: 'Teste de integração'
    };

    console.log('Enviando dados para criação...');
    
    // 4. Instanciar gateway
    const gateway = createGatewayIntegration(config.provider, config.credentials, config.environment);
    
    // 5. Preparar dados
    const gatewayData = {
      value: chargeData.amount,
      description: chargeData.description,
      customerName: chargeData.customerName,
      customerEmail: chargeData.customerEmail,
      customerCpf: chargeData.customerCpf,
      billingType: 'PIX',
      externalReference: `TEST-${Date.now()}`
    };

    console.log('Chamando gateway.createPixCharge...');
    const result = await gateway.createPixCharge(gatewayData);
    console.log('✅ Sucesso no Gateway!');
    console.log('ID Cobrança:', result.id);
    console.log('Pix Code:', result.pixCode);

  } catch (err) {
    console.error('❌ ERRO NO DIAGNÓSTICO:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testCreatePayment();
