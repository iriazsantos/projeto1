import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_PROVIDER = 'anthropic-messages';
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-opus-4-6';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 45000;
const DEFAULT_HEALTH_TIMEOUT_MS = 9000;
const DEFAULT_HEALTH_CACHE_TTL_MS = 60000;
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 12000;
const MAX_SYSTEM_CHARS = 6000;

let probeCache = {
  signature: '',
  timestamp: 0,
  result: null
};

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'sim'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'nao'].includes(normalized)) return false;
  return fallback;
}

function parseInteger(value, fallback, options = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  const finite = Number.isFinite(parsed) ? parsed : fallback;
  const min = Number.isFinite(options.min) ? options.min : Number.MIN_SAFE_INTEGER;
  const max = Number.isFinite(options.max) ? options.max : Number.MAX_SAFE_INTEGER;
  return Math.min(max, Math.max(min, finite));
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return DEFAULT_BASE_URL;
  return trimmed.replace(/\/+$/, '');
}

function sanitizeText(value, maxLength = 0) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (maxLength > 0 && text.length > maxLength) {
    return text.slice(0, maxLength);
  }
  return text;
}

function sanitizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return [];

  const mapped = rawMessages
    .map((raw) => {
      const role = String(raw?.role || '').toLowerCase() === 'assistant' ? 'assistant' : 'user';
      const rawContent = raw?.content;

      let content = '';
      if (typeof rawContent === 'string') {
        content = sanitizeText(rawContent, MAX_MESSAGE_CHARS);
      } else if (Array.isArray(rawContent)) {
        content = sanitizeText(
          rawContent
            .map((item) => (typeof item?.text === 'string' ? item.text : ''))
            .filter(Boolean)
            .join('\n'),
          MAX_MESSAGE_CHARS
        );
      }

      if (!content) {
        return null;
      }

      return { role, content };
    })
    .filter(Boolean);

  return mapped.slice(-MAX_MESSAGES);
}

function extractTextFromContent(contentBlocks) {
  if (!Array.isArray(contentBlocks)) return '';

  return contentBlocks
    .map((block) => {
      if (block?.type === 'text' && typeof block.text === 'string') {
        return block.text.trim();
      }
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getConfigSignature(config) {
  return [
    config.enabled ? '1' : '0',
    config.apiKey || '',
    config.baseUrl || '',
    config.model || '',
    config.provider || ''
  ].join('|');
}

function getRuntimeConfig() {
  const enabled = parseBoolean(process.env.AGENT_ENABLED, true);
  const provider = sanitizeText(process.env.AGENT_PROVIDER, 60) || DEFAULT_PROVIDER;
  const apiKey = sanitizeText(process.env.AGENT_API_KEY, 512) || sanitizeText(process.env.ANTHROPIC_API_KEY, 512);
  const baseUrl = normalizeBaseUrl(process.env.AGENT_BASE_URL || process.env.ANTHROPIC_BASE_URL);
  const model = sanitizeText(process.env.AGENT_MODEL || process.env.ANTHROPIC_MODEL, 120) || DEFAULT_MODEL;
  const systemPrompt = sanitizeText(process.env.AGENT_SYSTEM_PROMPT, MAX_SYSTEM_CHARS);
  const anthropicVersion = sanitizeText(process.env.AGENT_ANTHROPIC_VERSION, 32) || DEFAULT_ANTHROPIC_VERSION;

  const maxTokens = parseInteger(process.env.AGENT_MAX_TOKENS, DEFAULT_MAX_TOKENS, { min: 64, max: 8192 });
  const requestTimeoutMs = parseInteger(process.env.AGENT_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS, {
    min: 5000,
    max: 120000
  });
  const healthTimeoutMs = parseInteger(process.env.AGENT_HEALTH_TIMEOUT_MS, DEFAULT_HEALTH_TIMEOUT_MS, {
    min: 2000,
    max: 30000
  });
  const healthCacheTtlMs = parseInteger(process.env.AGENT_HEALTH_CACHE_TTL_MS, DEFAULT_HEALTH_CACHE_TTL_MS, {
    min: 0,
    max: 300000
  });

  const missingFields = [];
  if (!apiKey) missingFields.push('AGENT_API_KEY');
  if (!baseUrl) missingFields.push('AGENT_BASE_URL');
  if (!model) missingFields.push('AGENT_MODEL');

  const configured = enabled && missingFields.length === 0;

  return {
    enabled,
    configured,
    missingFields,
    provider,
    apiKey,
    baseUrl,
    model,
    maxTokens,
    requestTimeoutMs,
    healthTimeoutMs,
    healthCacheTtlMs,
    systemPrompt,
    anthropicVersion
  };
}

function buildClient(config) {
  return new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: config.requestTimeoutMs,
    maxRetries: 1
  });
}

function parseProbeError(payload) {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  if (typeof payload?.error === 'string') return payload.error;
  if (typeof payload?.message === 'string') return payload.message;
  if (typeof payload?.error?.message === 'string') return payload.error.message;
  return null;
}

function parseTemperature(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
}

export function getAgentPublicConfig() {
  const config = getRuntimeConfig();

  return {
    enabled: config.enabled,
    configured: config.configured,
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    maxTokens: config.maxTokens,
    timeoutMs: config.requestTimeoutMs,
    missingFields: config.missingFields
  };
}

export async function probeAgentConnectivity(options = {}) {
  const { force = false } = options;
  const config = getRuntimeConfig();
  const now = Date.now();

  if (!config.enabled) {
    return {
      status: 'not_configured',
      connected: null,
      checkedAt: new Date(now).toISOString(),
      latencyMs: null,
      message: 'Conector do agente esta desabilitado (AGENT_ENABLED=false).',
      error: null,
      cached: false,
      httpStatus: null
    };
  }

  if (!config.configured) {
    return {
      status: 'not_configured',
      connected: null,
      checkedAt: new Date(now).toISOString(),
      latencyMs: null,
      message: `Configuracao incompleta: ${config.missingFields.join(', ')}`,
      error: null,
      cached: false,
      httpStatus: null
    };
  }

  const signature = getConfigSignature(config);
  if (
    !force &&
    config.healthCacheTtlMs > 0 &&
    probeCache.result &&
    probeCache.signature === signature &&
    now - probeCache.timestamp < config.healthCacheTtlMs
  ) {
    return {
      ...probeCache.result,
      cached: true
    };
  }

  const endpoint = `${config.baseUrl}/v1/messages`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.healthTimeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'Authorization': `Bearer ${config.apiKey}`,
        'anthropic-version': config.anthropicVersion
      },
      body: '{}',
      signal: controller.signal
    });

    const latencyMs = Date.now() - startedAt;
    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const parsedError = parseProbeError(payload);

    let result = null;

    if (response.ok || response.status === 400) {
      result = {
        status: 'online',
        connected: true,
        checkedAt: new Date().toISOString(),
        latencyMs,
        message: response.status === 400
          ? 'Endpoint respondeu ao probe sem gerar tokens (payload de teste invalido).'
          : 'Conexao com endpoint do agente validada.',
        error: null,
        cached: false,
        httpStatus: response.status
      };
    } else if (response.status === 401 || response.status === 403) {
      result = {
        status: 'error',
        connected: false,
        checkedAt: new Date().toISOString(),
        latencyMs,
        message: 'Falha de autenticacao no endpoint do agente.',
        error: parsedError || `HTTP ${response.status}`,
        cached: false,
        httpStatus: response.status
      };
    } else if (response.status === 404) {
      result = {
        status: 'error',
        connected: false,
        checkedAt: new Date().toISOString(),
        latencyMs,
        message: 'Endpoint /v1/messages nao encontrado no servidor configurado.',
        error: parsedError || `HTTP ${response.status}`,
        cached: false,
        httpStatus: response.status
      };
    } else {
      result = {
        status: 'warning',
        connected: false,
        checkedAt: new Date().toISOString(),
        latencyMs,
        message: 'Endpoint respondeu com status nao esperado para o probe.',
        error: parsedError || `HTTP ${response.status}`,
        cached: false,
        httpStatus: response.status
      };
    }

    probeCache = {
      signature,
      timestamp: Date.now(),
      result
    };

    return result;
  } catch (error) {
    const timeout = error?.name === 'AbortError';
    const result = {
      status: 'error',
      connected: false,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      message: timeout ? `Timeout no probe apos ${config.healthTimeoutMs}ms.` : 'Falha de rede no probe do agente.',
      error: timeout ? 'Timeout' : (error.message || 'Erro desconhecido'),
      cached: false,
      httpStatus: null
    };

    probeCache = {
      signature,
      timestamp: Date.now(),
      result
    };

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateAgentReply(payload = {}) {
  const config = getRuntimeConfig();

  if (!config.enabled) {
    throw createHttpError('Conector do agente esta desativado. Defina AGENT_ENABLED=true para usar.', 503);
  }

  if (!config.configured) {
    throw createHttpError(
      `Conector do agente nao configurado. Pendencias: ${config.missingFields.join(', ')}`,
      503
    );
  }

  const messages = sanitizeMessages(payload.messages);
  if (messages.length === 0) {
    throw createHttpError('Envie ao menos uma mensagem com texto para consultar o agente.', 400);
  }

  const model = sanitizeText(payload.model, 120) || config.model;
  const system = sanitizeText(payload.system, MAX_SYSTEM_CHARS) || config.systemPrompt || undefined;
  const maxTokens = parseInteger(payload.maxTokens, config.maxTokens, { min: 64, max: 8192 });
  const temperature = parseTemperature(payload.temperature);

  const requestBody = {
    model,
    max_tokens: maxTokens,
    messages
  };

  if (system) requestBody.system = system;
  if (temperature !== null) requestBody.temperature = temperature;

  const client = buildClient(config);
  const startedAt = Date.now();

  try {
    const response = await client.messages.create(requestBody);
    const reply = extractTextFromContent(response.content);

    return {
      id: response.id || null,
      model: response.model || model,
      provider: config.provider,
      reply,
      latencyMs: Date.now() - startedAt,
      stopReason: response.stop_reason || null,
      usage: {
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        cacheCreationInputTokens: response.usage?.cache_creation_input_tokens ?? null,
        cacheReadInputTokens: response.usage?.cache_read_input_tokens ?? null
      }
    };
  } catch (error) {
    const statusCode = Number.isInteger(error?.status)
      ? error.status
      : Number.isInteger(error?.statusCode)
        ? error.statusCode
        : 502;

    const upstreamMessage = parseProbeError(error?.error)
      || sanitizeText(error?.message, 280)
      || 'Falha ao consultar o agente de IA.';

    throw createHttpError(upstreamMessage, statusCode >= 400 && statusCode <= 599 ? statusCode : 502);
  }
}
