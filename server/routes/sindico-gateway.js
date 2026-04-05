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

router.post('/config', express.json(), authMiddleware, async (req, res) => {
  try {
    const { provider, apiKey, environment = 'sandbox', webhookSecret } = req.body;
    const user = req.user;

    if (user.role !== 'sindico') {
      return res.status(403).json({ error: 'Apenas Síndicos podem configurar gateway' });
    }

    if (!user.condoId) {
      return res.status(400).json({ error: 'Síndico não está associado a nenhum condomínio' });
    }

    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'provider e apiKey são obrigatórios' });
    }

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

    const now = new Date();
    const [, config] = await prisma.$transaction([
      prisma.gatewayConfig.updateMany({
        where: { condominiumId: user.condoId, isActive: true },
        data: {
          isActive: false,
          updatedAt: now
        }
      }),
      prisma.gatewayConfig.upsert({
        where: {
          provider_condominiumId: {
            provider,
            condominiumId: user.condoId
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
          condominiumId: user.condoId,
          isActive: true,
          name: provider === 'asaas' ? 'Asaas' : provider === 'mercadopago' ? 'Mercado Pago' : 'Stripe'
        }
      })
    ]);

    res.json({
      success: true,
      message: `Gateway ${provider} configurado para o condomínio!`,
      config: {
        id: config.id,
        provider: config.provider,
        environment: config.environment,
        isActive: config.isActive
      }
    });
  } catch (error) {
    console.error('Erro ao configurar gateway do síndico:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/config', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'sindico') {
      return res.status(403).json({ error: 'Apenas Síndicos podem ver a configuração' });
    }

    if (!user.condoId) {
      return res.status(400).json({ error: 'Síndico não está associado a nenhum condomínio' });
    }

    const configs = await prisma.gatewayConfig.findMany({
      where: {
        condominiumId: user.condoId,
        isActive: true
      },
      select: {
        id: true,
        provider: true,
        name: true,
        environment: true,
        isActive: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      configs
    });
  } catch (error) {
    console.error('Erro ao buscar configs:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/config', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'sindico') {
      return res.status(403).json({ error: 'Apenas Síndicos podem remover a configuração do gateway' });
    }

    if (!user.condoId) {
      return res.status(400).json({ error: 'Síndico não está associado a nenhum condomínio' });
    }

    await prisma.gatewayConfig.deleteMany({
      where: { condominiumId: user.condoId }
    });

    res.json({
      success: true,
      message: 'Configuração removida com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover config do síndico:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/create-charge', express.json(), authMiddleware, async (req, res) => {
  try {
    const { residentId, amount, description, dueDate, method = 'pix' } = req.body;
    const user = req.user;
    const normalizedMethod = normalizePaymentMethod(method);

    if (user.role !== 'sindico') {
      return res.status(403).json({ error: 'Apenas Síndicos podem criar cobranças' });
    }

    if (!user.condoId) {
      return res.status(400).json({ error: 'Sindico nao esta associado a nenhum condominio' });
    }

    if (!residentId || !amount) {
      return res.status(400).json({ error: 'residentId e amount sao obrigatorios' });
    }

    if (!normalizedMethod) {
      return res.status(400).json({
        error: 'Metodo de pagamento invalido. Use pix, boleto, credit_card ou debit_card'
      });
    }

    const resident = await prisma.user.findUnique({
      where: { id: residentId }
    });

    if (!resident) {
      return res.status(404).json({ error: 'Morador não encontrado' });
    }

    if (resident.condoId !== user.condoId) {
      return res.status(403).json({ error: 'Morador não pertence ao seu condomínio' });
    }

    const gatewayConfig = await prisma.gatewayConfig.findFirst({
      where: {
        condominiumId: user.condoId,
        isActive: true
      }
    });

    if (!gatewayConfig) {
      return res.status(400).json({
        error: 'Gateway não configurado para este condomínio. Configure primeiro.'
      });
    }

    const gateway = createGatewayIntegration(
      gatewayConfig.provider,
      gatewayConfig.credentials,
      gatewayConfig.environment
    );

    const invoice = await prisma.invoice.create({
      data: {
        condoId: user.condoId,
        userId: resident.id,
        userName: resident.name,
        unit: resident.unit || 'N/A',
        description: description || `Taxa Condominial - ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}`,
        amount: parseFloat(amount),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending'
      }
    });

    const chargeData = {
      value: parseFloat(amount),
      description: description || `Taxa Condominial - ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}`,
      customerName: resident.name,
      customerEmail: resident.email,
      customerCpf: resident.cpf?.replace(/\D/g, '') || '',
      billingType: mapMethodToBillingType(normalizedMethod),
      externalReference: `INV-${invoice.id}`
    };

    let gatewayCharge;
    try {
      if (normalizedMethod === 'pix' && typeof gateway.createPixCharge === 'function') {
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
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'pending' }
      });
      return res.status(400).json({
        error: 'Falha ao criar cobrança no gateway',
        details: error.message
      });
    }

    const payment = await prisma.payment.create({
      data: {
        condoId: user.condoId,
        invoiceId: invoice.id,
        amount: parseFloat(amount),
        description: chargeData.description,
        status: 'pending',
        method: normalizedMethod,
        customerName: resident.name,
        customerEmail: resident.email,
        customerCpf: resident.cpf?.replace(/\D/g, '') || '',
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
      invoice: {
        id: invoice.id,
        userName: invoice.userName,
        unit: invoice.unit,
        description: invoice.description,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        status: invoice.status
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        method: payment.method
      },
      gateway: {
        provider: gatewayConfig.provider,
        chargeId: payment.gatewayChargeId,
        pixCode: payment.pixCode,
        qrCodeImage: payment.qrCodeImage,
        boletoUrl: payment.boletoUrl,
        checkoutUrl: gatewayCharge.checkoutUrl || gatewayCharge.invoiceUrl || gatewayCharge.url || payment.boletoUrl || null
      }
    });
  } catch (error) {
    console.error('Erro ao criar cobrança:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/create-mass-charge', express.json(), authMiddleware, async (req, res) => {
  try {
    const { amount, amounts, description, dueDate, method = 'pix' } = req.body;
    const user = req.user;
    const normalizedMethod = normalizePaymentMethod(method);

    if (user.role !== 'sindico') {
      return res.status(403).json({ error: 'Apenas Síndicos podem criar cobranças em massa' });
    }

    if (!user.condoId) {
      return res.status(400).json({ error: 'Síndico não está associado a nenhum condomínio' });
    }

    if (!amount && (!amounts || typeof amounts !== 'object')) {
      return res.status(400).json({ error: 'Informe um valor fixo (amount) ou valores por morador (amounts)' });
    }

    if (!normalizedMethod) {
      return res.status(400).json({
        error: 'Metodo de pagamento invalido. Use pix, boleto, credit_card ou debit_card'
      });
    }

    const gatewayConfig = await prisma.gatewayConfig.findFirst({
      where: {
        condominiumId: user.condoId,
        isActive: true
      }
    });

    if (!gatewayConfig) {
      return res.status(400).json({
        error: 'Gateway não configurado para este condomínio'
      });
    }

    const gateway = createGatewayIntegration(
      gatewayConfig.provider,
      gatewayConfig.credentials,
      gatewayConfig.environment
    );

    // Buscar todos os moradores se for um valor fixo
    let residentsToCharge = [];
    if (amount) {
      residentsToCharge = await prisma.user.findMany({
        where: { condoId: user.condoId, role: 'morador', active: true }
      });
    } else {
      residentsToCharge = await prisma.user.findMany({
        where: { id: { in: Object.keys(amounts) }, condoId: user.condoId }
      });
    }

    const results = [];
    const errors = [];

    for (const resident of residentsToCharge) {
      try {
        const chargeAmount = amount ? parseFloat(amount) : parseFloat(amounts[resident.id]);

        const invoice = await prisma.invoice.create({
          data: {
            condoId: user.condoId,
            userId: resident.id,
            userName: resident.name,
            unit: resident.unit || 'N/A',
            description: description || `Taxa Condominial - ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}`,
            amount: chargeAmount,
            dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'pending'
          }
        });

        const chargeData = {
          value: chargeAmount,
          description: description || `Taxa Condominial - ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}`,
          customerName: resident.name,
          customerEmail: resident.email,
          customerCpf: resident.cpf?.replace(/\D/g, '') || '',
          billingType: mapMethodToBillingType(normalizedMethod),
          externalReference: `INV-${invoice.id}`
        };

        let gatewayCharge;
        try {
          if (normalizedMethod === 'pix' && typeof gateway.createPixCharge === 'function') {
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
        } catch (gwError) {
          errors.push({ residentId: resident.id, residentName: resident.name, error: gwError.message });
          continue;
        }

        const payment = await prisma.payment.create({
          data: {
            condoId: user.condoId,
            invoiceId: invoice.id,
            amount: chargeAmount,
            description: chargeData.description,
            status: 'pending',
            method: normalizedMethod,
            customerName: resident.name,
            customerEmail: resident.email,
            customerCpf: resident.cpf?.replace(/\D/g, '') || '',
            gatewayProvider: gatewayConfig.provider,
            gatewayChargeId: gatewayCharge.id || gatewayCharge.externalReference,
            gatewayStatus: gatewayCharge.status || 'PENDING',
            pixCode: gatewayCharge.pixCode || gatewayCharge.qrcode || null,
            qrCodeImage: gatewayCharge.qrCodeImage || null,
            boletoUrl: gatewayCharge.bankSlipUrl || gatewayCharge.invoiceUrl || gatewayCharge.url || null
          }
        });

        results.push({
          invoiceId: invoice.id,
          paymentId: payment.id,
          residentId: resident.id,
          residentName: resident.name,
          unit: resident.unit,
          amount: chargeAmount,
          status: 'created'
        });
      } catch (err) {
        errors.push({ residentId: resident.id, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Cobranças criadas: ${results.length} sucesso, ${errors.length} erros`,
      created: results,
      errors
    });
  } catch (error) {
    console.error('Erro ao criar cobranças em massa:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/invoices', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { status } = req.query;

    let where = {};
    
    if (user.role === 'sindico') {
      if (!user.condoId) {
        return res.status(400).json({ error: 'Síndico não está associado a nenhum condomínio' });
      }
      where = { condoId: user.condoId };
    } else if (user.role === 'morador') {
      where = { userId: user.id };
    } else {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (status) where.status = status;

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({
      success: true,
      count: invoices.length,
      invoices
    });
  } catch (error) {
    console.error('Erro ao listar faturas:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/residents', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'sindico') {
      return res.status(403).json({ error: 'Apenas Síndicos podem ver moradores' });
    }

    if (!user.condoId) {
      return res.status(400).json({ error: 'Síndico não está associado a nenhum condomínio' });
    }

    const residents = await prisma.user.findMany({
      where: {
        condoId: user.condoId,
        role: 'morador',
        active: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        unit: true,
        cpf: true,
        phone: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      count: residents.length,
      residents
    });
  } catch (error) {
    console.error('Erro ao listar moradores:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/payments', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'sindico') {
      return res.status(403).json({ error: 'Apenas Síndicos podem ver pagamentos' });
    }

    if (!user.condoId) {
      return res.status(400).json({ error: 'Síndico não está associado a nenhum condomínio' });
    }

    const { status } = req.query;

    let where = { condoId: user.condoId };
    if (status) where.status = status;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (error) {
    console.error('Erro ao listar pagamentos:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'sindico') {
      return res.status(403).json({ error: 'Apenas Síndicos podem ver dashboard' });
    }

    if (!user.condoId) {
      return res.status(400).json({ error: 'Síndico não está associado a nenhum condomínio' });
    }

    const condo = await prisma.condominium.findUnique({
      where: { id: user.condoId }
    });

    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        condoId: user.condoId,
        status: 'pending'
      }
    });

    const paidInvoices = await prisma.invoice.findMany({
      where: {
        condoId: user.condoId,
        status: 'paid'
      }
    });

    const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const paidAmount = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    const residents = await prisma.user.count({
      where: {
        condoId: user.condoId,
        role: 'morador',
        active: true
      }
    });

    const gatewayConfig = await prisma.gatewayConfig.findFirst({
      where: {
        condominiumId: user.condoId,
        isActive: true
      }
    });

    res.json({
      success: true,
      dashboard: {
        condo: {
          id: condo.id,
          name: condo.name,
          units: condo.units,
          residents: condo.residents
        },
        billing: {
          pendingCount: pendingInvoices.length,
          pendingAmount,
          paidCount: paidInvoices.length,
          paidAmount,
          totalOutstanding: pendingAmount
        },
        residents: {
          count: residents
        },
        gateway: gatewayConfig ? {
          provider: gatewayConfig.provider,
          configured: true
        } : {
          configured: false
        }
      }
    });
  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;



