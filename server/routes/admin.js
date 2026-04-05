import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/auth.js';
import { createGatewayIntegration } from '../gateway-integrations.js';
import { getAgentPublicConfig, probeAgentConnectivity } from '../agent-provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, '..', 'data', 'state.json');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const router = express.Router();
const prisma = new PrismaClient();

const INTERNAL_API_TIMEOUT_MS = 8000;
const INTERNAL_API_PROBES = [
  {
    id: 'health',
    name: 'Health API',
    endpoint: '/health',
    description: 'Health check publico do servidor',
    method: 'GET',
    requiresAuth: false,
    healthyStatusCodes: [200]
  },
  {
    id: 'auth',
    name: 'Auth API',
    endpoint: '/api/auth',
    description: 'Autenticacao, login e registro',
    method: 'POST',
    body: { email: '', password: '' },
    requiresAuth: false,
    healthyStatusCodes: [400],
    warningStatusCodes: [401, 403]
  },
  {
    id: 'users',
    name: 'Users API',
    endpoint: '/api/users',
    description: 'Gestao de usuarios',
    method: 'GET',
    healthyStatusCodes: [200]
  },
  {
    id: 'condos',
    name: 'Condos API',
    endpoint: '/api/condos',
    description: 'Gestao de condominios',
    method: 'GET',
    healthyStatusCodes: [200]
  },
  {
    id: 'admin',
    name: 'Admin API',
    endpoint: '/api/admin/routes',
    description: 'Monitoramento e utilitarios administrativos',
    method: 'GET',
    healthyStatusCodes: [200]
  },
  {
    id: 'gateway',
    name: 'Gateway API',
    endpoint: '/api/gateway/test-connection',
    description: 'Gateway dos condominios',
    method: 'POST',
    body: { provider: '', apiKey: '', environment: 'sandbox' },
    healthyStatusCodes: [400],
    warningStatusCodes: [403]
  },
  {
    id: 'uploads',
    name: 'Uploads API',
    endpoint: '/api/uploads/condo-folders',
    description: 'Upload de arquivos e anexos',
    method: 'GET',
    healthyStatusCodes: [200],
    warningStatusCodes: [403]
  },
  {
    id: 'chat',
    name: 'Chat API',
    endpoint: '/api/chat/users',
    description: 'Mensageria interna',
    method: 'GET',
    healthyStatusCodes: [200]
  },
  {
    id: 'support',
    name: 'Support API',
    endpoint: '/api/support/tickets',
    description: 'Central de suporte',
    method: 'GET',
    healthyStatusCodes: [200]
  },
  {
    id: 'master-gateway',
    name: 'Master Gateway API',
    endpoint: '/api/master-gateway/master/config',
    description: 'Licencas e cobranca master',
    method: 'GET',
    healthyStatusCodes: [200],
    warningStatusCodes: [403]
  },
  {
    id: 'sindico-gateway',
    name: 'Sindico Gateway API',
    endpoint: '/api/sindico-gateway/config',
    description: 'Gateway operacional do sindico',
    method: 'GET',
    healthyStatusCodes: [200],
    warningStatusCodes: [403]
  },
  {
    id: 'state',
    name: 'State API',
    endpoint: '/api/state',
    description: 'Persistencia e sincronizacao de estado',
    method: 'GET',
    healthyStatusCodes: [200]
  }
];

function isAdminUser(user) {
  return user?.role === 'admin' || user?.role === 'admin-master';
}

function buildProviderEndpoint(provider, environment = 'sandbox') {
  switch (String(provider || '').toLowerCase()) {
    case 'asaas':
      return environment === 'production'
        ? 'https://api.asaas.com/v3'
        : 'https://sandbox.asaas.com/api/v3';
    case 'mercadopago':
      return environment === 'production'
        ? 'https://api.mercadopago.com/v1'
        : 'https://api.mercadopago.com/sandbox/v1';
    case 'stripe':
      return 'https://api.stripe.com/v1';
    default:
      return '-';
  }
}

function getRequestBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = String(
    Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : (forwardedProto || req.protocol || 'http')
  )
    .split(',')[0]
    .trim()
    .toLowerCase() || 'http';
  const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
  return `${protocol}://${host}`;
}

function resolveProbeEndpoint(probe, context) {
  if (typeof probe.endpoint === 'function') {
    return probe.endpoint(context);
  }
  return probe.endpoint;
}

async function parseProbeError(response) {
  try {
    const payload = await response.json();
    if (payload?.error) return String(payload.error);
    if (payload?.message) return String(payload.message);
  } catch {
    // Ignore JSON parse errors and fallback to text.
  }

  try {
    const text = await response.text();
    if (text) {
      return text.slice(0, 180);
    }
  } catch {
    // Ignore text read errors.
  }

  return null;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / (1024 ** power);
  return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

function createStatusItem({
  id,
  category,
  name,
  scope,
  endpoint,
  status,
  connected,
  configured,
  latencyMs = null,
  lastCheckedAt = null,
  lastSuccessfulAt = null,
  details = [],
  error = null
}) {
  return {
    id,
    category,
    name,
    scope,
    endpoint,
    status,
    connected,
    configured,
    latencyMs,
    lastCheckedAt,
    lastSuccessfulAt,
    details,
    error
  };
}

async function testDatabase(nowIso) {
  try {
    const startedAt = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return createStatusItem({
      id: 'infra-database',
      category: 'infra',
      name: 'Banco de Dados',
      scope: 'Plataforma',
      endpoint: 'SQLite / Prisma',
      status: 'online',
      connected: true,
      configured: true,
      latencyMs: Date.now() - startedAt,
      lastCheckedAt: nowIso,
      details: ['Consulta SELECT 1 executada com sucesso']
    });
  } catch (error) {
    return createStatusItem({
      id: 'infra-database',
      category: 'infra',
      name: 'Banco de Dados',
      scope: 'Plataforma',
      endpoint: 'SQLite / Prisma',
      status: 'error',
      connected: false,
      configured: true,
      lastCheckedAt: nowIso,
      error: error.message,
      details: ['Falha ao consultar o banco principal']
    });
  }
}

async function testStateFile(nowIso) {
  try {
    const stats = await fs.stat(STATE_FILE);
    return createStatusItem({
      id: 'storage-state-file',
      category: 'storage',
      name: 'Arquivo state.json',
      scope: 'Persistencia local',
      endpoint: STATE_FILE,
      status: 'online',
      connected: true,
      configured: true,
      lastCheckedAt: nowIso,
      details: [
        `Tamanho: ${formatBytes(stats.size)}`,
        `Atualizado em: ${stats.mtime.toISOString()}`
      ]
    });
  } catch (error) {
    return createStatusItem({
      id: 'storage-state-file',
      category: 'storage',
      name: 'Arquivo state.json',
      scope: 'Persistencia local',
      endpoint: STATE_FILE,
      status: 'error',
      connected: false,
      configured: true,
      lastCheckedAt: nowIso,
      error: error.message,
      details: ['Arquivo de estado indisponivel']
    });
  }
}

async function testUploadsDirectory(nowIso) {
  try {
    const stats = await fs.stat(UPLOADS_DIR);
    return createStatusItem({
      id: 'storage-uploads',
      category: 'storage',
      name: 'Diretorio de uploads',
      scope: 'Arquivos',
      endpoint: UPLOADS_DIR,
      status: 'online',
      connected: true,
      configured: true,
      lastCheckedAt: nowIso,
      details: [
        `Tipo: ${stats.isDirectory() ? 'diretorio' : 'arquivo'}`,
        `Atualizado em: ${stats.mtime.toISOString()}`
      ]
    });
  } catch (error) {
    return createStatusItem({
      id: 'storage-uploads',
      category: 'storage',
      name: 'Diretorio de uploads',
      scope: 'Arquivos',
      endpoint: UPLOADS_DIR,
      status: 'error',
      connected: false,
      configured: true,
      lastCheckedAt: nowIso,
      error: error.message,
      details: ['Diretorio de uploads nao acessivel']
    });
  }
}

async function buildInternalApiStatuses(req, nowIso) {
  const baseUrl = getRequestBaseUrl(req);
  const authorization = req.header('Authorization');

  return Promise.all(INTERNAL_API_PROBES.map(async (probe) => {
    const endpoint = resolveProbeEndpoint(probe, {});
    const method = String(probe.method || 'GET').toUpperCase();
    const details = [
      probe.description,
      `Probe real: ${method} ${endpoint}`
    ];

    const headers = {};
    if (probe.requiresAuth !== false && authorization) {
      headers.Authorization = authorization;
    }
    if (probe.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INTERNAL_API_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(new URL(endpoint, baseUrl), {
        method,
        headers,
        body: probe.body !== undefined ? JSON.stringify(probe.body) : undefined,
        signal: controller.signal
      });

      const latencyMs = Date.now() - startedAt;
      const healthyStatusCodes = probe.healthyStatusCodes || [200];
      const warningStatusCodes = probe.warningStatusCodes || [];
      const isHealthy = healthyStatusCodes.includes(response.status);
      const isWarning = warningStatusCodes.includes(response.status);
      details.push(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`);

      if (isHealthy) {
        return createStatusItem({
          id: `internal-${probe.id}`,
          category: 'internal-api',
          name: probe.name,
          scope: 'Servidor',
          endpoint,
          status: 'online',
          connected: true,
          configured: true,
          latencyMs,
          lastCheckedAt: nowIso,
          details
        });
      }

      const parsedError = await parseProbeError(response);

      if (isWarning) {
        return createStatusItem({
          id: `internal-${probe.id}`,
          category: 'internal-api',
          name: probe.name,
          scope: 'Servidor',
          endpoint,
          status: 'warning',
          connected: true,
          configured: true,
          latencyMs,
          lastCheckedAt: nowIso,
          details,
          error: parsedError || `Resposta ${response.status} recebida durante o probe`
        });
      }

      return createStatusItem({
        id: `internal-${probe.id}`,
        category: 'internal-api',
        name: probe.name,
        scope: 'Servidor',
        endpoint,
        status: 'error',
        connected: false,
        configured: true,
        latencyMs,
        lastCheckedAt: nowIso,
        details,
        error: parsedError || `HTTP ${response.status} fora do esperado`
      });
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const timeoutError = error?.name === 'AbortError';
      details.push(timeoutError
        ? `Timeout apos ${INTERNAL_API_TIMEOUT_MS}ms`
        : 'Falha na requisicao do probe');

      return createStatusItem({
        id: `internal-${probe.id}`,
        category: 'internal-api',
        name: probe.name,
        scope: 'Servidor',
        endpoint,
        status: 'error',
        connected: false,
        configured: true,
        latencyMs,
        lastCheckedAt: nowIso,
        details,
        error: timeoutError ? 'Timeout no probe interno' : (error.message || 'Erro desconhecido no probe')
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }));
}

async function buildMasterGatewayStatus(masterConfig, nowIso) {
  if (!masterConfig) {
    return createStatusItem({
      id: 'gateway-master',
      category: 'gateway-master',
      name: 'Gateway Master',
      scope: 'Plataforma',
      endpoint: '-',
      status: 'not_configured',
      connected: null,
      configured: false,
      lastCheckedAt: nowIso,
      details: ['Nenhum gateway master configurado']
    });
  }

  const details = [
    `Provider: ${masterConfig.provider}`,
    `Ambiente: ${masterConfig.environment}`,
    `Recorrencia: ${masterConfig.autoGenerateBillings ? 'ativa' : 'desligada'}`,
    `Dia do ciclo: ${masterConfig.recurrenceDay}`,
    `Dia de vencimento: ${masterConfig.billingDay}`,
    masterConfig.autoIssueCharges
      ? `Emissao automatica: ${masterConfig.autoIssueMethod}`
      : 'Emissao automatica: nao'
  ];

  try {
    const startedAt = Date.now();
    const gateway = createGatewayIntegration(
      masterConfig.provider,
      masterConfig.credentials,
      masterConfig.environment
    );
    const result = await gateway.testConnection();

    return createStatusItem({
      id: 'gateway-master',
      category: 'gateway-master',
      name: 'Gateway Master',
      scope: 'Plataforma',
      endpoint: buildProviderEndpoint(masterConfig.provider, masterConfig.environment),
      status: result.connected ? 'online' : 'error',
      connected: result.connected,
      configured: true,
      latencyMs: Date.now() - startedAt,
      lastCheckedAt: nowIso,
      lastSuccessfulAt: masterConfig.lastSuccessfulCharge?.toISOString?.() || masterConfig.lastSuccessfulCharge || null,
      details,
      error: result.connected ? null : (result.message || 'Falha na conexao com o gateway master')
    });
  } catch (error) {
    return createStatusItem({
      id: 'gateway-master',
      category: 'gateway-master',
      name: 'Gateway Master',
      scope: 'Plataforma',
      endpoint: buildProviderEndpoint(masterConfig.provider, masterConfig.environment),
      status: 'error',
      connected: false,
      configured: true,
      lastCheckedAt: nowIso,
      lastSuccessfulAt: masterConfig.lastSuccessfulCharge?.toISOString?.() || masterConfig.lastSuccessfulCharge || null,
      details,
      error: error.message
    });
  }
}

async function buildCondoGatewayStatuses(nowIso) {
  const [configs, statuses, condos] = await Promise.all([
    prisma.gatewayConfig.findMany({
      where: { isActive: true },
      select: {
        id: true,
        condominiumId: true,
        name: true,
        provider: true,
        credentials: true,
        environment: true,
        webhookSecret: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ condominiumId: 'asc' }, { provider: 'asc' }]
    }),
    prisma.gatewayStatus.findMany({
      select: {
        condominiumId: true,
        provider: true,
        isConnected: true,
        lastHealthCheck: true,
        lastSuccessfulRequest: true,
        requestsSent: true,
        requestsReceived: true,
        successfulRequests: true,
        failedRequests: true,
        averageResponseTime: true,
        lastError: true,
        lastErrorAt: true
      }
    }),
    prisma.condominium.findMany({
      select: {
        id: true,
        name: true,
        active: true,
        blocked: true
      }
    })
  ]);

  if (configs.length === 0) {
    return [
      createStatusItem({
        id: 'gateway-condo-none',
        category: 'gateway-condo',
        name: 'Gateways dos condominios',
        scope: 'Condominios',
        endpoint: '-',
        status: 'not_configured',
        connected: null,
        configured: false,
        lastCheckedAt: nowIso,
        details: ['Nenhum gateway ativo configurado para os condominios']
      })
    ];
  }

  const condoById = new Map(condos.map((condo) => [condo.id, condo]));
  const statusByKey = new Map(
    statuses.map((status) => [`${status.condominiumId}:${status.provider}`, status])
  );

  return Promise.all(configs.map(async (config) => {
    const condo = condoById.get(config.condominiumId);
    const storedStatus = statusByKey.get(`${config.condominiumId}:${config.provider}`);
    const details = [
      `Condominio: ${condo?.name || config.condominiumId}`,
      `Ambiente: ${config.environment}`,
      `Condominio ativo: ${condo?.active ? 'sim' : 'nao'}`,
      `Condominio bloqueado: ${condo?.blocked ? 'sim' : 'nao'}`,
      `Webhook configurado: ${config.webhookSecret ? 'sim' : 'nao'}`,
      storedStatus ? `Requests enviadas: ${storedStatus.requestsSent}` : 'Requests enviadas: 0',
      storedStatus ? `Webhooks recebidos: ${storedStatus.requestsReceived}` : 'Webhooks recebidos: 0',
      storedStatus ? `Media de resposta armazenada: ${storedStatus.averageResponseTime} ms` : 'Media de resposta armazenada: 0 ms',
      storedStatus?.lastError ? `Ultimo erro registrado: ${storedStatus.lastError}` : 'Ultimo erro registrado: nenhum'
    ];

    try {
      const startedAt = Date.now();
      const gateway = createGatewayIntegration(
        config.provider,
        config.credentials,
        config.environment
      );
      const result = await gateway.testConnection();

      return createStatusItem({
        id: `gateway-condo-${config.id}`,
        category: 'gateway-condo',
        name: `${config.name} (${config.provider})`,
        scope: condo?.name || config.condominiumId,
        endpoint: buildProviderEndpoint(config.provider, config.environment),
        status: result.connected ? 'online' : 'error',
        connected: result.connected,
        configured: true,
        latencyMs: Date.now() - startedAt,
        lastCheckedAt: nowIso,
        lastSuccessfulAt: storedStatus?.lastSuccessfulRequest?.toISOString?.() || storedStatus?.lastSuccessfulRequest || null,
        details,
        error: result.connected
          ? null
          : (result.message || storedStatus?.lastError || 'Falha na conexao com o gateway do condominio')
      });
    } catch (error) {
      return createStatusItem({
        id: `gateway-condo-${config.id}`,
        category: 'gateway-condo',
        name: `${config.name} (${config.provider})`,
        scope: condo?.name || config.condominiumId,
        endpoint: buildProviderEndpoint(config.provider, config.environment),
        status: 'error',
        connected: false,
        configured: true,
        lastCheckedAt: nowIso,
        lastSuccessfulAt: storedStatus?.lastSuccessfulRequest?.toISOString?.() || storedStatus?.lastSuccessfulRequest || null,
        details,
        error: error.message || storedStatus?.lastError || 'Erro ao testar a conexao real'
      });
    }
  }));
}

async function buildAgentApiStatus(nowIso) {
  const config = getAgentPublicConfig();
  const endpoint = config.baseUrl ? `${String(config.baseUrl).replace(/\/+$/, '')}/v1/messages` : '-';
  const details = [
    `Provider: ${config.provider}`,
    `Modelo padrao: ${config.model || '-'}`,
    `Timeout request: ${config.timeoutMs}ms`
  ];

  if (!config.enabled) {
    return createStatusItem({
      id: 'internal-agent-api',
      category: 'internal-api',
      name: 'Agent API (IA)',
      scope: 'Servidor',
      endpoint,
      status: 'not_configured',
      connected: null,
      configured: false,
      lastCheckedAt: nowIso,
      details: [...details, 'Conector desativado (AGENT_ENABLED=false)']
    });
  }

  if (!config.configured) {
    return createStatusItem({
      id: 'internal-agent-api',
      category: 'internal-api',
      name: 'Agent API (IA)',
      scope: 'Servidor',
      endpoint,
      status: 'not_configured',
      connected: null,
      configured: false,
      lastCheckedAt: nowIso,
      details: [...details, `Pendencias de configuracao: ${config.missingFields.join(', ')}`]
    });
  }

  const probe = await probeAgentConnectivity();

  if (probe.httpStatus) {
    details.push(`HTTP probe: ${probe.httpStatus}`);
  }
  details.push(probe.cached ? 'Probe em cache de curto prazo' : 'Probe atualizado em tempo real');
  details.push(probe.message);

  return createStatusItem({
    id: 'internal-agent-api',
    category: 'internal-api',
    name: 'Agent API (IA)',
    scope: 'Servidor',
    endpoint,
    status: probe.status === 'online'
      ? 'online'
      : probe.status === 'warning'
        ? 'warning'
        : 'error',
    connected: probe.connected,
    configured: true,
    latencyMs: probe.latencyMs,
    lastCheckedAt: probe.checkedAt || nowIso,
    lastSuccessfulAt: probe.connected ? (probe.checkedAt || nowIso) : null,
    details,
    error: probe.error || null
  });
}

function summarizeConnections(connections) {
  return connections.reduce((summary, connection) => {
    summary.total += 1;
    if (connection.status === 'online') summary.online += 1;
    else if (connection.status === 'error') summary.error += 1;
    else if (connection.status === 'warning') summary.warning += 1;
    else if (connection.status === 'not_configured') summary.notConfigured += 1;
    return summary;
  }, {
    total: 0,
    online: 0,
    error: 0,
    warning: 0,
    notConfigured: 0
  });
}

const ROUTE_PROBE_TIMEOUT_MS = 4500;

function normalizeRegisteredRoutes(rawRoutes) {
  if (!Array.isArray(rawRoutes)) return [];
  const seen = new Set();
  const normalized = [];

  for (const route of rawRoutes) {
    const method = String(route?.method || '').toUpperCase();
    const path = String(route?.path || '').trim();
    if (!method || !path.startsWith('/')) continue;
    const source = String(route?.source || 'app');
    const key = `${method} ${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ method, path, source });
  }

  return normalized.sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method);
    return a.path.localeCompare(b.path);
  });
}

function hasDynamicSegments(routePath) {
  return routePath.includes(':') || routePath.includes('*') || routePath.includes('(');
}

async function probeRegisteredRoute(route, baseUrl, authorization, nowIso) {
  const dynamicPath = hasDynamicSegments(route.path);
  if (dynamicPath) {
    return {
      ...route,
      id: `${route.method} ${route.path}`,
      status: 'on',
      probeMethod: 'registered',
      statusCode: null,
      latencyMs: null,
      checkedAt: nowIso,
      error: null
    };
  }

  const probeMethod = route.method === 'GET' || route.method === 'HEAD'
    ? route.method
    : 'OPTIONS';

  const headers = {};
  if (authorization) {
    headers.Authorization = authorization;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ROUTE_PROBE_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(new URL(route.path, baseUrl), {
      method: probeMethod,
      headers,
      signal: controller.signal
    });

    return {
      ...route,
      id: `${route.method} ${route.path}`,
      status: response.status === 404 ? 'off' : 'on',
      probeMethod,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      checkedAt: nowIso,
      error: null
    };
  } catch (error) {
    const timeoutError = error?.name === 'AbortError';
    return {
      ...route,
      id: `${route.method} ${route.path}`,
      status: 'off',
      probeMethod,
      statusCode: null,
      latencyMs: Date.now() - startedAt,
      checkedAt: nowIso,
      error: timeoutError ? `Timeout apos ${ROUTE_PROBE_TIMEOUT_MS}ms` : (error?.message || 'Falha ao consultar rota')
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

router.get('/status', authMiddleware, async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Apenas admin pode ver o monitoramento' });
    }

    const nowIso = new Date().toISOString();
    const masterConfig = await prisma.masterGatewayConfig.findUnique({
      where: { id: 'master' }
    });

    const [databaseStatus, stateFileStatus, uploadsStatus, masterGatewayStatus, condoGatewayStatuses, agentApiStatus] = await Promise.all([
      testDatabase(nowIso),
      testStateFile(nowIso),
      testUploadsDirectory(nowIso),
      buildMasterGatewayStatus(masterConfig, nowIso),
      buildCondoGatewayStatuses(nowIso),
      buildAgentApiStatus(nowIso)
    ]);
    const internalApiStatuses = await buildInternalApiStatuses(req, nowIso);

    const connections = [
      createStatusItem({
        id: 'infra-server',
        category: 'infra',
        name: 'Servidor HTTP',
        scope: 'Plataforma',
        endpoint: `http://localhost:${process.env.PORT || 3000}/health`,
        status: 'online',
        connected: true,
        configured: true,
        lastCheckedAt: nowIso,
        details: ['Processo Express em execucao', 'Endpoint /health disponivel']
      }),
      databaseStatus,
      agentApiStatus,
      ...internalApiStatuses,
      stateFileStatus,
      uploadsStatus,
      masterGatewayStatus,
      ...condoGatewayStatuses
    ];

    res.json({
      timestamp: nowIso,
      summary: summarizeConnections(connections),
      connections
    });
  } catch (error) {
    console.error('Erro ao verificar monitoramento admin:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/routes/live', authMiddleware, async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Apenas admin pode ver as rotas' });
    }

    const nowIso = new Date().toISOString();
    const baseUrl = getRequestBaseUrl(req);
    const authorization = req.header('Authorization');
    const routes = normalizeRegisteredRoutes(req.app?.locals?.registeredRoutes || []);
    const currentRoutePath = `${req.baseUrl || ''}${req.path || ''}` || '/api/admin/routes/live';
    const statuses = await Promise.all(
      routes.map((route) => {
        if (route.method === req.method && route.path === currentRoutePath) {
          return Promise.resolve({
            ...route,
            id: `${route.method} ${route.path}`,
            status: 'on',
            probeMethod: 'registered',
            statusCode: null,
            latencyMs: null,
            checkedAt: nowIso,
            error: null
          });
        }
        return probeRegisteredRoute(route, baseUrl, authorization, nowIso);
      })
    );

    const summary = statuses.reduce((acc, route) => {
      acc.total += 1;
      if (route.status === 'on') acc.on += 1;
      else acc.off += 1;
      if (route.probeMethod === 'registered') acc.registeredOnly += 1;
      return acc;
    }, {
      total: 0,
      on: 0,
      off: 0,
      registeredOnly: 0
    });

    const healthRoute = statuses.find((route) => route.method === 'GET' && route.path === '/health');
    const server = {
      status: healthRoute?.status || 'off',
      latencyMs: healthRoute?.latencyMs ?? null,
      statusCode: healthRoute?.statusCode ?? null,
      checkedAt: nowIso
    };

    res.json({
      timestamp: nowIso,
      server,
      summary,
      routes: statuses
    });
  } catch (error) {
    console.error('Erro ao verificar rotas em tempo real:', error);
    res.status(500).json({ error: error?.message || 'Falha ao montar dashboard de rotas' });
  }
});

router.get('/routes', authMiddleware, async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Apenas admin pode ver as rotas' });
  }

  const routes = normalizeRegisteredRoutes(req.app?.locals?.registeredRoutes || []);

  res.json({
    timestamp: new Date().toISOString(),
    total: routes.length,
    routes
  });
});

router.post('/test-gateway', express.json(), authMiddleware, async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Apenas admin pode testar gateways' });
    }

    const { provider, apiKey, environment } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'provider e apiKey obrigatorios' });
    }

    const gateway = createGatewayIntegration(provider, apiKey, environment || 'production');
    const startedAt = Date.now();
    const result = await gateway.testConnection();

    res.json({
      success: result.connected,
      provider,
      environment: environment || 'production',
      connected: result.connected,
      latency: Date.now() - startedAt,
      message: result.message,
      data: result.data || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message
    });
  }
});

export default router;
