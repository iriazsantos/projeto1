import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createGatewayIntegration } from '../gateway-integrations.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();
const PAYMENT_METHODS = ['pix', 'boleto', 'credit_card', 'debit_card'];

function normalizePaymentMethod(value) {
  const method = String(value || 'pix').trim().toLowerCase();
  return PAYMENT_METHODS.includes(method) ? method : null;
}

function mapMethodToBillingType(method) {
  switch (method) {
    case 'pix':
      return 'PIX';
    case 'boleto':
      return 'BOLETO';
    case 'debit_card':
      return 'DEBIT_CARD';
    case 'credit_card':
    default:
      return 'CREDIT_CARD';
  }
}

// ─── GATEWAY CONFIG ROUTES ──────────────────────────────────────────────────────

// POST /api/gateway/configs - Salvar/atualizar configuração do gateway
router.post('/configs', express.json(), authMiddleware, async (req, res) => {
  try {
    const { provider, apiKey, environment = 'sandbox', webhookSecret, condoId: bodyCondoId } = req.body;
    const user = req.user;
    
    // Multi-tenancy check: sindicos only manage their own condo
    const condoId = user.role === 'admin-master' ? bodyCondoId : user.condoId;

    if (!provider || !apiKey || !condoId) {
      return res.status(400).json({ error: 'provider, apiKey e condoId são obrigatórios' });
    }

    // Testar conexão antes de salvar
    try {
      const gateway = createGatewayIntegration(provider, apiKey, environment);
      const testResult = await gateway.testConnection();
      
      if (!testResult.connected) {
        return res.status(400).json({ 
          error: 'Falha ao conectar com o gateway',
          details: testResult.message 
        });
      }
    } catch (error) {
      return res.status(400).json({ 
        error: 'Erro ao testar conexão',
        details: error.message 
      });
    }

    // Salvar configuração
    const now = new Date();
    const [, config] = await prisma.$transaction([
      prisma.gatewayConfig.updateMany({
        where: { condominiumId: condoId, isActive: true },
        data: {
          isActive: false,
          updatedAt: now
        }
      }),
      prisma.gatewayConfig.upsert({
        where: {
          provider_condominiumId: {
            provider,
            condominiumId: condoId
          }
        },
        update: {
          credentials: apiKey,
          webhookSecret: webhookSecret || null,
          environment,
          isActive: true,
          updatedAt: now
        },
        create: {
          provider,
          credentials: apiKey,
          webhookSecret: webhookSecret || null,
          environment,
          condominiumId: condoId,
          isActive: true,
          name: provider === 'asaas' ? 'Asaas' : provider === 'mercadopago' ? 'Mercado Pago' : 'Stripe'
        }
      })
    ]);

    res.json({ 
      success: true, 
      config,
      message: `Gateway ${provider} configurado com sucesso!` 
    });
  } catch (error) {
    console.error('Erro ao salvar config gateway:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gateway/configs - Listar configurações do condomínio
router.get('/configs', authMiddleware, async (req, res) => {
  try {
    const { condoId: queryCondoId } = req.query;
    const user = req.user;
    
    // Multi-tenancy check
    const condoId = user.role === 'admin-master' ? queryCondoId : user.condoId;
    
    if (!condoId) {
      return res.status(400).json({ error: 'condoId é obrigatório' });
    }

    const configs = await prisma.gatewayConfig.findMany({
      where: { 
        condominiumId: condoId,
        isActive: true 
      },
      select: {
        id: true,
        provider: true,
        name: true,
        environment: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({ success: true, configs });
  } catch (error) {
    console.error('Erro ao listar configs:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gateway/test-connection - Testar conexão sem salvar
router.post('/test-connection', express.json(), authMiddleware, async (req, res) => {
  try {
    const { provider, apiKey, environment = 'sandbox' } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'provider e apiKey são obrigatórios' });
    }

    const gateway = createGatewayIntegration(provider, apiKey, environment);
    const startTime = Date.now();
    const testResult = await gateway.testConnection();
    const latency = Date.now() - startTime;
    
    if (testResult.connected) {
      return res.json({ connected: true, latency });
    } else {
      return res.status(400).json({ 
        connected: false, 
        message: testResult.message || 'Falha na conexão com o gateway' 
      });
    }
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    res.status(500).json({ connected: false, message: error.message });
  }
});

// ─── PAYMENT CREATION ROUTES ────────────────────────────────────────────────────


// POST /api/gateway/create-payment - Criar novo pagamento
router.post('/create-payment', express.json(), authMiddleware, async (req, res) => {
  try {
    const { 
      condoId: bodyCondoId,
      invoiceId,
      amount, 
      description, 
      customerName, 
      customerEmail, 
      customerCpf, 
      method = 'pix'
    } = req.body;
    const user = req.user;
    const normalizedMethod = normalizePaymentMethod(method);

    // Multi-tenancy check
    const condoId = user.role === 'admin-master' ? bodyCondoId : user.condoId;

    // Validacoes
    if (!condoId || !amount || !customerEmail || !customerName || !customerCpf) {
      return res.status(400).json({
        error: 'condoId, amount, customerName, customerEmail e customerCpf sao obrigatorios'
      });
    }

    if (!normalizedMethod) {
      return res.status(400).json({
        error: 'Metodo de pagamento invalido. Use pix, boleto, credit_card ou debit_card'
      });
    }

    // Buscar configuração do gateway ativo
    const gatewayConfig = await prisma.gatewayConfig.findFirst({
      where: {
        condominiumId: condoId,
        isActive: true
      }
    });

    if (!gatewayConfig) {
      return res.status(400).json({ 
        error: 'Nenhum gateway configurado para este condomínio' 
      });
    }

    // Criar instância do gateway
    const gateway = createGatewayIntegration(
      gatewayConfig.provider, 
      gatewayConfig.credentials,
      gatewayConfig.environment
    );

    // Preparar dados para o gateway
    const chargeData = {
      value: parseFloat(amount),
      description: description || `Cobrança INOVATECH CONNECT - ${new Date().toLocaleDateString('pt-BR')}`,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerCpf: customerCpf.replace(/\D/g, ''),
      billingType: mapMethodToBillingType(normalizedMethod),
      externalReference: invoiceId || `CHG-${Date.now()}`
    };

    // Criar cobrança no gateway
    let gatewayCharge;
    try {
      if (normalizedMethod === 'pix' && gateway.createPixCharge) {
        gatewayCharge = await gateway.createPixCharge(chargeData);
      } else if (normalizedMethod === 'debit_card') {
        try {
          gatewayCharge = await gateway.createCharge(chargeData);
        } catch (debitError) {
          gatewayCharge = await gateway.createCharge({
            ...chargeData,
            billingType: 'CREDIT_CARD'
          });
        }
      } else {
        gatewayCharge = await gateway.createCharge(chargeData);
      }
    } catch (error) {
      console.error('Erro ao criar cobrança no gateway:', error);
      return res.status(400).json({ 
        error: 'Falha ao criar cobrança no gateway',
        details: error.message 
      });
    }

    // Salvar pagamento no banco
    const payment = await prisma.payment.create({
      data: {
        condoId,
        invoiceId: invoiceId || null,
        amount: parseFloat(amount),
        description: chargeData.description,
        status: 'pending',
        method: normalizedMethod,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerCpf: customerCpf.replace(/\D/g, ''),
        gatewayProvider: gatewayConfig.provider,
        gatewayChargeId: gatewayCharge.id || gatewayCharge.externalReference,
        gatewayStatus: gatewayCharge.status || 'PENDING',
        pixCode: gatewayCharge.pixCode || gatewayCharge.qrcode || null,
        qrCodeImage: gatewayCharge.qrCodeImage || null,
        boletoUrl: gatewayCharge.bankSlipUrl || gatewayCharge.invoiceUrl || gatewayCharge.url || null
      }
    });

    res.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        method: payment.method,
        description: payment.description
      },
      gateway: {
        provider: gatewayConfig.provider,
        pixCode: payment.pixCode,
        qrCodeImage: payment.qrCodeImage,
        boletoUrl: payment.boletoUrl,
        checkoutUrl: gatewayCharge.checkoutUrl || gatewayCharge.invoiceUrl || gatewayCharge.url || payment.boletoUrl || null,
        chargeId: payment.gatewayChargeId
      }
    });
  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gateway/payments - Listar pagamentos
router.get('/payments', authMiddleware, async (req, res) => {
  try {
    const { condoId: queryCondoId, status } = req.query;
    const user = req.user;
    
    // Multi-tenancy check
    const condoId = user.role === 'admin-master' ? queryCondoId : user.condoId;
    
    if (!condoId) {
      return res.status(400).json({ error: 'condoId é obrigatório' });
    }

    const where = { condoId };
    if (status) where.status = status;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ success: true, payments });
  } catch (error) {
    console.error('Erro ao listar pagamentos:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gateway/payments/:paymentId - Obter detalhes do pagamento
router.get('/payments/:paymentId', authMiddleware, async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    // Tentar obter status atualizado do gateway
    const config = await prisma.gatewayConfig.findFirst({
      where: { condominiumId: payment.condoId }
    });

    if (config && payment.gatewayChargeId) {
      try {
        const gateway = createGatewayIntegration(config.provider, config.credentials);
        const gatewayStatus = await gateway.getCharge(payment.gatewayChargeId);
        
        // Atualizar status se diferente
        if (gatewayStatus.status !== payment.gatewayStatus) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              gatewayStatus: gatewayStatus.status,
              status: gatewayStatus.status === 'CONFIRMED' || gatewayStatus.status === 'PAID' ? 'paid' : payment.status,
              paidAt: (gatewayStatus.status === 'CONFIRMED' || gatewayStatus.status === 'PAID') && !payment.paidAt ? new Date() : payment.paidAt
            }
          });
        }
      } catch (error) {
        console.error('Erro ao sincronizar status:', error);
      }
    }

    res.json({ success: true, payment });
  } catch (error) {
    console.error('Erro ao obter pagamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── WEBHOOK ROUTES ────────────────────────────────────────────────────────

// POST /api/gateway/webhooks/:provider - Receber webhooks do gateway
router.post('/webhooks/:provider', express.json(), async (req, res) => {
  try {
    const { provider } = req.params;
    const body = req.body;

    console.log(`[WEBHOOK] ${provider.toUpperCase()}:`, JSON.stringify(body).slice(0, 500));

    let chargeId, statusMap;

    // Parse webhook baseado no provider
    if (provider === 'asaas') {
      chargeId = body.payment?.id || body.externalReference;
      statusMap = {
        'PENDING': 'pending',
        'CONFIRMED': 'paid',
        'RECEIVED': 'paid',
        'FAILED': 'failed',
        'REFUNDED': 'cancelled'
      };
    } else if (provider === 'mercadopago') {
      chargeId = body.data?.id;
      statusMap = {
        'pending': 'pending',
        'approved': 'paid',
        'authorized': 'processing',
        'rejected': 'failed',
        'cancelled': 'cancelled'
      };
    } else if (provider === 'stripe') {
      chargeId = body.data?.object?.id;
      statusMap = {
        'pending': 'pending',
        'succeeded': 'paid',
        'processing': 'processing',
        'failed': 'failed'
      };
    }

    if (!chargeId) {
      console.warn('Webhook recebido sem chargeId válido');
      return res.status(200).json({ received: true });
    }

    // Buscar pagamento no banco
    try {
      const payment = await prisma.payment.findFirst({
        where: { gatewayChargeId: chargeId }
      });

      if (payment) {
        const gwStatus = body.payment?.status || body.data?.status || body.data?.object?.status;
        const newStatus = statusMap[gwStatus];
        
        if (newStatus) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: newStatus,
              gatewayStatus: gwStatus,
              webhookReceived: true,
              paidAt: newStatus === 'paid' ? new Date() : null
            }
          });

          console.log(`✅ Pagamento ${payment.id} atualizado para ${newStatus}`);
        }
      }
    } catch (dbError) {
      console.error('Erro ao buscar/atualizar pagamento:', dbError);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(200).json({ received: true, error: error.message });
  }
});

// ─── GATEWAY STATUS & MONITORING ROUTES ────────────────────────────────────

// GET /api/gateway/status - Obter status real do gateway com tráfego
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const { condoId: queryCondoId, provider } = req.query;
    const user = req.user;
    
    // Multi-tenancy check
    const condoId = user.role === 'admin-master' ? queryCondoId : user.condoId;
    
    if (!condoId) {
      return res.status(400).json({ error: 'condoId é obrigatório' });
    }

    // Buscar status do gateway
    const whereClause = { condominiumId: condoId };
    if (provider) whereClause.provider = provider;

    const statuses = await prisma.gatewayStatus.findMany({
      where: whereClause
    });

    // Se não houver status, criar um para cada gateway configurado
    if (statuses.length === 0) {
      const configs = await prisma.gatewayConfig.findMany({
        where: { condominiumId: condoId, isActive: true }
      });

      for (const config of configs) {
        await prisma.gatewayStatus.upsert({
          where: {
            provider_condominiumId: {
              provider: config.provider,
              condominiumId: condoId
            }
          },
          update: {},
          create: {
            provider: config.provider,
            condominiumId: condoId,
            isConnected: false,
            requestsSent: 0,
            requestsReceived: 0,
            successfulRequests: 0,
            failedRequests: 0
          }
        });
      }

      // Buscar novamente
      const newStatuses = await prisma.gatewayStatus.findMany({
        where: whereClause
      });

      return res.json({ 
        success: true, 
        statuses: newStatuses.map(s => ({
          ...s,
          trafficPercentage: s.requestsSent > 0 ? Math.round((s.successfulRequests / s.requestsSent) * 100) : 0
        }))
      });
    }

    res.json({ 
      success: true, 
      statuses: statuses.map(s => ({
        ...s,
        trafficPercentage: s.requestsSent > 0 ? Math.round((s.successfulRequests / s.requestsSent) * 100) : 0
      }))
    });
  } catch (error) {
    console.error('Erro ao obter status:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gateway/health-check - Verificar saúde do gateway (conectado/desconectado)
router.post('/health-check', express.json(), authMiddleware, async (req, res) => {
  try {
    const { condoId: bodyCondoId, provider } = req.body;
    const user = req.user;
    
    // Multi-tenancy check
    const condoId = user.role === 'admin-master' ? bodyCondoId : user.condoId;
    
    if (!condoId || !provider) {
      return res.status(400).json({ error: 'condoId e provider são obrigatórios' });
    }

    // Buscar configuração
    const config = await prisma.gatewayConfig.findFirst({
      where: { condominiumId: condoId, provider, isActive: true }
    });

    if (!config) {
      return res.status(404).json({ error: 'Gateway não configurado' });
    }

    // Testar conexão
    let isConnected = false;
    let responseTime = 0;
    let errorMessage = null;

    try {
      const gateway = createGatewayIntegration(provider, config.credentials, config.environment);
      const startTime = Date.now();
      const testResult = await gateway.testConnection();
      responseTime = Date.now() - startTime;
      isConnected = testResult.connected || true;
    } catch (error) {
      isConnected = false;
      errorMessage = error.message;
      responseTime = Date.now() - Date.now();
    }

    // Atualizar status
    const status = await prisma.gatewayStatus.upsert({
      where: {
        provider_condominiumId: {
          provider,
          condominiumId: condoId
        }
      },
      update: {
        isConnected,
        lastHealthCheck: new Date(),
        lastSuccessfulRequest: isConnected ? new Date() : undefined,
        consecutiveFailures: isConnected ? 0 : undefined,
        lastError: errorMessage,
        lastErrorAt: errorMessage ? new Date() : undefined,
        averageResponseTime: responseTime
      },
      create: {
        provider,
        condominiumId: condoId,
        isConnected,
        lastHealthCheck: new Date(),
        lastSuccessfulRequest: isConnected ? new Date() : null,
        consecutiveFailures: isConnected ? 0 : 1,
        lastError: errorMessage,
        lastErrorAt: errorMessage ? new Date() : null,
        averageResponseTime: responseTime,
        requestsSent: 1,
        successfulRequests: isConnected ? 1 : 0,
        failedRequests: isConnected ? 0 : 1
      }
    });

    res.json({
      success: true,
      isConnected,
      responseTime,
      lastCheck: status.lastHealthCheck,
      provider,
      error: errorMessage
    });
  } catch (error) {
    console.error('Erro ao fazer health check:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gateway/track-request - Registrar requisição para tracking de tráfego
router.post('/track-request', express.json(), authMiddleware, async (req, res) => {
  try {
    const { condoId: bodyCondoId, provider, success = true, responseTime = 0 } = req.body;
    const user = req.user;
    
    // Multi-tenancy check
    const condoId = user.role === 'admin-master' ? bodyCondoId : user.condoId;
    
    if (!condoId || !provider) {
      return res.status(400).json({ error: 'condoId e provider são obrigatórios' });
    }

    const status = await prisma.gatewayStatus.upsert({
      where: {
        provider_condominiumId: {
          provider,
          condominiumId: condoId
        }
      },
      update: {
        requestsSent: { increment: 1 },
        successfulRequests: success ? { increment: 1 } : undefined,
        failedRequests: success ? undefined : { increment: 1 },
        averageResponseTime: responseTime,
        lastSuccessfulRequest: success ? new Date() : undefined,
        consecutiveFailures: success ? 0 : { increment: 1 }
      },
      create: {
        provider,
        condominiumId: condoId,
        requestsSent: 1,
        successfulRequests: success ? 1 : 0,
        failedRequests: success ? 0 : 1,
        averageResponseTime: responseTime,
        lastSuccessfulRequest: success ? new Date() : null,
        consecutiveFailures: success ? 0 : 1
      }
    });

    res.json({ 
      success: true, 
      traffic: {
        sent: status.requestsSent,
        successful: status.successfulRequests,
        failed: status.failedRequests,
        successRate: status.requestsSent > 0 ? Math.round((status.successfulRequests / status.requestsSent) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Erro ao registrar requisição:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gateway/webhook-received - Registrar webhook recebido
router.post('/webhook-received', express.json(), authMiddleware, async (req, res) => {
  try {
    const { condoId: bodyCondoId, provider } = req.body;
    const user = req.user;
    
    // Multi-tenancy check
    const condoId = user.role === 'admin-master' ? bodyCondoId : user.condoId;
    
    if (!condoId || !provider) {
      return res.status(400).json({ error: 'condoId e provider são obrigatórios' });
    }

    const status = await prisma.gatewayStatus.upsert({
      where: {
        provider_condominiumId: {
          provider,
          condominiumId: condoId
        }
      },
      update: {
        requestsReceived: { increment: 1 }
      },
      create: {
        provider,
        condominiumId: condoId,
        requestsReceived: 1,
        requestsSent: 0,
        successfulRequests: 0,
        failedRequests: 0
      }
    });

    res.json({ 
      success: true, 
      webhooksReceived: status.requestsReceived
    });
  } catch (error) {
    console.error('Erro ao registrar webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;



