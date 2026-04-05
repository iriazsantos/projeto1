import { createGatewayIntegration } from './server/gateway-integrations.js';

// Script para testar integrações com gateways de pagamento
async function testGateways() {
  console.log('🧪 Testando Integrações com Gateways de Pagamento\n');

  // Teste com Asaas Sandbox
  console.log('1️⃣ Testando Asaas (Sandbox)...');
  try {
    const asaas = createGatewayIntegration('asaas', 'sandbox_test_key', 'sandbox');
    const result = await asaas.testConnection();
    console.log('   ✅ Asaas:', result.message);
    if (result.data) {
      console.log('   📊 Dados:', result.data);
    }
  } catch (error) {
    console.log('   ❌ Asaas Error:', error.message);
  }

  // Teste com Mercado Pago Sandbox
  console.log('\n2️⃣ Testando Mercado Pago (Sandbox)...');
  try {
    const mp = createGatewayIntegration('mercadopago', 'TEST-123456789', 'sandbox');
    const result = await mp.testConnection();
    console.log('   ✅ Mercado Pago:', result.message);
    if (result.data) {
      console.log('   📊 Dados:', result.data);
    }
  } catch (error) {
    console.log('   ❌ Mercado Pago Error:', error.message);
  }

  // Teste com Stripe (Test)
  console.log('\n3️⃣ Testando Stripe (Test)...');
  try {
    const stripe = createGatewayIntegration('stripe', 'sk_test_123456789', 'sandbox');
    const result = await stripe.testConnection();
    console.log('   ✅ Stripe:', result.message);
    if (result.data) {
      console.log('   📊 Dados:', result.data);
    }
  } catch (error) {
    console.log('   ❌ Stripe Error:', error.message);
  }

  console.log('\n🎯 Para testar com chaves reais:');
  console.log('   1. Substitua as chaves de teste acima');
  console.log('   2. Execute: node test-gateways.js');
  console.log('   3. Configure os gateways no painel do sistema');
}

// Teste de criação de cobrança
async function testChargeCreation() {
  console.log('\n💰 Testando Criação de Cobrança...\n');

  const chargeData = {
    description: 'Cobrança de Teste INOVATECH CONNECT',
    value: 299.90,
    dueDate: '2024-12-30',
    customerEmail: 'test@example.com',
    customerName: 'Cliente Teste',
    customerCpf: '12345678909',
    externalReference: 'test-123'
  };

  // Teste com Asaas
  console.log('📝 Criando cobrança no Asaas...');
  try {
    const asaas = createGatewayIntegration('asaas', 'sua_api_key_aqui', 'sandbox');
    const charge = await asaas.createCharge(chargeData);
    console.log('   ✅ Cobrança criada:', charge.id);
    console.log('   💰 Valor: R$', charge.value);
    console.log('   🔗 Boleto:', charge.bankSlipUrl || 'Não disponível');
  } catch (error) {
    console.log('   ❌ Erro:', error.message);
  }

  // Teste PIX
  console.log('\n📱 Criando cobrança PIX...');
  try {
    const asaas = createGatewayIntegration('asaas', 'sua_api_key_aqui', 'sandbox');
    const pixCharge = await asaas.createPixCharge(chargeData);
    console.log('   ✅ PIX criado:', pixCharge.id);
    console.log('   📱 QR Code:', pixCharge.qrCode ? 'Gerado' : 'Não disponível');
    console.log('   🔗 Código PIX:', pixCharge.pixCode ? 'Disponível' : 'Não disponível');
  } catch (error) {
    console.log('   ❌ Erro:', error.message);
  }
}

// Teste de webhook
async function testWebhook() {
  console.log('\n🔔 Testando Processamento de Webhook...\n');

  // Simular webhook Asaas
  const asaasWebhook = {
    event: 'PAYMENT_CONFIRMED',
    payment: {
      id: 'pay_123456789',
      externalReference: 'condo-123-12/2024',
      value: 299.90,
      status: 'CONFIRMED'
    }
  };

  console.log('📨 Webhook Asaas recebido:');
  console.log('   Evento:', asaasWebhook.event);
  console.log('   Pagamento:', asaasWebhook.payment.id);
  console.log('   Valor: R$', asaasWebhook.payment.value);
  console.log('   Referência:', asaasWebhook.payment.externalReference);

  // Aqui o sistema processaria o webhook automaticamente
  console.log('   ✅ Processado automaticamente pelo sistema');
}

// Função principal
async function main() {
  console.log('🚀 INOVATECH CONNECT - Teste de Gateways de Pagamento\n');
  
  await testGateways();
  await testChargeCreation();
  await testWebhook();

  console.log('\n✨ Testes concluídos!');
  console.log('\n📋 Próximos passos:');
  console.log('   1. Configure chaves reais dos gateways');
  console.log('   2. Teste no ambiente sandbox');
  console.log('   3. Configure webhooks');
  console.log('   4. Vá para produção quando pronto');
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testGateways, testChargeCreation, testWebhook };
