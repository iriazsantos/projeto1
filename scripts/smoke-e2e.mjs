import { once } from 'events';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 12000);
const HEALTH_TIMEOUT_MS = Number(process.env.SMOKE_HEALTH_TIMEOUT_MS || 30000);
const VERBOSE = process.env.SMOKE_VERBOSE === '1';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  console.log(`[smoke] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildUrl(route) {
  return new URL(route, API_BASE_URL).toString();
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractErrorMessage(payload) {
  if (!payload) return 'sem payload';
  if (typeof payload === 'string') return payload;
  if (typeof payload.error === 'string') return payload.error;
  if (typeof payload.message === 'string') return payload.message;
  return safeStringify(payload);
}

async function requestJson(route, { method = 'GET', token, body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers = {
    Accept: 'application/json'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const response = await fetch(buildUrl(route), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const raw = await response.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function expectOk(route, options, context) {
  const result = await requestJson(route, options);
  if (!result.ok) {
    throw new Error(`${context} falhou (${result.status}): ${extractErrorMessage(result.data)}`);
  }
  return result.data;
}

async function isHealthy() {
  try {
    const health = await requestJson('/health');
    return health.ok;
  } catch {
    return false;
  }
}

function resolvePort() {
  const url = new URL(API_BASE_URL);
  if (url.port) return Number(url.port);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return 3000;
  return url.protocol === 'https:' ? 443 : 80;
}

function startServer() {
  const logs = [];
  const port = resolvePort();
  const child = spawn('node', ['server/index.js'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const pushLogs = (prefix, chunk) => {
    const lines = String(chunk)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    lines.forEach((line) => {
      logs.push(`${prefix}${line}`);
      if (logs.length > 50) logs.shift();
      if (VERBOSE) console.log(`${prefix}${line}`);
    });
  };

  child.stdout.on('data', (chunk) => pushLogs('[server] ', chunk));
  child.stderr.on('data', (chunk) => pushLogs('[server:err] ', chunk));

  return { child, logs };
}

async function waitForHealth(timeoutMs, serverState) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    if (serverState?.child?.exitCode !== null) {
      throw new Error('Servidor local encerrou antes do healthcheck ficar disponivel.');
    }
    if (await isHealthy()) return true;
    await sleep(500);
  }

  const details = serverState?.logs?.length
    ? ` Ultimos logs:\n${serverState.logs.join('\n')}`
    : '';
  throw new Error(`Timeout aguardando healthcheck em ${API_BASE_URL}/health.${details}`);
}

async function stopServer(serverState) {
  if (!serverState?.child) return;
  const { child } = serverState;
  if (child.exitCode !== null) return;

  child.kill();
  const exited = await Promise.race([
    once(child, 'exit').then(() => true).catch(() => false),
    sleep(4000).then(() => false)
  ]);

  if (!exited && child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

async function loginWithFallback(label, candidates) {
  const attempts = [];

  for (const credentials of candidates) {
    const response = await requestJson('/api/auth', {
      method: 'POST',
      body: credentials
    });

    if (response.ok && response.data?.token && response.data?.user) {
      log(`login ${label} OK com ${credentials.email}`);
      return response.data;
    }

    attempts.push(`${credentials.email} -> ${response.status} (${extractErrorMessage(response.data)})`);
  }

  throw new Error(`Nao foi possivel autenticar ${label}. Tentativas: ${attempts.join(' | ')}`);
}

function uniqueTag() {
  const random = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${random}`;
}

async function runSmoke() {
  let localServer = null;
  let startedByScript = false;
  const tag = uniqueTag();

  try {
    if (!(await isHealthy())) {
      log(`API indisponivel em ${API_BASE_URL}. Iniciando servidor local...`);
      localServer = startServer();
      startedByScript = true;
      await waitForHealth(HEALTH_TIMEOUT_MS, localServer);
      log('Servidor local iniciado para o smoke test.');
    } else {
      log(`API ja esta online em ${API_BASE_URL}.`);
    }

    const admin = await loginWithFallback('admin', [
      { email: 'admin@inovatech.com', password: 'Stilo@273388' },
      { email: 'inovatech', password: 'Stilo@273388' },
      { email: 'admin@inovatech.com', password: '123456' },
      { email: 'admin@inovatechconnect.com', password: '123456' },
      { email: 'admin@inovatechconnect.com', password: 'Stilo@273388' }
    ]);

    const sindico = await loginWithFallback('sindico', [
      { email: 'sindico@inovatech.com', password: '123456' },
      { email: 'sindico@inovatech.com', password: 'Stilo@273388' },
      { email: 'ana@inovatech.com', password: '123456' }
    ]);

    const morador = await loginWithFallback('morador', [
      { email: 'morador@inovatech.com', password: '123456' },
      { email: 'morador@inovatech.com', password: 'Stilo@273388' },
      { email: 'pedro@inovatech.com', password: '123456' }
    ]);

    log('Validando gateway status/traffic...');
    await expectOk(
      '/api/gateway/track-request',
      {
        method: 'POST',
        token: sindico.token,
        body: {
          provider: 'asaas',
          success: true,
          responseTime: 120
        }
      },
      'registro de trafego do gateway'
    );

    const gatewayStatus = await expectOk(
      '/api/gateway/status',
      { token: sindico.token },
      'consulta de status do gateway'
    );
    const statuses = Array.isArray(gatewayStatus.statuses) ? gatewayStatus.statuses : [];
    assert(statuses.some((item) => item.provider === 'asaas'), 'Status do provider asaas nao encontrado.');

    log('Validando fluxo de suporte...');
    const createdTicket = await expectOk(
      '/api/support/tickets',
      {
        method: 'POST',
        token: morador.token,
        body: {
          subject: `Smoke ticket ${tag}`,
          message: `Mensagem automatica ${tag}`,
          category: 'tecnico',
          priority: 'medium'
        }
      },
      'criacao de ticket de suporte'
    );

    const ticketId = createdTicket.ticket?.id;
    assert(ticketId, 'Ticket criado sem id retornado.');

    await expectOk(
      `/api/support/tickets/${ticketId}/messages`,
      {
        method: 'POST',
        token: admin.token,
        body: {
          message: `Retorno automatico do smoke ${tag}`
        }
      },
      'resposta admin no ticket'
    );

    const ticketDetail = await expectOk(
      `/api/support/tickets/${ticketId}`,
      { token: morador.token },
      'consulta de detalhes do ticket'
    );

    const ticketMessages = Array.isArray(ticketDetail.messages) ? ticketDetail.messages : [];
    assert(ticketMessages.length >= 2, 'Ticket deveria ter ao menos 2 mensagens apos resposta do admin.');
    assert(
      ticketMessages.some((message) => message.senderId === admin.user.id),
      'Resposta do admin nao foi encontrada no ticket.'
    );

    log('Validando fluxo de chat...');
    const directConversation = await expectOk(
      '/api/chat/conversations/direct',
      {
        method: 'POST',
        token: sindico.token,
        body: {
          targetUserId: morador.user.id
        }
      },
      'criacao de conversa direta'
    );

    const conversationId = directConversation.conversation?.id;
    assert(conversationId, 'Conversa direta retornou sem id.');

    const chatText = `Mensagem smoke chat ${tag}`;
    await expectOk(
      `/api/chat/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token: sindico.token,
        body: {
          type: 'text',
          content: chatText
        }
      },
      'envio de mensagem no chat'
    );

    const chatMessagesPayload = await expectOk(
      `/api/chat/conversations/${conversationId}/messages?limit=30`,
      { token: morador.token },
      'listagem de mensagens do chat'
    );
    const chatMessages = Array.isArray(chatMessagesPayload.messages) ? chatMessagesPayload.messages : [];
    assert(chatMessages.some((message) => message.content === chatText), 'Mensagem do chat nao foi encontrada.');

    await expectOk(
      `/api/chat/conversations/${conversationId}/read`,
      {
        method: 'POST',
        token: morador.token
      },
      'marcacao de leitura do chat'
    );

    log('Validando fluxo de assembleia virtual...');
    const startsAt = new Date(Date.now() - 60_000).toISOString();
    const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const assemblyTitle = `Assembleia Smoke ${tag}`;

    const createdAssembly = await expectOk(
      '/api/assemblies',
      {
        method: 'POST',
        token: sindico.token,
        body: {
          title: assemblyTitle,
          description: `Teste automatizado ${tag}`,
          startsAt,
          endsAt,
          status: 'open',
          agendaItems: [
            { title: 'Aprovar manutencao preventiva', quorumType: 'simple' },
            { title: 'Aprovar reforco de seguranca', quorumType: 'two_thirds' }
          ]
        }
      },
      'criacao de assembleia'
    );

    const assemblyId = createdAssembly.assembly?.id;
    const firstItemId = createdAssembly.assembly?.items?.[0]?.id;
    assert(assemblyId, 'Assembleia criada sem id.');
    assert(firstItemId, 'Assembleia criada sem item de pauta.');

    await expectOk(
      `/api/assemblies/${assemblyId}/items/${firstItemId}/vote`,
      {
        method: 'POST',
        token: morador.token,
        body: {
          choice: 'yes'
        }
      },
      'voto de morador na assembleia'
    );

    const minutes = await expectOk(
      `/api/assemblies/${assemblyId}/minutes`,
      { token: sindico.token },
      'geracao de ata da assembleia'
    );
    const minutesText = String(minutes.minutesText || '');
    assert(minutesText.includes(assemblyTitle), 'Ata gerada nao contem o titulo da assembleia criada.');

    log('Smoke E2E concluido com sucesso.');
    log(`ticketId=${ticketId}`);
    log(`conversationId=${conversationId}`);
    log(`assemblyId=${assemblyId}`);
  } finally {
    if (startedByScript) {
      await stopServer(localServer);
      log('Servidor local encerrado.');
    }
  }
}

runSmoke().catch((error) => {
  console.error(`[smoke] ERRO: ${error.message}`);
  process.exit(1);
});
