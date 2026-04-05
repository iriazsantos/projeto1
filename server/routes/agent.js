import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { generateAgentReply, getAgentPublicConfig, probeAgentConnectivity } from '../agent-provider.js';

const router = express.Router();
const MASTER_ROLES = new Set(['admin', 'admin-master']);

function isMasterAdmin(user) {
  return MASTER_ROLES.has(String(user?.role || '').trim().toLowerCase());
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'sim'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'nao'].includes(normalized)) return false;
  return fallback;
}

function resolveStatusCode(error, fallback = 500) {
  const status = Number(error?.statusCode ?? error?.status);
  if (Number.isFinite(status) && status >= 400 && status <= 599) {
    return status;
  }
  return fallback;
}

router.get('/health', authMiddleware, async (req, res) => {
  try {
    if (!isMasterAdmin(req.user)) {
      return res.status(403).json({ error: 'Somente admin pode consultar a saude do agente.' });
    }

    const shouldProbe = parseBoolean(req.query.probe, false);
    const forceProbe = parseBoolean(req.query.force, false);
    const config = getAgentPublicConfig();

    if (!shouldProbe) {
      return res.json({
        ...config,
        timestamp: new Date().toISOString(),
        probe: null
      });
    }

    const probe = await probeAgentConnectivity({ force: forceProbe });
    const statusCode = probe.status === 'error' ? 503 : 200;

    return res.status(statusCode).json({
      ...config,
      timestamp: new Date().toISOString(),
      probe
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Falha ao verificar saude do agente.'
    });
  }
});

router.post('/chat', express.json({ limit: '1mb' }), authMiddleware, async (req, res) => {
  try {
    const result = await generateAgentReply({
      messages: req.body?.messages,
      system: req.body?.system,
      model: req.body?.model,
      maxTokens: req.body?.maxTokens,
      temperature: req.body?.temperature
    });

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    const statusCode = resolveStatusCode(error, 502);
    return res.status(statusCode).json({
      error: error.message || 'Falha ao consultar o agente de IA.'
    });
  }
});

export default router;
