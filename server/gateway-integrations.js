import fetch from 'node-fetch';

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidCPF(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cpf[i]) * (10 - i);
  }
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (check !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(cpf[i]) * (11 - i);
  }
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return check === Number(cpf[10]);
}

function isValidCNPJ(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base, weights) => {
    const total = base
      .split('')
      .reduce((acc, digit, idx) => acc + Number(digit) * weights[idx], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc(`${cnpj.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}

function getValidBrazilianDocument(value) {
  const digits = onlyDigits(value);
  if (digits.length === 11 && isValidCPF(digits)) return digits;
  if (digits.length === 14 && isValidCNPJ(digits)) return digits;
  return null;
}

// ─── ASAAS INTEGRATION ────────────────────────────────────────────────────────
export class AsaasIntegration {
  constructor(apiKey, environment = 'sandbox') {
    this.apiKey = apiKey;
    this.baseUrl = environment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/customers`, {
        headers: { 'access_token': this.apiKey }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return { 
        connected: true, 
        message: 'Conexão bem-sucedida com Asaas',
        data: { totalCustomers: data.totalCount || 0 }
      };
    } catch (error) {
      return { 
        connected: false, 
        message: `Falha na conexão: ${error.message}` 
      };
    }
  }

  async createCustomer(customerData) {
    try {
      const validDocument = getValidBrazilianDocument(customerData.cpfCnpj);
      if (!validDocument) {
        throw new Error('CPF/CNPJ invalido ou ausente no cadastro do cliente');
      }
      const payload = {
        name: customerData.name || 'Cliente INOVATECH',
        email: customerData.email || undefined
      };

      payload.cpfCnpj = validDocument;

      const response = await fetch(`${this.baseUrl}/customers`, {
        method: 'POST',
        headers: { 
          'access_token': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.description || 'Erro ao criar cliente');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Asaas: ${error.message}`);
    }
  }

  async createCharge(chargeData) {
    try {
      const customerDocument = getValidBrazilianDocument(chargeData.customerCpf || chargeData.customerCnpj);
      let customerId = chargeData.customerId || null;

      if (!customerId && !customerDocument) {
        throw new Error('CPF/CNPJ invalido ou ausente no cadastro do cliente');
      }

      if (!customerId && (chargeData.customerName || chargeData.customerEmail)) {
        const customer = await this.createCustomer({
          name: chargeData.customerName || 'Cliente INOVATECH',
          email: chargeData.customerEmail || undefined,
          cpfCnpj: customerDocument || undefined
        });
        customerId = customer?.id || null;
      }

      if (!customerId) {
        throw new Error('Nao foi possivel identificar ou criar cliente no Asaas');
      }

      const response = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: { 
          'access_token': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: chargeData.billingType || 'BOLETO',
          dueDate: chargeData.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          value: chargeData.value,
          description: chargeData.description || 'Cobrança INOVATECH CONNECT',
          externalReference: chargeData.externalReference || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.description || 'Erro ao criar cobrança');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Asaas: ${error.message}`);
    }
  }

  async getCharge(paymentId) {
    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        headers: { 'access_token': this.apiKey }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Asaas: ${error.message}`);
    }
  }

  async cancelCharge(paymentId) {
    try {
      if (!paymentId) throw new Error('paymentId obrigatorio');

      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: 'DELETE',
        headers: { 'access_token': this.apiKey }
      });

      if (response.status === 404) {
        return { id: paymentId, status: 'cancelled', alreadyCancelled: true };
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data?.errors?.[0]?.description || data?.message || `HTTP ${response.status}`;
        const normalized = String(message).toLowerCase();
        if (normalized.includes('ja foi remov') || normalized.includes('already deleted')) {
          return { id: paymentId, status: 'cancelled', alreadyCancelled: true };
        }
        throw new Error(message);
      }

      return {
        id: data?.id || paymentId,
        status: 'cancelled',
        rawStatus: data?.status || null
      };
    } catch (error) {
      throw new Error(`Asaas: ${error.message}`);
    }
  }

  async getPixQrCode(paymentId) {
    if (!paymentId) return null;

    const maxAttempts = 6;
    let lastError = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${this.baseUrl}/payments/${paymentId}/pixQrCode`, {
          headers: { 'access_token': this.apiKey }
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.payload || data?.encodedImage || data?.success) {
            return data;
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          lastError = errorData?.errors?.[0]?.description || `HTTP ${response.status}`;
        }
      } catch (error) {
        lastError = error.message;
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
      }
    }

    return { error: lastError || 'Gateway nao retornou payload PIX' };
  }

  async createPixCharge(chargeData) {
    const payment = await this.createCharge({
      ...chargeData,
      billingType: 'PIX',
      pixExpirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    const pixQrCode = await this.getPixQrCode(payment?.id);
    const pixPayload = pixQrCode?.payload || payment?.pixCode || payment?.qrcode || null;
    const encodedImage = pixQrCode?.encodedImage || pixQrCode?.image || null;
    const qrCodeImage = encodedImage
      ? (String(encodedImage).startsWith('data:image/')
        ? encodedImage
        : `data:image/png;base64,${encodedImage}`)
      : (payment?.qrCodeImage || null);

    return {
      ...payment,
      pixCode: pixPayload,
      qrCodeImage,
      checkoutUrl: payment?.invoiceUrl || payment?.url || null
    };
  }
}

// ─── MERCADO PAGO INTEGRATION ───────────────────────────────────────────────────
export class MercadoPagoIntegration {
  constructor(apiKey, environment = 'sandbox') {
    this.apiKey = apiKey;
    this.environment = environment;
    this.baseUrl = environment === 'production'
      ? 'https://api.mercadopago.com/v1'
      : 'https://api.mercadopago.com/sandbox/v1';
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/payment_methods`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { 
        connected: true, 
        message: 'Conexão bem-sucedida com Mercado Pago',
        data: { paymentMethods: data.length || 0 }
      };
    } catch (error) {
      return { 
        connected: false, 
        message: `Falha na conexão: ${error.message}` 
      };
    }
  }

  async createCustomer(customerData) {
    try {
      const document = String(customerData.cpfCnpj || '').replace(/\D/g, '');
      const docType = document.length === 14 ? 'CNPJ' : 'CPF';

      const response = await fetch('https://api.mercadopago.com/v1/customers', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: customerData.email,
          first_name: customerData.name?.split(' ')[0] || '',
          last_name: customerData.name?.split(' ').slice(1).join(' ') || '',
          identification: {
            type: docType,
            number: document
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao criar cliente');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Mercado Pago: ${error.message}`);
    }
  }

  async createCharge(chargeData) {
    try {
      const document = String(chargeData.customerCpf || chargeData.customerCnpj || '').replace(/\D/g, '');
      const docType = document.length === 14 ? 'CNPJ' : 'CPF';
      const paymentData = {
        transaction_amount: chargeData.value,
        description: chargeData.description || 'Cobrança INOVATECH CONNECT',
        payment_method_id: chargeData.paymentMethodId || 'bolbradesco',
        payer: {
          email: chargeData.customerEmail || '',
          first_name: chargeData.customerName?.split(' ')[0] || '',
          last_name: chargeData.customerName?.split(' ').slice(1).join(' ') || '',
          identification: {
            type: docType,
            number: document
          }
        },
        external_reference: chargeData.externalReference || ''
      };

      const response = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao criar cobrança');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Mercado Pago: ${error.message}`);
    }
  }

  async getCharge(paymentId) {
    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Mercado Pago: ${error.message}`);
    }
  }

  async cancelCharge(paymentId) {
    try {
      if (!paymentId) throw new Error('paymentId obrigatorio');

      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'cancelled' })
      });

      if (response.status === 404) {
        return { id: paymentId, status: 'cancelled', alreadyCancelled: true };
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data?.message || data?.error || `HTTP ${response.status}`;
        const normalized = String(message).toLowerCase();
        if (normalized.includes('already') && normalized.includes('cancel')) {
          return { id: paymentId, status: 'cancelled', alreadyCancelled: true };
        }
        throw new Error(message);
      }

      return {
        id: data?.id || paymentId,
        status: String(data?.status || 'cancelled').toLowerCase(),
        rawStatus: data?.status || null
      };
    } catch (error) {
      throw new Error(`Mercado Pago: ${error.message}`);
    }
  }

  async createPixCharge(chargeData) {
    return this.createCharge({
      ...chargeData,
      paymentMethodId: 'pix',
      date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  }
}

// ─── STRIPE INTEGRATION ────────────────────────────────────────────────────────
export class StripeIntegration {
  constructor(apiKey, environment = 'sandbox') {
    this.apiKey = apiKey;
    this.environment = environment;
    // Stripe usa a mesma API para teste e produção, mas com chaves diferentes
    this.baseUrl = 'https://api.stripe.com/v1';
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/balance`, {
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { 
        connected: true, 
        message: 'Conexão bem-sucedida com Stripe',
        data: { available: data.available?.[0]?.amount || 0 }
      };
    } catch (error) {
      return { 
        connected: false, 
        message: `Falha na conexão: ${error.message}` 
      };
    }
  }

  async createCustomer(customerData) {
    try {
      const params = new URLSearchParams();
      params.append('email', customerData.email);
      params.append('name', customerData.name || '');
      if (customerData.cpfCnpj) {
        params.append('metadata[cpf]', customerData.cpfCnpj);
      }

      const response = await fetch(`${this.baseUrl}/customers`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Erro ao criar cliente');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Stripe: ${error.message}`);
    }
  }

  async createCharge(chargeData) {
    try {
      const params = new URLSearchParams();
      params.append('amount', Math.round(chargeData.value * 100)); // Stripe usa centavos
      params.append('currency', 'brl');
      params.append('description', chargeData.description || 'Cobrança INOVATECH CONNECT');
      
      if (chargeData.customerId) {
        params.append('customer', chargeData.customerId);
      }

      // Criar Payment Intent para método flexível
      const response = await fetch(`${this.baseUrl}/payment_intents`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Erro ao criar cobrança');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Stripe: ${error.message}`);
    }
  }

  async getCharge(paymentId) {
    try {
      const response = await fetch(`${this.baseUrl}/payment_intents/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Stripe: ${error.message}`);
    }
  }

  async cancelCharge(paymentId) {
    try {
      if (!paymentId) throw new Error('paymentId obrigatorio');

      const response = await fetch(`${this.baseUrl}/payment_intents/${paymentId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams()
      });

      if (response.status === 404) {
        return { id: paymentId, status: 'cancelled', alreadyCancelled: true };
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const code = String(data?.error?.code || '').toLowerCase();
        const message = data?.error?.message || `HTTP ${response.status}`;
        const normalized = String(message).toLowerCase();
        const alreadyCanceled = code === 'payment_intent_unexpected_state' && normalized.includes('canceled');
        if (alreadyCanceled) {
          return { id: paymentId, status: 'cancelled', alreadyCancelled: true };
        }
        throw new Error(message);
      }

      return {
        id: data?.id || paymentId,
        status: String(data?.status || 'canceled').toLowerCase(),
        rawStatus: data?.status || null
      };
    } catch (error) {
      throw new Error(`Stripe: ${error.message}`);
    }
  }

  async createPixCharge(chargeData) {
    // Stripe não tem PIX nativo, mas podemos usar outros métodos brasileiros
    return this.createCharge({
      ...chargeData,
      payment_method_types: ['card', 'boleto']
    });
  }
}

// ─── GATEWAY FACTORY ────────────────────────────────────────────────────────────
export function createGatewayIntegration(provider, apiKey, environment = 'sandbox') {
  switch (provider) {
    case 'asaas':
      return new AsaasIntegration(apiKey, environment);
    case 'mercadopago':
      return new MercadoPagoIntegration(apiKey, environment);
    case 'stripe':
      return new StripeIntegration(apiKey, environment);
    default:
      throw new Error(`Gateway não suportado: ${provider}`);
  }
}

// ─── WEBHOOK HANDLERS ───────────────────────────────────────────────────────────
export class WebhookHandler {
  static async handleAsaasWebhook(payload, signature, secret) {
    try {
      // Validar assinatura do webhook (se configurado)
      if (secret && signature) {
        // Implementar validação HMAC se necessário
      }

      const { event, payment } = payload;

      switch (event) {
        case 'PAYMENT_CONFIRMED':
          return { status: 'confirmed', paymentId: payment.id, amount: payment.value };
        case 'PAYMENT_DELETED':
          return { status: 'cancelled', paymentId: payment.id };
        case 'PAYMENT_OVERDUE':
          return { status: 'overdue', paymentId: payment.id };
        default:
          return { status: 'unknown', event };
      }
    } catch (error) {
      throw new Error(`Erro ao processar webhook Asaas: ${error.message}`);
    }
  }

  static async handleMercadoPagoWebhook(payload, signature, secret) {
    try {
      const { action, type, data } = payload;

      if (type === 'payment') {
        const paymentId = data.id;
        
        switch (action) {
          case 'payment.created':
            return { status: 'created', paymentId };
          case 'payment.updated':
            // Buscar detalhes do pagamento para determinar status
            return { status: 'updated', paymentId };
          default:
            return { status: 'unknown', action };
        }
      }

      return { status: 'unknown', type };
    } catch (error) {
      throw new Error(`Erro ao processar webhook Mercado Pago: ${error.message}`);
    }
  }

  static async handleStripeWebhook(payload, signature, secret) {
    try {
      // Implementar validação de assinatura Stripe
      // const stripe = require('stripe')(secret);
      // const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      const { type, data } = payload;

      switch (type) {
        case 'payment_intent.succeeded':
          return { status: 'confirmed', paymentId: data.object.id, amount: data.object.amount / 100 };
        case 'payment_intent.payment_failed':
          return { status: 'failed', paymentId: data.object.id };
        case 'payment_intent.canceled':
          return { status: 'cancelled', paymentId: data.object.id };
        default:
          return { status: 'unknown', type };
      }
    } catch (error) {
      throw new Error(`Erro ao processar webhook Stripe: ${error.message}`);
    }
  }
}
