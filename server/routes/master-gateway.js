import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createGatewayIntegration } from '../gateway-integrations.js';
import authMiddleware from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_BASE = path.join(__dirname, '..', '..', 'uploads');
const ALLOWED_CATEGORIES = ['users_photos', 'marketplace', 'areas', 'documents', 'reservations', 'announcements', 'complaints', 'votes', 'deliveries', 'chat', 'other'];

const router = express.Router();
const prisma = new PrismaClient();

function isMasterAdmin(user) {
  return user?.role === 'admin' || user?.role === 'admin-master';
}

function canAccessCondoLicense(user, condoId) {
  if (isMasterAdmin(user)) return true;
  return user?.role === 'sindico' && user?.condoId === condoId;
}

function ensureCondoFolders(condoId) {
  const condoFolder = path.join(UPLOADS_BASE, 'condos', condoId);
  ALLOWED_CATEGORIES.forEach(category => {
    const categoryPath = path.join(condoFolder, category);
    if (!fs.existsSync(categoryPath)) {
      fs.mkdirSync(categoryPath, { recursive: true });
    }
  });
  const readmePath = path.join(condoFolder, 'README.txt');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, `# Pasta do Condomínio\n# Created: ${new Date().toISOString()}\n`);
  }
  return condoFolder;
}

function normalizeDocument(value) {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

function normalizeEmail(value, fallbackDomain = 'inovatech.local') {
  const email = String(value || '').trim();
  if (!email) return '';
  if (email.includes('@')) return email;
  return `${email}@${fallbackDomain}`;
}

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function isValidCNPJ(value) {
  const cnpj = normalizeDocument(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base, weights) => {
    const sum = base
      .split('')
      .reduce((acc, digit, idx) => acc + Number(digit) * weights[idx], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calcDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calcDigit(`${cnpj.slice(0, 12)}${firstDigit}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return firstDigit === Number(cnpj[12]) && secondDigit === Number(cnpj[13]);
}

function buildBillingCustomerSnapshot(condo) {
  return {
    customerName: condo.name || null,
    customerEmail: normalizeEmail(condo.email) || null,
    customerCnpj: normalizeDocument(condo.cnpj) || null,
    customerAddress: condo.address || null,
    customerCity: condo.city || null,
    customerUnits: Number.isFinite(condo.units) ? condo.units : null
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BLOCK_GRACE_DAYS = 30;
const DEFAULT_RECURRENCE_DAY = 25;
const DEFAULT_AUTO_ISSUE_METHOD = 'boleto';
const OPEN_LICENSE_STATUSES = ['pending', 'processing', 'overdue', 'failed'];
const LICENSE_PAYMENT_METHODS = ['pix', 'boleto', 'credit_card', 'debit_card'];
const AUTO_ISSUE_LICENSE_PAYMENT_METHODS = ['pix', 'boleto'];

const GATEWAY_STATUS_MAP = {
  // Asaas
  PENDING: 'pending',
  AWAITING_RISK_ANALYSIS: 'processing',
  CONFIRMED: 'paid',
  RECEIVED: 'paid',
  RECEIVED_IN_CASH: 'paid',
  OVERDUE: 'overdue',
  REFUNDED: 'failed',
  REFUND_REQUESTED: 'failed',
  CHARGEBACK_REQUESTED: 'failed',
  CHARGEBACK_DISPUTE: 'failed',
  AWAITING_CHARGEBACK_REVERSAL: 'failed',
  DUNNING_REQUESTED: 'failed',
  DUNNING_RECEIVED: 'paid',
  // Mercado Pago
  approved: 'paid',
  pending: 'pending',
  authorized: 'processing',
  in_process: 'processing',
  in_mediation: 'processing',
  rejected: 'failed',
  cancelled: 'failed',
  refunded: 'failed',
  charged_back: 'failed',
  // Stripe
  succeeded: 'paid',
  processing: 'processing',
  requires_payment_method: 'pending',
  requires_action: 'pending',
  requires_confirmation: 'pending',
  canceled: 'failed'
};

function parseBlockGraceDays(value, fallback = DEFAULT_BLOCK_GRACE_DAYS) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(365, Math.max(0, parsed));
}

function parseMonthDay(value, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(28, Math.max(1, parsed));
}

function parseBooleanFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeBillingStatusFromGateway(gatewayStatus, fallback = 'pending') {
  const normalized = String(gatewayStatus || '').trim();
  if (!normalized) return fallback;
  return (
    GATEWAY_STATUS_MAP[normalized]
    || GATEWAY_STATUS_MAP[normalized.toUpperCase()]
    || GATEWAY_STATUS_MAP[normalized.toLowerCase()]
    || fallback
  );
}

function normalizeLicensePaymentMethod(value) {
  const method = String(value || 'pix').trim().toLowerCase();
  return LICENSE_PAYMENT_METHODS.includes(method) ? method : null;
}

function normalizeAutoIssueMethod(value, fallback = DEFAULT_AUTO_ISSUE_METHOD) {
  const method = String(value || fallback).trim().toLowerCase();
  return AUTO_ISSUE_LICENSE_PAYMENT_METHODS.includes(method) ? method : fallback;
}

function mapLicenseMethodToBillingType(method) {
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

function toUtcStart(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getDaysPastDue(dueDate, referenceDate = new Date()) {
  const dueUtc = toUtcStart(dueDate);
  const refUtc = toUtcStart(referenceDate);
  if (dueUtc === null || refUtc === null) return 0;
  return Math.floor((refUtc - dueUtc) / DAY_MS);
}

function formatBillingMonth(referenceDate = new Date()) {
  return `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`;
}

function formatLicenseDescription(referenceDate = new Date()) {
  return `Licenca INOVATECH CONNECT - ${referenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, (char) => char.toUpperCase())}`;
}

function buildLicenseDueDate(referenceDate = new Date(), billingDay = 5) {
  const normalizedBillingDay = parseMonthDay(billingDay, 5);
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, normalizedBillingDay);
}

function buildLicenseBillingCreateData(condo, masterConfig, referenceDate = new Date()) {
  return {
    condoId: condo.id,
    masterGatewayId: masterConfig.id,
    description: formatLicenseDescription(referenceDate),
    amount: Number.isFinite(condo.licenseValue) && condo.licenseValue > 0
      ? condo.licenseValue
      : masterConfig.defaultLicenseValue,
    dueDate: buildLicenseDueDate(referenceDate, masterConfig.billingDay),
    billingMonth: formatBillingMonth(referenceDate),
    status: 'pending',
    ...buildBillingCustomerSnapshot(condo)
  };
}

function parseBillingMonthToDate(billingMonth) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(billingMonth || '').trim());
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

function getNextBillingMonth(billingMonth) {
  const baseDate = parseBillingMonthToDate(billingMonth);
  if (!baseDate) {
    const now = new Date();
    return formatBillingMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  }
  return formatBillingMonth(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1));
}

async function ensureNextMonthlyBillingForCondo(condoId, paidBillingMonth) {
  if (!condoId) return { created: false, reason: 'missing_condo_id' };

  const [masterConfig, condo] = await Promise.all([
    prisma.masterGatewayConfig.findUnique({ where: { id: 'master' } }),
    prisma.condominium.findUnique({ where: { id: condoId } })
  ]);

  if (!masterConfig || !condo || !condo.active) {
    return { created: false, reason: 'missing_config_or_condo' };
  }

  const targetBillingMonth = getNextBillingMonth(paidBillingMonth);
  const existing = await prisma.licenseBilling.findFirst({
    where: {
      condoId,
      billingMonth: targetBillingMonth
    },
    orderBy: { createdAt: 'desc' }
  });

  if (existing) {
    return { created: false, reason: 'already_exists', billingId: existing.id, billingMonth: targetBillingMonth };
  }

  const referenceDate = parseBillingMonthToDate(targetBillingMonth) || new Date();
  const billing = await prisma.licenseBilling.create({
    data: buildLicenseBillingCreateData(condo, masterConfig, referenceDate)
  });

  return { created: true, billingId: billing.id, billingMonth: targetBillingMonth };
}

async function issueLicenseChargeForBilling({
  billing,
  condo,
  masterConfig,
  method = 'pix',
  syncAfter = true
}) {
  const normalizedMethod = normalizeLicensePaymentMethod(method);

  if (!normalizedMethod) {
    const error = new Error('Metodo de pagamento invalido. Use pix, boleto, credit_card ou debit_card');
    error.statusCode = 400;
    throw error;
  }

  const gateway = createGatewayIntegration(
    masterConfig.provider,
    masterConfig.credentials,
    masterConfig.environment
  );

  const customerSnapshot = {
    customerName: billing.customerName || condo.name,
    customerEmail: normalizeEmail(billing.customerEmail || condo.email || `${condo.id}@inovatech.local`),
    customerCnpj: normalizeDocument(billing.customerCnpj || condo.cnpj),
    customerAddress: billing.customerAddress || condo.address || null,
    customerCity: billing.customerCity || condo.city || null,
    customerUnits: billing.customerUnits ?? condo.units ?? null
  };

  const chargeData = {
    value: billing.amount,
    description: billing.description,
    customerName: customerSnapshot.customerName,
    customerEmail: customerSnapshot.customerEmail,
    customerCpf: customerSnapshot.customerCnpj,
    customerCnpj: customerSnapshot.customerCnpj,
    customerAddress: customerSnapshot.customerAddress,
    customerCity: customerSnapshot.customerCity,
    customerUnits: customerSnapshot.customerUnits,
    billingType: mapLicenseMethodToBillingType(normalizedMethod),
    externalReference: `LIC-${billing.id}`
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
    const wrappedError = new Error(error.message || 'Falha ao criar cobranca no gateway');
    wrappedError.statusCode = 400;
    throw wrappedError;
  }

  await prisma.licenseBilling.update({
    where: { id: billing.id },
    data: {
      gatewayProvider: masterConfig.provider,
      gatewayChargeId: gatewayCharge.id || gatewayCharge.externalReference,
      gatewayStatus: gatewayCharge.status || 'PENDING',
      status: normalizeBillingStatusFromGateway(gatewayCharge.status, 'processing'),
      ...customerSnapshot
    }
  });

  if (syncAfter) {
    await safelyRunLicenseSync({
      condoId: condo.id,
      syncGateway: true,
      maxGatewayChecks: 80
    }, 'billings/charge-license');
  }

  return {
    billing: {
      id: billing.id,
      amount: billing.amount,
      description: billing.description,
      status: normalizeBillingStatusFromGateway(gatewayCharge.status, 'processing')
    },
    gateway: {
      provider: masterConfig.provider,
      chargeId: gatewayCharge.id || gatewayCharge.externalReference || null,
      method: normalizedMethod,
      pixCode: gatewayCharge.pixCode || gatewayCharge.qrcode || null,
      qrCodeImage: gatewayCharge.qrCodeImage || null,
      boletoUrl: gatewayCharge.bankSlipUrl || gatewayCharge.invoiceUrl || gatewayCharge.url || null,
      checkoutUrl: gatewayCharge.checkoutUrl || gatewayCharge.invoiceUrl || gatewayCharge.url || null
    }
  };
}

async function cancelLicenseChargeInGatewayIfNeeded(billing) {
  if (!billing?.gatewayChargeId) {
    return { attempted: false, reason: 'no_gateway_charge' };
  }

  const cancellableStatuses = ['pending', 'processing', 'overdue', 'failed'];
  const billingStatus = String(billing.status || '').toLowerCase();
  if (!cancellableStatuses.includes(billingStatus)) {
    return { attempted: false, reason: 'status_not_cancellable', status: billingStatus };
  }

  const masterConfig = await prisma.masterGatewayConfig.findUnique({
    where: { id: 'master' }
  });

  if (!masterConfig?.provider || !masterConfig?.credentials) {
    const error = new Error('Gateway Master nao configurado para cancelar a cobranca no banco');
    error.statusCode = 400;
    throw error;
  }

  const providerToUse = String(billing.gatewayProvider || masterConfig.provider || '').trim().toLowerCase();
  if (billing.gatewayProvider && providerToUse !== String(masterConfig.provider || '').trim().toLowerCase()) {
    const error = new Error(
      `Cobranca vinculada ao gateway ${billing.gatewayProvider}, mas o Master esta configurado em ${masterConfig.provider}. Reconfigure o gateway correto para cancelar no banco.`
    );
    error.statusCode = 400;
    throw error;
  }

  const gateway = createGatewayIntegration(
    providerToUse,
    masterConfig.credentials,
    masterConfig.environment
  );

  if (typeof gateway.cancelCharge !== 'function') {
    return { attempted: false, reason: 'cancel_not_supported' };
  }

  try {
    const cancelResult = await gateway.cancelCharge(billing.gatewayChargeId);
    return {
      attempted: true,
      provider: providerToUse,
      chargeId: billing.gatewayChargeId,
      result: cancelResult || null
    };
  } catch (error) {
    const wrappedError = new Error(`Falha ao cancelar cobranca no banco: ${error.message}`);
    wrappedError.statusCode = 502;
    throw wrappedError;
  }
}

let monthlyBillingGenerationInProgress = false;
let recurringBillingJobInProgress = false;

async function generateMonthlyLicenseBillings({
  referenceDate = new Date(),
  issueCharges = false,
  chargeMethod = DEFAULT_AUTO_ISSUE_METHOD,
  persistRecurringRun = false,
  trigger = 'manual'
} = {}) {
  if (monthlyBillingGenerationInProgress) {
    return { skipped: true, reason: 'generation_in_progress' };
  }

  monthlyBillingGenerationInProgress = true;
  try {
    const masterConfig = await prisma.masterGatewayConfig.findUnique({
      where: { id: 'master' }
    });

    if (!masterConfig) {
      const error = new Error('Gateway Master nao configurado');
      error.statusCode = 400;
      throw error;
    }

    const billingMonth = formatBillingMonth(referenceDate);
    const normalizedChargeMethod = normalizeAutoIssueMethod(chargeMethod, masterConfig.autoIssueMethod);

    const [condos, existingBillings] = await Promise.all([
      prisma.condominium.findMany({
        where: { active: true },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.licenseBilling.findMany({
        where: { billingMonth },
        orderBy: [{ createdAt: 'desc' }]
      })
    ]);

    const existingByCondoId = new Map();
    for (const existingBilling of existingBillings) {
      if (!existingByCondoId.has(existingBilling.condoId)) {
        existingByCondoId.set(existingBilling.condoId, existingBilling);
      }
    }

    const createdBillings = [];
    const reusedBillings = [];
    const issueResults = [];

    for (const condo of condos) {
      let billing = existingByCondoId.get(condo.id) || null;
      let createdNow = false;

      if (!billing) {
        const currentBilling = await prisma.licenseBilling.findFirst({
          where: {
            condoId: condo.id,
            billingMonth
          },
          orderBy: [{ createdAt: 'desc' }]
        });

        if (currentBilling) {
          billing = currentBilling;
          existingByCondoId.set(condo.id, currentBilling);
        } else {
          billing = await prisma.licenseBilling.create({
            data: buildLicenseBillingCreateData(condo, masterConfig, referenceDate)
          });
          createdNow = true;
          existingByCondoId.set(condo.id, billing);
          createdBillings.push(billing);
        }
      }

      if (!createdNow && billing) {
        reusedBillings.push(billing);
      }

      const shouldIssueCharge = issueCharges
        && billing
        && !billing.gatewayChargeId
        && OPEN_LICENSE_STATUSES.includes(String(billing.status || 'pending'));

      if (!shouldIssueCharge) {
        continue;
      }

      try {
        const issuedCharge = await issueLicenseChargeForBilling({
          billing,
          condo,
          masterConfig,
          method: normalizedChargeMethod,
          syncAfter: false
        });

        issueResults.push({
          success: true,
          condoId: condo.id,
          billingId: billing.id,
          method: normalizedChargeMethod,
          gatewayChargeId: issuedCharge.gateway.chargeId
        });
      } catch (error) {
        issueResults.push({
          success: false,
          condoId: condo.id,
          billingId: billing.id,
          method: normalizedChargeMethod,
          error: error.message
        });
      }
    }

    if (persistRecurringRun) {
      await prisma.masterGatewayConfig.update({
        where: { id: 'master' },
        data: {
          lastRecurringRunMonth: billingMonth,
          lastRecurringRunAt: new Date()
        }
      });
    }

    await safelyRunLicenseSync({
      syncGateway: issueCharges,
      maxGatewayChecks: 80
    }, `billings/${trigger}`);

    return {
      success: true,
      billingMonth,
      count: createdBillings.length,
      issueCharges,
      issueMethod: normalizedChargeMethod,
      createdBillings: createdBillings.map((billing) => ({
        id: billing.id,
        condoId: billing.condoId,
        amount: billing.amount,
        status: billing.status
      })),
      reusedBillings: reusedBillings.map((billing) => ({
        id: billing.id,
        condoId: billing.condoId,
        amount: billing.amount,
        status: billing.status,
        gatewayChargeId: billing.gatewayChargeId
      })),
      issuedCharges: issueResults.filter((item) => item.success),
      chargeErrors: issueResults.filter((item) => !item.success)
    };
  } finally {
    monthlyBillingGenerationInProgress = false;
  }
}

async function runRecurringBillingAutomation(reason = 'scheduler', referenceDate = new Date()) {
  if (recurringBillingJobInProgress) {
    return { skipped: true, reason: 'recurrence_job_in_progress' };
  }

  recurringBillingJobInProgress = true;
  try {
    const masterConfig = await prisma.masterGatewayConfig.findUnique({
      where: { id: 'master' }
    });

    if (!masterConfig) {
      return { skipped: true, reason: 'master_not_configured' };
    }

    const billingMonth = formatBillingMonth(referenceDate);
    const recurrenceDay = parseMonthDay(masterConfig.recurrenceDay, DEFAULT_RECURRENCE_DAY);

    if (!parseBooleanFlag(masterConfig.autoGenerateBillings, true)) {
      return { skipped: true, reason: 'recurrence_disabled', billingMonth };
    }

    if (referenceDate.getDate() < recurrenceDay) {
      return {
        skipped: true,
        reason: 'before_recurrence_day',
        billingMonth,
        recurrenceDay
      };
    }

    if (masterConfig.lastRecurringRunMonth === billingMonth) {
      return { skipped: true, reason: 'already_processed', billingMonth };
    }

    return await generateMonthlyLicenseBillings({
      referenceDate,
      issueCharges: parseBooleanFlag(masterConfig.autoIssueCharges, false),
      chargeMethod: normalizeAutoIssueMethod(masterConfig.autoIssueMethod, DEFAULT_AUTO_ISSUE_METHOD),
      persistRecurringRun: true,
      trigger: `recurrence/${reason}`
    });
  } finally {
    recurringBillingJobInProgress = false;
  }
}

async function syncAndEnforceLicenseState(options = {}) {
  const {
    condoId = null,
    syncGateway = true,
    maxGatewayChecks = 100
  } = options;

  const now = new Date();
  const condoWhere = condoId ? { condoId } : {};
  const summary = {
    blockGraceDays: DEFAULT_BLOCK_GRACE_DAYS,
    gatewayChecks: 0,
    gatewayUpdates: 0,
    gatewayErrors: 0,
    statusTransitions: 0,
    condosBlocked: 0,
    condosUnblocked: 0,
    condosUpdated: 0
  };

  const masterConfig = await prisma.masterGatewayConfig.findUnique({
    where: { id: 'master' }
  });

  summary.blockGraceDays = parseBlockGraceDays(masterConfig?.blockGraceDays, DEFAULT_BLOCK_GRACE_DAYS);

  if (syncGateway && masterConfig?.isActive && masterConfig?.provider && masterConfig?.credentials) {
    try {
      const gateway = createGatewayIntegration(
        masterConfig.provider,
        masterConfig.credentials,
        masterConfig.environment
      );

      if (typeof gateway.getCharge === 'function') {
        const openBillings = await prisma.licenseBilling.findMany({
          where: {
            ...condoWhere,
            status: { in: ['pending', 'processing', 'overdue'] },
            gatewayChargeId: { not: null }
          },
          orderBy: { createdAt: 'desc' },
          take: Math.max(1, Number(maxGatewayChecks) || 100)
        });

        for (const billing of openBillings) {
          summary.gatewayChecks += 1;
          try {
            const gatewayCharge = await gateway.getCharge(billing.gatewayChargeId);
            const gatewayStatus = gatewayCharge?.status || gatewayCharge?.data?.status || null;
            const normalizedStatus = normalizeBillingStatusFromGateway(gatewayStatus, billing.status);

            const shouldUpdate = (
              (gatewayStatus && gatewayStatus !== billing.gatewayStatus)
              || normalizedStatus !== billing.status
              || (normalizedStatus === 'paid' && !billing.paidAt)
            );

            if (shouldUpdate) {
              await prisma.licenseBilling.update({
                where: { id: billing.id },
                data: {
                  gatewayStatus: gatewayStatus || billing.gatewayStatus || null,
                  status: normalizedStatus,
                  paidAt: normalizedStatus === 'paid'
                    ? (billing.paidAt || new Date())
                    : billing.paidAt
                }
              });
              summary.gatewayUpdates += 1;

              if (normalizedStatus === 'paid' && billing.status !== 'paid') {
                try {
                  await ensureNextMonthlyBillingForCondo(billing.condoId, billing.billingMonth);
                } catch (nextBillingError) {
                  console.warn(`[MASTER SYNC] Falha ao preparar proxima cobranca para ${billing.condoId}: ${nextBillingError.message}`);
                }
              }
            }
          } catch (error) {
            summary.gatewayErrors += 1;
            console.warn(`[MASTER SYNC] Falha ao consultar cobranca ${billing.id}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.warn(`[MASTER SYNC] Falha ao inicializar gateway para sincronizacao: ${error.message}`);
      summary.gatewayErrors += 1;
    }
  }

  const transitionCandidates = await prisma.licenseBilling.findMany({
    where: {
      ...condoWhere,
      status: { in: ['pending', 'processing', 'overdue'] }
    },
    select: {
      id: true,
      status: true,
      dueDate: true
    }
  });

  for (const billing of transitionCandidates) {
    const daysPastDue = getDaysPastDue(billing.dueDate, now);
    const shouldBeOverdue = daysPastDue > 0 && (billing.status === 'pending' || billing.status === 'processing');
    const shouldReturnPending = daysPastDue <= 0 && billing.status === 'overdue';
    if (!shouldBeOverdue && !shouldReturnPending) continue;

    await prisma.licenseBilling.update({
      where: { id: billing.id },
      data: { status: shouldBeOverdue ? 'overdue' : 'pending' }
    });
    summary.statusTransitions += 1;
  }

  const openBillings = await prisma.licenseBilling.findMany({
    where: {
      ...condoWhere,
      status: { in: OPEN_LICENSE_STATUSES }
    },
    select: {
      condoId: true,
      amount: true,
      dueDate: true
    }
  });

  const licenseStateByCondo = new Map();
  for (const billing of openBillings) {
    const current = licenseStateByCondo.get(billing.condoId) || { pendingTotal: 0, mustBlock: false };
    const amount = Number(billing.amount) || 0;
    current.pendingTotal += amount;
    if (getDaysPastDue(billing.dueDate, now) > summary.blockGraceDays) {
      current.mustBlock = true;
    }
    licenseStateByCondo.set(billing.condoId, current);
  }

  const condos = await prisma.condominium.findMany({
    where: condoId ? { id: condoId } : { active: true },
    select: {
      id: true,
      blocked: true,
      pendingCharges: true
    }
  });

  for (const condo of condos) {
    const state = licenseStateByCondo.get(condo.id) || { pendingTotal: 0, mustBlock: false };
    const normalizedPending = Math.round(state.pendingTotal * 100) / 100;
    const shouldBlock = Boolean(state.mustBlock);
    const pendingChanged = Number(condo.pendingCharges || 0) !== normalizedPending;
    const blockedChanged = Boolean(condo.blocked) !== shouldBlock;

    if (!pendingChanged && !blockedChanged) continue;

    await prisma.condominium.update({
      where: { id: condo.id },
      data: {
        pendingCharges: normalizedPending,
        blocked: shouldBlock
      }
    });

    if (!condo.blocked && shouldBlock) summary.condosBlocked += 1;
    if (condo.blocked && !shouldBlock) summary.condosUnblocked += 1;
    summary.condosUpdated += 1;
  }

  return summary;
}

let licenseSyncInProgress = false;

async function runLicenseSync(options = {}) {
  if (licenseSyncInProgress) {
    return { skipped: true, reason: 'sync_in_progress' };
  }

  licenseSyncInProgress = true;
  try {
    return await syncAndEnforceLicenseState(options);
  } finally {
    licenseSyncInProgress = false;
  }
}

async function safelyRunLicenseSync(options = {}, context = 'unknown') {
  try {
    return await runLicenseSync(options);
  } catch (error) {
    console.error(`[MASTER SYNC] Falha em ${context}:`, error);
    return { error: error.message };
  }
}

router.post('/master/config', express.json(), authMiddleware, async (req, res) => {
  try {
    const {
      provider,
      apiKey,
      environment = 'sandbox',
      webhookSecret,
      defaultLicenseValue,
      billingDay,
      blockGraceDays,
      autoGenerateBillings,
      recurrenceDay,
      autoIssueCharges,
      autoIssueMethod
    } = req.body;
    const user = req.user;

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode configurar o gateway master' });
    }

    const existingConfig = await prisma.masterGatewayConfig.findUnique({
      where: { id: 'master' }
    });

    const normalizedProvider = String(provider || existingConfig?.provider || '').trim().toLowerCase();
    const submittedApiKey = String(apiKey || '').trim();
    const normalizedApiKey = submittedApiKey || existingConfig?.credentials || '';
    const normalizedEnvironment = String(environment || existingConfig?.environment || 'sandbox').trim().toLowerCase();

    if (!normalizedProvider || !normalizedApiKey) {
      return res.status(400).json({ error: 'provider e apiKey são obrigatórios' });
    }

    try {
      if (existingConfig && normalizedProvider !== existingConfig.provider && !submittedApiKey) {
        return res.status(400).json({
          error: 'Informe a nova apiKey ao trocar o provider do gateway'
        });
      }

      const gateway = createGatewayIntegration(normalizedProvider, normalizedApiKey, normalizedEnvironment);
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

    const parsedDefaultLicenseValue = Number(defaultLicenseValue);
    const normalizedDefaultLicenseValue = Number.isFinite(parsedDefaultLicenseValue) && parsedDefaultLicenseValue > 0
      ? parsedDefaultLicenseValue
      : 299.00;
    const normalizedBillingDay = parseMonthDay(billingDay, 5);
    const normalizedBlockGraceDays = parseBlockGraceDays(blockGraceDays, DEFAULT_BLOCK_GRACE_DAYS);
    const normalizedAutoGenerateBillings = parseBooleanFlag(autoGenerateBillings, true);
    const normalizedRecurrenceDay = parseMonthDay(recurrenceDay, DEFAULT_RECURRENCE_DAY);
    const normalizedAutoIssueCharges = parseBooleanFlag(autoIssueCharges, false);
    const normalizedAutoIssueMethod = normalizeAutoIssueMethod(autoIssueMethod, DEFAULT_AUTO_ISSUE_METHOD);

    const config = await prisma.masterGatewayConfig.upsert({
      where: { id: 'master' },
      update: {
        provider: normalizedProvider,
        credentials: normalizedApiKey,
        webhookSecret: webhookSecret || null,
        environment: normalizedEnvironment,
        isActive: true,
        defaultLicenseValue: normalizedDefaultLicenseValue,
        billingDay: normalizedBillingDay,
        blockGraceDays: normalizedBlockGraceDays,
        autoGenerateBillings: normalizedAutoGenerateBillings,
        recurrenceDay: normalizedRecurrenceDay,
        autoIssueCharges: normalizedAutoIssueCharges,
        autoIssueMethod: normalizedAutoIssueMethod,
        updatedAt: new Date()
      },
      create: {
        id: 'master',
        provider: normalizedProvider,
        credentials: normalizedApiKey,
        webhookSecret: webhookSecret || null,
        environment: normalizedEnvironment,
        isActive: true,
        defaultLicenseValue: normalizedDefaultLicenseValue,
        billingDay: normalizedBillingDay,
        blockGraceDays: normalizedBlockGraceDays,
        autoGenerateBillings: normalizedAutoGenerateBillings,
        recurrenceDay: normalizedRecurrenceDay,
        autoIssueCharges: normalizedAutoIssueCharges,
        autoIssueMethod: normalizedAutoIssueMethod
      }
    });

    await safelyRunLicenseSync({ syncGateway: false }, 'master/config');

    res.json({
      success: true,
      message: `Gateway Master ${normalizedProvider} configurado com sucesso!`,
      config: {
        id: config.id,
        name: config.name,
        provider: config.provider,
        environment: config.environment,
        isActive: config.isActive,
        defaultLicenseValue: config.defaultLicenseValue,
        billingDay: config.billingDay,
        blockGraceDays: config.blockGraceDays,
        autoGenerateBillings: config.autoGenerateBillings,
        recurrenceDay: config.recurrenceDay,
        autoIssueCharges: config.autoIssueCharges,
        autoIssueMethod: config.autoIssueMethod,
        lastRecurringRunMonth: config.lastRecurringRunMonth,
        lastRecurringRunAt: config.lastRecurringRunAt
      }
    });
  } catch (error) {
    console.error('Erro ao configurar gateway master:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/master/config', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode ver a configuração' });
    }

    const config = await prisma.masterGatewayConfig.findUnique({
      where: { id: 'master' }
    });

    if (!config) {
      return res.json({ configured: false });
    }

    res.json({
      configured: true,
      config: {
        id: config.id,
        name: config.name,
        provider: config.provider,
        environment: config.environment,
        isActive: config.isActive,
        defaultLicenseValue: config.defaultLicenseValue,
        billingDay: config.billingDay,
        blockGraceDays: parseBlockGraceDays(config.blockGraceDays, DEFAULT_BLOCK_GRACE_DAYS),
        autoGenerateBillings: Boolean(config.autoGenerateBillings),
        recurrenceDay: parseMonthDay(config.recurrenceDay, DEFAULT_RECURRENCE_DAY),
        autoIssueCharges: Boolean(config.autoIssueCharges),
        autoIssueMethod: normalizeAutoIssueMethod(config.autoIssueMethod, DEFAULT_AUTO_ISSUE_METHOD),
        lastRecurringRunMonth: config.lastRecurringRunMonth,
        lastRecurringRunAt: config.lastRecurringRunAt,
        lastHealthCheck: config.lastHealthCheck,
        lastSuccessfulCharge: config.lastSuccessfulCharge
      }
    });
  } catch (error) {
    console.error('Erro ao buscar config master:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/master/config', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas admin pode remover a configuração do gateway master' });
    }

    await prisma.masterGatewayConfig.delete({
      where: { id: 'master' }
    });

    res.json({
      success: true,
      message: 'Configuração master removida com sucesso'
    });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Configuracao master nao encontrada' });
    }
    console.error('Erro ao remover config master:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/master/health-check', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode fazer health check' });
    }

    const config = await prisma.masterGatewayConfig.findUnique({
      where: { id: 'master' }
    });

    if (!config) {
      return res.status(404).json({ error: 'Gateway Master não configurado' });
    }

    let isConnected = false;
    let responseTime = 0;
    let errorMessage = null;

    try {
      const gateway = createGatewayIntegration(config.provider, config.credentials, config.environment);
      const startTime = Date.now();
      const testResult = await gateway.testConnection();
      responseTime = Date.now() - startTime;
      isConnected = Boolean(testResult.connected);
    } catch (error) {
      errorMessage = error.message;
    }

    await prisma.masterGatewayConfig.update({
      where: { id: 'master' },
      data: {
        lastHealthCheck: new Date(),
        isActive: isConnected
      }
    });

    res.json({
      success: true,
      isConnected,
      responseTime,
      provider: config.provider,
      error: errorMessage
    });
  } catch (error) {
    console.error('Erro no health check:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/master/sync-license-status', express.json(), authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode sincronizar status de licenca' });
    }

    const { condoId, syncGateway = true, maxGatewayChecks = 120 } = req.body || {};

    const result = await runLicenseSync({
      condoId: condoId || null,
      syncGateway: Boolean(syncGateway),
      maxGatewayChecks: Number(maxGatewayChecks) || 120
    });

    return res.json({
      success: true,
      message: result?.skipped ? 'Sincronizacao ignorada (ja em execucao)' : 'Sincronizacao concluida',
      result
    });
  } catch (error) {
    console.error('Erro ao sincronizar status de licenca:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/condos', express.json(), authMiddleware, async (req, res) => {
  try {
    const {
      name,
      address,
      city,
      units,
      residents,
      cnpj,
      email,
      phone,
      sindicoId,
      sindicoName,
      licenseValue
    } = req.body;
    const user = req.user;

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode criar condomínios' });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        error: 'name e obrigatorio'
      });
    }

    const normalizedCnpj = normalizeDocument(cnpj);
    if (normalizedCnpj && !isValidCNPJ(normalizedCnpj)) {
      return res.status(400).json({
        error: 'CNPJ invalido. Informe um CNPJ valido para gerar cobrancas no gateway.'
      });
    }

    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        error: 'Email invalido. Informe um email valido para envio de cobrancas.'
      });
    }

    const masterConfig = await prisma.masterGatewayConfig.findUnique({
      where: { id: 'master' }
    });

    if (!masterConfig) {
      return res.status(400).json({
        error: 'Gateway Master não configurado. Configure antes de criar condomínios.'
      });
    }

    const parsedLicenseValue = Number(licenseValue);
    const finalLicenseValue = Number.isFinite(parsedLicenseValue) && parsedLicenseValue > 0
      ? parsedLicenseValue
      : masterConfig.defaultLicenseValue;

    const condo = await prisma.condominium.create({
      data: {
        name: String(name).trim(),
        cnpj: normalizedCnpj || null,
        email: normalizedEmail || null,
        phone: phone ? String(phone).trim() : null,
        address: address ? String(address).trim() : '',
        city: city ? String(city).trim() : '',
        units: Number.parseInt(String(units || 0), 10) || 0,
        residents: Number.parseInt(String(residents || 0), 10) || 0,
        sindico: sindicoName ? String(sindicoName).trim() : 'Sindico nao definido',
        sindicoId: sindicoId ? String(sindicoId).trim() : 'sem-sindico',
        active: true,
        blocked: false,
        monthlyRevenue: 0,
        pendingCharges: 0,
        licenseValue: finalLicenseValue
      }
    });

    ensureCondoFolders(condo.id);

    await prisma.licenseBilling.create({
      data: {
        condoId: condo.id,
        description: `Licença INOVATECH CONNECT - ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}`,
        amount: finalLicenseValue,
        dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, masterConfig.billingDay),
        billingMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        status: 'pending',
        ...buildBillingCustomerSnapshot(condo)
      }
    });

    await safelyRunLicenseSync({ condoId: condo.id, syncGateway: false }, 'condos/create');

    res.json({
      success: true,
      condo: {
        id: condo.id,
        name: condo.name,
        cnpj: condo.cnpj,
        email: condo.email,
        phone: condo.phone,
        address: condo.address,
        city: condo.city,
        units: condo.units,
        sindico: condo.sindico,
        sindicoId: condo.sindicoId,
        licenseValue: condo.licenseValue,
        createdAt: condo.createdAt
      },
      message: `Condomínio criado com sucesso! Gateway configurado automaticamente.`
    });
  } catch (error) {
    console.error('Erro ao criar condomínio:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/condos', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode listar condomínios' });
    }

    await safelyRunLicenseSync({ syncGateway: false }, 'condos/list');

    const condos = await prisma.condominium.findMany({
      where: { active: true },
      include: {
        _count: {
          select: { users: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      count: condos.length,
      condos: condos.map(c => ({
        id: c.id,
        name: c.name,
        cnpj: c.cnpj,
        email: c.email,
        phone: c.phone,
        address: c.address,
        city: c.city,
        units: c.units,
        residents: c.residents,
        sindico: c.sindico,
        sindicoId: c.sindicoId,
        active: c.active,
        blocked: c.blocked,
        licenseValue: c.licenseValue,
        pendingCharges: c.pendingCharges,
        createdAt: c.createdAt,
        userCount: c._count.users
      }))
    });
  } catch (error) {
    console.error('Erro ao listar condomínios:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/condos/:condoId/generate-license-billing', express.json(), authMiddleware, async (req, res) => {
  try {
    const { condoId } = req.params;
    const user = req.user;

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode gerar cobranças' });
    }

    const condo = await prisma.condominium.findUnique({
      where: { id: condoId }
    });

    if (!condo) {
      return res.status(404).json({ error: 'Condomínio não encontrado' });
    }

    const masterConfig = await prisma.masterGatewayConfig.findUnique({
      where: { id: 'master' }
    });

    if (!masterConfig) {
      return res.status(400).json({ error: 'Gateway Master não configurado' });
    }

    const currentMonth = new Date();
    const billingMonth = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

    const existingBilling = await prisma.licenseBilling.findFirst({
      where: {
        condoId,
        billingMonth
      }
    });

    if (existingBilling) {
      return res.status(400).json({
        error: `Cobrança já existe para ${billingMonth}`,
        billing: existingBilling
      });
    }

    const dueDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, masterConfig.billingDay);

    const billing = await prisma.licenseBilling.create({
      data: {
        condoId,
        masterGatewayId: masterConfig.id,
        description: `Licença INOVATECH CONNECT - ${currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}`,
        amount: condo.licenseValue,
        dueDate,
        billingMonth,
        status: 'pending',
        ...buildBillingCustomerSnapshot(condo)
      }
    });

    await safelyRunLicenseSync({ condoId, syncGateway: false }, 'billings/generate');

    res.json({
      success: true,
      billing: {
        id: billing.id,
        condoId: billing.condoId,
        description: billing.description,
        amount: billing.amount,
        dueDate: billing.dueDate,
        billingMonth: billing.billingMonth,
        status: billing.status,
        createdAt: billing.createdAt
      }
    });
  } catch (error) {
    console.error('Erro ao gerar cobrança:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/condos/:condoId/manual-license-billing', express.json(), authMiddleware, async (req, res) => {
  try {
    const { condoId } = req.params;
    const user = req.user;
    const {
      description,
      amount,
      dueDate,
      customerName,
      customerEmail,
      customerCnpj
    } = req.body || {};

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode criar cobrancas manuais' });
    }

    const condo = await prisma.condominium.findUnique({
      where: { id: condoId }
    });

    if (!condo) {
      return res.status(404).json({ error: 'Condominio nao encontrado' });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'amount deve ser maior que zero' });
    }

    const parsedDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ error: 'dueDate invalido' });
    }

    const billingMonth = `${parsedDueDate.getFullYear()}-${String(parsedDueDate.getMonth() + 1).padStart(2, '0')}`;

    const normalizedManualEmail = normalizeEmail(customerEmail || condo.email || `${condoId}@inovatech.local`);
    const normalizedManualCnpj = normalizeDocument(customerCnpj || condo.cnpj);

    if (normalizedManualCnpj && !isValidCNPJ(normalizedManualCnpj)) {
      return res.status(400).json({ error: 'CNPJ invalido para criar cobranca manual' });
    }

    if (normalizedManualEmail && !isValidEmail(normalizedManualEmail)) {
      return res.status(400).json({ error: 'Email invalido para criar cobranca manual' });
    }

    const billing = await prisma.licenseBilling.create({
      data: {
        condoId,
        masterGatewayId: 'master',
        description: String(description || `Licenca INOVATECH CONNECT - ${billingMonth}`),
        amount: parsedAmount,
        dueDate: parsedDueDate,
        billingMonth,
        status: 'pending',
        customerName: customerName || condo.name,
        customerEmail: normalizedManualEmail || null,
        customerCnpj: normalizedManualCnpj || null,
        customerAddress: condo.address || null,
        customerCity: condo.city || null,
        customerUnits: Number.isFinite(condo.units) ? condo.units : null
      }
    });

    await safelyRunLicenseSync({ condoId, syncGateway: false }, 'billings/manual');

    return res.json({
      success: true,
      billing: {
        id: billing.id,
        condoId: billing.condoId,
        description: billing.description,
        amount: billing.amount,
        dueDate: billing.dueDate,
        billingMonth: billing.billingMonth,
        status: billing.status,
        createdAt: billing.createdAt
      }
    });
  } catch (error) {
    console.error('Erro ao criar cobranca manual de licenca:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/condos/:condoId/charge-license', express.json(), authMiddleware, async (req, res) => {
  try {
    const { condoId } = req.params;
    const { billingId, method = 'pix' } = req.body;
    const user = req.user;
    const normalizedMethod = normalizeLicensePaymentMethod(method);

    if (!canAccessCondoLicense(user, condoId)) {
      return res.status(403).json({ error: 'Sem permissao para cobrar licenca deste condominio' });
    }

    if (!normalizedMethod) {
      return res.status(400).json({
        error: 'Metodo de pagamento invalido. Use pix, boleto, credit_card ou debit_card'
      });
    }

    const masterConfig = await prisma.masterGatewayConfig.findUnique({
      where: { id: 'master' }
    });

    if (!masterConfig) {
      return res.status(400).json({ error: 'Gateway Master não configurado' });
    }

    let billing;
    if (billingId) {
      billing = await prisma.licenseBilling.findUnique({
        where: { id: billingId }
      });
      if (billing && billing.condoId !== condoId) {
        return res.status(400).json({ error: 'billingId nao pertence ao condominio informado' });
      }
    } else {
      billing = await prisma.licenseBilling.findFirst({
        where: {
          condoId,
          status: { in: ['pending', 'overdue', 'failed'] }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!billing) {
      return res.status(404).json({ error: 'Cobrança não encontrada' });
    }

    if (billing.status === 'paid') {
      return res.status(400).json({ error: 'Esta cobranca ja foi paga' });
    }

    const condo = await prisma.condominium.findUnique({
      where: { id: condoId }
    });

    if (!condo) {
      return res.status(404).json({ error: 'Condomínio não encontrado' });
    }

    const gateway = createGatewayIntegration(
      masterConfig.provider,
      masterConfig.credentials,
      masterConfig.environment
    );

    const customerSnapshot = {
      customerName: billing.customerName || condo.name,
      customerEmail: normalizeEmail(billing.customerEmail || condo.email || `${condo.id}@inovatech.local`),
      customerCnpj: normalizeDocument(billing.customerCnpj || condo.cnpj),
      customerAddress: billing.customerAddress || condo.address || null,
      customerCity: billing.customerCity || condo.city || null,
      customerUnits: billing.customerUnits ?? condo.units ?? null
    };

    const chargeData = {
      value: billing.amount,
      description: billing.description,
      customerName: customerSnapshot.customerName,
      customerEmail: customerSnapshot.customerEmail,
      customerCpf: customerSnapshot.customerCnpj,
      customerCnpj: customerSnapshot.customerCnpj,
      customerAddress: customerSnapshot.customerAddress,
      customerCity: customerSnapshot.customerCity,
      customerUnits: customerSnapshot.customerUnits,
      billingType: mapLicenseMethodToBillingType(normalizedMethod),
      externalReference: `LIC-${billing.id}`
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
      return res.status(400).json({
        error: 'Falha ao criar cobrança no gateway',
        details: error.message
      });
    }

    await prisma.licenseBilling.update({
      where: { id: billing.id },
      data: {
        gatewayProvider: masterConfig.provider,
        gatewayChargeId: gatewayCharge.id || gatewayCharge.externalReference,
        gatewayStatus: gatewayCharge.status || 'PENDING',
        status: normalizeBillingStatusFromGateway(gatewayCharge.status, 'processing'),
        ...customerSnapshot
      }
    });

    await safelyRunLicenseSync({ condoId, syncGateway: true, maxGatewayChecks: 80 }, 'billings/charge-license');

    res.json({
      success: true,
      billing: {
        id: billing.id,
        amount: billing.amount,
        description: billing.description,
        status: normalizeBillingStatusFromGateway(gatewayCharge.status, 'processing')
      },
      gateway: {
        provider: masterConfig.provider,
        chargeId: gatewayCharge.id || gatewayCharge.externalReference || null,
        method: normalizedMethod,
        pixCode: gatewayCharge.pixCode || gatewayCharge.qrcode || null,
        qrCodeImage: gatewayCharge.qrCodeImage || null,
        boletoUrl: gatewayCharge.bankSlipUrl || gatewayCharge.invoiceUrl || gatewayCharge.url || null,
        checkoutUrl: gatewayCharge.checkoutUrl || gatewayCharge.invoiceUrl || gatewayCharge.url || null
      }
    });
  } catch (error) {
    console.error('Erro ao cobrar licença:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/condos/:condoId/sindico-billings', authMiddleware, async (req, res) => {
  try {
    const { condoId } = req.params;
    const user = req.user;

    if (!canAccessCondoLicense(user, condoId)) {
      return res.status(403).json({ error: 'Sem permissao para visualizar cobrancas deste condominio' });
    }

    const shouldSyncGateway = String(req.query.syncGateway || 'true').toLowerCase() !== 'false';
    const maxGatewayChecks = Number(req.query.maxGatewayChecks || 80) || 80;
    const billingId = req.query.billingId ? String(req.query.billingId) : null;
    const statusFilter = req.query.status ? String(req.query.status) : null;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 60) || 60));

    await safelyRunLicenseSync({
      condoId,
      syncGateway: shouldSyncGateway,
      maxGatewayChecks
    }, 'billings/sindico-list');

    const masterConfig = await prisma.masterGatewayConfig.findUnique({
      where: { id: 'master' },
      select: {
        provider: true,
        environment: true,
        isActive: true,
        blockGraceDays: true,
        billingDay: true
      }
    });

    const condo = await prisma.condominium.findUnique({
      where: { id: condoId },
      select: {
        id: true,
        name: true,
        blocked: true,
        pendingCharges: true,
        licenseValue: true
      }
    });

    if (!condo) {
      return res.status(404).json({ error: 'Condominio nao encontrado' });
    }

    const where = {
      condoId,
      ...(billingId ? { id: billingId } : {}),
      ...(statusFilter ? { status: statusFilter } : {})
    };

    const billings = await prisma.licenseBilling.findMany({
      where,
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
      take: limit
    });

    const now = new Date();
    const blockGraceDays = parseBlockGraceDays(masterConfig?.blockGraceDays, DEFAULT_BLOCK_GRACE_DAYS);

    return res.json({
      success: true,
      condo,
      config: {
        provider: masterConfig?.provider || null,
        environment: masterConfig?.environment || null,
        isActive: Boolean(masterConfig?.isActive),
        billingDay: masterConfig?.billingDay || null,
        blockGraceDays
      },
      count: billings.length,
      billings: billings.map((billing) => {
        const daysPastDue = getDaysPastDue(billing.dueDate, now);
        return {
          id: billing.id,
          condoId: billing.condoId,
          description: billing.description,
          amount: billing.amount,
          dueDate: billing.dueDate,
          billingMonth: billing.billingMonth,
          status: billing.status,
          paidAt: billing.paidAt,
          createdAt: billing.createdAt,
          gatewayProvider: billing.gatewayProvider,
          gatewayChargeId: billing.gatewayChargeId,
          gatewayStatus: billing.gatewayStatus,
          customerName: billing.customerName,
          customerEmail: billing.customerEmail,
          customerCnpj: billing.customerCnpj,
          daysPastDue,
          isOverdue: daysPastDue > 0,
          willBlock: daysPastDue > blockGraceDays,
          canPay: ['pending', 'overdue', 'failed'].includes(String(billing.status || ''))
        };
      })
    });
  } catch (error) {
    console.error('Erro ao listar cobrancas do sindico:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/condos/:condoId/sync-license-status', express.json(), authMiddleware, async (req, res) => {
  try {
    const { condoId } = req.params;
    const user = req.user;

    if (!canAccessCondoLicense(user, condoId)) {
      return res.status(403).json({ error: 'Sem permissao para sincronizar licenca deste condominio' });
    }

    const { billingId = null, syncGateway = true, maxGatewayChecks = 80 } = req.body || {};
    const result = await runLicenseSync({
      condoId,
      syncGateway: Boolean(syncGateway),
      maxGatewayChecks: Number(maxGatewayChecks) || 80
    });

    const [billing, condo, masterConfig] = await Promise.all([
      billingId ? prisma.licenseBilling.findFirst({ where: { id: billingId, condoId } }) : null,
      prisma.condominium.findUnique({
        where: { id: condoId },
        select: { id: true, name: true, blocked: true, pendingCharges: true, licenseValue: true }
      }),
      prisma.masterGatewayConfig.findUnique({
        where: { id: 'master' },
        select: { blockGraceDays: true }
      })
    ]);

    return res.json({
      success: true,
      message: result?.skipped ? 'Sincronizacao ignorada (ja em execucao)' : 'Sincronizacao concluida',
      result,
      blockGraceDays: parseBlockGraceDays(masterConfig?.blockGraceDays, DEFAULT_BLOCK_GRACE_DAYS),
      condo,
      billing: billing ? {
        id: billing.id,
        condoId: billing.condoId,
        status: billing.status,
        gatewayStatus: billing.gatewayStatus,
        paidAt: billing.paidAt,
        dueDate: billing.dueDate
      } : null
    });
  } catch (error) {
    console.error('Erro ao sincronizar status de licenca do condominio:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/billings', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode ver cobranças' });
    }

    await safelyRunLicenseSync({ syncGateway: true, maxGatewayChecks: 120 }, 'billings/list');

    const { status, month } = req.query;

    let where = {};
    if (status) where.status = status;
    if (month) where.billingMonth = month;

    const billings = await prisma.licenseBilling.findMany({
      where,
      include: {
        condominium: {
          select: {
            id: true,
            name: true,
            sindico: true,
            blocked: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({
      success: true,
      count: billings.length,
      billings: billings.map(b => ({
        id: b.id,
        condoId: b.condoId,
        condoName: b.condominium.name,
        sindico: b.condominium.sindico,
        description: b.description,
        amount: b.amount,
        dueDate: b.dueDate,
        billingMonth: b.billingMonth,
        status: b.status,
        paidAt: b.paidAt,
        customerName: b.customerName,
        customerEmail: b.customerEmail,
        customerCnpj: b.customerCnpj,
        customerAddress: b.customerAddress,
        customerCity: b.customerCity,
        customerUnits: b.customerUnits,
        gatewayProvider: b.gatewayProvider,
        gatewayChargeId: b.gatewayChargeId,
        createdAt: b.createdAt,
        blocked: b.condominium.blocked
      }))
    });
  } catch (error) {
    console.error('Erro ao listar cobranças:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/billings/:billingId', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { billingId } = req.params;

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode remover cobrancas' });
    }

    const billing = await prisma.licenseBilling.findUnique({
      where: { id: billingId }
    });

    if (!billing) {
      return res.status(404).json({ error: 'Cobranca nao encontrada' });
    }

    const gatewayCancellation = await cancelLicenseChargeInGatewayIfNeeded(billing);

    await prisma.licenseBilling.delete({
      where: { id: billingId }
    });

    await prisma.licenseCharge.deleteMany({
      where: {
        OR: [
          { id: billingId },
          {
            condoId: billing.condoId,
            description: billing.description,
            amount: billing.amount,
            dueDate: billing.dueDate
          }
        ]
      }
    });

    await safelyRunLicenseSync({ condoId: billing.condoId, syncGateway: false }, 'billings/delete');

    return res.json({
      success: true,
      message: 'Cobranca removida com sucesso',
      billingId,
      gatewayCancellation
    });
  } catch (error) {
    console.error('Erro ao remover cobranca:', error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/billings/:billingId/webhook', express.json(), async (req, res) => {
  try {
    const { billingId } = req.params;
    const body = req.body;

    console.log(`[MASTER WEBHOOK] Billing ${billingId}:`, JSON.stringify(body).slice(0, 500));

    const masterConfig = await prisma.masterGatewayConfig.findUnique({
      where: { id: 'master' }
    });

    if (!masterConfig) {
      return res.status(200).json({ received: true });
    }

    let chargeId, gwStatus;

    if (masterConfig.provider === 'asaas') {
      chargeId = body.payment?.id;
      gwStatus = body.payment?.status;
    } else if (masterConfig.provider === 'mercadopago') {
      chargeId = body.data?.id;
      gwStatus = body.data?.status;
    } else if (masterConfig.provider === 'stripe') {
      chargeId = body.data?.object?.id;
      gwStatus = body.data?.object?.status;
    }

    if (!chargeId) {
      return res.status(200).json({ received: true });
    }

    const billing = await prisma.licenseBilling.findFirst({
      where: { gatewayChargeId: chargeId }
    });

    if (!billing) {
      return res.status(200).json({ received: true });
    }

    const newStatus = normalizeBillingStatusFromGateway(gwStatus, billing.status);

    await prisma.licenseBilling.update({
      where: { id: billing.id },
      data: {
        gatewayStatus: gwStatus || billing.gatewayStatus || null,
        status: newStatus,
        paidAt: newStatus === 'paid' && !billing.paidAt ? new Date() : billing.paidAt
      }
    });

    if (newStatus === 'paid') {
      await prisma.masterGatewayConfig.update({
        where: { id: 'master' },
        data: {
          lastSuccessfulCharge: new Date()
        }
      });

      try {
        await ensureNextMonthlyBillingForCondo(billing.condoId, billing.billingMonth);
      } catch (nextBillingError) {
        console.warn(`[MASTER WEBHOOK] Falha ao preparar proxima cobranca para ${billing.condoId}: ${nextBillingError.message}`);
      }
    }

    await safelyRunLicenseSync({ condoId: billing.condoId, syncGateway: false }, 'billings/webhook');

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Erro no webhook master:', error);
    res.status(200).json({ received: true, error: error.message });
  }
});

router.post('/auto-generate-monthly-billings', express.json(), authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const {
      issueCharges = false,
      method = DEFAULT_AUTO_ISSUE_METHOD
    } = req.body || {};

    if (!isMasterAdmin(user)) {
      return res.status(403).json({ error: 'Apenas Admin Master pode gerar cobranças' });
    }

    const result = await generateMonthlyLicenseBillings({
      referenceDate: new Date(),
      issueCharges: parseBooleanFlag(issueCharges, false),
      chargeMethod: normalizeAutoIssueMethod(method, DEFAULT_AUTO_ISSUE_METHOD),
      persistRecurringRun: false,
      trigger: 'manual-generate'
    });

    if (result?.skipped) {
      return res.status(409).json({
        error: 'Geracao mensal ja esta em execucao',
        details: result
      });
    }

    return res.json({
      success: true,
      message: result.issueCharges
        ? `Ciclo mensal processado: ${result.count} cobrancas novas e ${result.issuedCharges.length} cobrancas emitidas`
        : `Cobrancas geradas para ${result.count} condominios`,
      ...result
    });

    if (!masterConfig) {
      return res.status(400).json({ error: 'Gateway Master não configurado' });
    }

    const currentMonth = new Date();
    const billingMonth = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const dueDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, masterConfig.billingDay);

    const existingBillings = await prisma.licenseBilling.findMany({
      where: { billingMonth }
    });

    const existingCondoIds = new Set(existingBillings.map(b => b.condoId));

    const condos = await prisma.condominium.findMany({
      where: {
        active: true,
        id: { notIn: Array.from(existingCondoIds) }
      }
    });

    const createdBillings = [];

    for (const condo of condos) {
      const billing = await prisma.licenseBilling.create({
        data: {
          condoId: condo.id,
          masterGatewayId: masterConfig.id,
          description: `Licença INOVATECH CONNECT - ${currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}`,
          amount: condo.licenseValue,
          dueDate,
          billingMonth,
          status: 'pending',
          ...buildBillingCustomerSnapshot(condo)
        }
      });

      createdBillings.push(billing);
    }

    await safelyRunLicenseSync({ syncGateway: false }, 'billings/auto-generate');

    res.json({
      success: true,
      message: `Cobranças geradas para ${createdBillings.length} condomínios`,
      count: createdBillings.length,
      billingMonth,
      createdBillings: createdBillings.map(b => ({
        id: b.id,
        condoId: b.condoId,
        amount: b.amount,
        status: b.status
      }))
    });
  } catch (error) {
    console.error('Erro ao gerar cobranças mensais:', error);
    res.status(500).json({ error: error.message });
  }
});

const parsedLicenseSyncIntervalMs = Number.parseInt(String(process.env.LICENSE_SYNC_INTERVAL_MS || '120000'), 10);
const LICENSE_SYNC_INTERVAL_MS = Number.isNaN(parsedLicenseSyncIntervalMs) ? 120000 : parsedLicenseSyncIntervalMs;
const parsedRecurringBillingIntervalMs = Number.parseInt(String(process.env.LICENSE_RECURRING_INTERVAL_MS || '900000'), 10);
const LICENSE_RECURRING_INTERVAL_MS = Number.isNaN(parsedRecurringBillingIntervalMs) ? 900000 : parsedRecurringBillingIntervalMs;

if (LICENSE_SYNC_INTERVAL_MS > 0) {
  setTimeout(() => {
    void runLicenseSync({ syncGateway: true, maxGatewayChecks: 80 }).catch((error) => {
      console.error('Erro na sincronizacao inicial de licencas:', error);
    });
  }, 15000);

  setInterval(() => {
    void runLicenseSync({ syncGateway: true, maxGatewayChecks: 80 }).catch((error) => {
      console.error('Erro no job de sincronizacao de licencas:', error);
    });
  }, LICENSE_SYNC_INTERVAL_MS);
}

if (LICENSE_RECURRING_INTERVAL_MS > 0) {
  setTimeout(() => {
    void runRecurringBillingAutomation('startup').catch((error) => {
      console.error('Erro no disparo inicial da recorrencia de licencas:', error);
    });
  }, 20000);

  setInterval(() => {
    void runRecurringBillingAutomation('interval').catch((error) => {
      console.error('Erro no job de recorrencia de licencas:', error);
    });
  }, LICENSE_RECURRING_INTERVAL_MS);
}

export default router;

