import express from 'express';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino-http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, 'data/state.json');
const CLIENT_DIST_DIR = path.join(__dirname, '..', 'dist');
const CLIENT_INDEX_FILE = path.join(CLIENT_DIST_DIR, 'index.html');
const isProduction = process.env.NODE_ENV === 'production';
const hasClientBuild = fsSync.existsSync(CLIENT_INDEX_FILE);

const app = express();
const PORT = process.env.PORT || 3000;
const registeredRoutes = [];
const registeredRouteKeys = new Set();
const defaultCorsOrigins = [
  'http://localhost',
  'http://localhost:5173',
  'http://127.0.0.1',
  'http://127.0.0.1:5173',
  'capacitor://localhost',
  'ionic://localhost'
];
const envCorsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const allowedCorsOrigins = new Set([...defaultCorsOrigins, ...envCorsOrigins]);
const allowAllCorsOrigins = allowedCorsOrigins.has('*');

function normalizeRoutePart(routePath = '/') {
  const raw = String(routePath || '/').trim();
  if (!raw || raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

function joinRoutePath(basePath, routePath) {
  const base = normalizeRoutePart(basePath);
  const route = normalizeRoutePart(routePath);
  if (base === '/') return route;
  if (route === '/') return base;
  return `${base}${route}`.replace(/\/+/g, '/');
}

function registerRoute(method, routePath, source = 'app') {
  if (typeof routePath !== 'string' || routePath.length === 0) return;
  const normalizedMethod = String(method || 'GET').toUpperCase();
  let normalizedPath = normalizeRoutePart(routePath);
  if (normalizedPath.length > 1) {
    normalizedPath = normalizedPath.replace(/\/$/, '');
  }
  const key = `${normalizedMethod} ${normalizedPath}`;
  if (registeredRouteKeys.has(key)) return;
  registeredRouteKeys.add(key);
  registeredRoutes.push({
    method: normalizedMethod,
    path: normalizedPath,
    source
  });
}

function registerRouterRoutes(basePath, router, source) {
  const stack = Array.isArray(router?.stack) ? router.stack : [];
  for (const layer of stack) {
    if (!layer?.route) continue;
    const routePaths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
    const methods = Object.entries(layer.route.methods || {})
      .filter(([, enabled]) => Boolean(enabled))
      .map(([method]) => String(method).toUpperCase());

    for (const routePath of routePaths) {
      if (typeof routePath !== 'string') continue;
      const fullPath = joinRoutePath(basePath, routePath);
      for (const method of methods) {
        registerRoute(method, fullPath, source);
      }
    }
  }
}

app.locals.registeredRoutes = registeredRoutes;

// Middleware de seguranca e logging
app.use(helmet()); // Adiciona cabecalhos de seguranca
app.use(pino({ enabled: isProduction })); // Logger estruturado em producao
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowAllCorsOrigins || allowedCorsOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin nao permitida por CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isProduction ? 120 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes de autenticacao. Tente novamente em instantes.' }
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isProduction ? 900 : 4000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes no momento. Aguarde alguns segundos e tente novamente.' }
});
const livePanelLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isProduction ? 1800 : 6000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Painel com muitas requisicoes. Aguarde alguns segundos e tente novamente.' }
});
// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rotas de autenticacao
import authRouter from './routes/auth.js';
registerRouterRoutes('/api/auth', authRouter, 'auth');
app.use('/api/auth', authLimiter, authRouter);

// Rotas de usuarios (Prisma)
import usersRouter from './routes/users.js';
registerRouterRoutes('/api/users', usersRouter, 'users');
app.use('/api/users', apiLimiter, usersRouter);

// Rotas de condominios
import condosRouter from './routes/condos.js';
registerRouterRoutes('/api/condos', condosRouter, 'condos');
app.use('/api/condos', apiLimiter, condosRouter);

// Rotas de admin
import adminRouter from './routes/admin.js';
registerRouterRoutes('/api/admin', adminRouter, 'admin');
app.use('/api/admin', apiLimiter, adminRouter);

// Rotas de gateway e pagamentos (unificado)
import paymentsRouter from './routes/payments.js';
registerRouterRoutes('/api/gateway', paymentsRouter, 'gateway');
app.use('/api/gateway', apiLimiter, paymentsRouter);

// Arquivos enviados (chat, documentos, etc.)
registerRoute('GET', '/uploads/*', 'uploads-static');
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Rotas de uploads
import uploadsRouter from './routes/uploads.js';
registerRouterRoutes('/api/uploads', uploadsRouter, 'uploads');
app.use('/api/uploads', apiLimiter, uploadsRouter);

// Rotas de chat em tempo real
import chatRouter from './routes/chat.js';
registerRouterRoutes('/api/chat', chatRouter, 'chat');
app.use('/api/chat', livePanelLimiter, chatRouter);

// Rotas de assembleia virtual
import assembliesRouter from './routes/assemblies.js';
registerRouterRoutes('/api/assemblies', assembliesRouter, 'assemblies');
app.use('/api/assemblies', livePanelLimiter, assembliesRouter);

// Rotas da central de suporte
import supportRouter from './routes/support.js';
registerRouterRoutes('/api/support', supportRouter, 'support');
app.use('/api/support', livePanelLimiter, supportRouter);

// Rotas do agente de IA
import agentRouter from './routes/agent.js';
registerRouterRoutes('/api/agent', agentRouter, 'agent');
app.use('/api/agent', apiLimiter, agentRouter);

// Rotas de gateway master
import masterGatewayRouter from './routes/master-gateway.js';
registerRouterRoutes('/api/master-gateway', masterGatewayRouter, 'master-gateway');
app.use('/api/master-gateway', apiLimiter, masterGatewayRouter);

// Rotas de gateway sindico
import sindicoGatewayRouter from './routes/sindico-gateway.js';
registerRouterRoutes('/api/sindico-gateway', sindicoGatewayRouter, 'sindico-gateway');
app.use('/api/sindico-gateway', sindicoGatewayRouter);

// Rotas de estado (state.json + Prisma hybrid)
import stateRouter from './routes/state.js';
registerRouterRoutes('/api', stateRouter, 'state');
app.use('/api', apiLimiter, stateRouter);

// Rotas CRUD completas dos modulos operacionais
import modulesRouter from './routes/modules.js';
registerRouterRoutes('/api', modulesRouter, 'modules');
app.use('/api', apiLimiter, modulesRouter);

// Helpers
async function getState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.warn('Arquivo de estado nao encontrado, retornando estado vazio');
    return {
      core: {
        users: [],
        condos: [],
        invoices: [],
        deliveries: [],
        notifications: [],
        announcements: [],
        commonAreas: [],
        reservations: [],
        votes: [],
        complaints: [],
        employees: [],
        pixConfigs: [],
        marketItems: [],
        documents: [],
        maintenanceRequests: [],
        accessLogs: [],
        lostFound: [],
        supportMessages: [],
        licenseCharges: []
      },
      settings: {},
      gatewayConfigs: {},
      marketplaceListings: [],
      supportConversations: [],
      maintenanceTickets: [],
      documentsLibrary: []
    };
  }
}

// Health check
function buildApiStatusPayload() {
  return {
    status: 'API_ONLINE',
    message: hasClientBuild
      ? 'Frontend e backend ativos neste dominio.'
      : 'Backend ativo. O front-end roda em http://localhost:5173',
    apiBase: '/api',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      state: '/api/state',
      adminStatus: '/api/admin/status',
      agent: '/api/agent'
    },
    timestamp: new Date().toISOString()
  };
}

registerRoute('GET', '/api', 'core');
app.get('/api', (req, res) => {
  res.json(buildApiStatusPayload());
});

if (!hasClientBuild) {
  registerRoute('GET', '/', 'core');
  app.get('/', (req, res) => {
    res.json(buildApiStatusPayload());
  });
}

registerRoute('GET', '/health', 'core');
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: hasClientBuild ? 'Frontend e backend funcionando' : 'Backend funcionando'
  });
});

if (hasClientBuild) {
  app.use(express.static(CLIENT_DIST_DIR, {
    index: false,
    maxAge: isProduction ? '7d' : 0
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      next();
      return;
    }
    res.sendFile(CLIENT_INDEX_FILE);
  });
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint nao encontrado',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  // Usar o logger da requisicao se disponivel, senao console.error
  const logger = req.log || console;
  logger.error(err, 'Erro nao tratado no servidor:');
  if (isProduction) {
    // Em producao, nao vazar detalhes do erro
    return res.status(500).json({
      error: 'Erro Interno do Servidor',
      message: 'Ocorreu um problema inesperado. Nossa equipe ja foi notificada.',
    });
  }

  // Em desenvolvimento, mostrar mais detalhes
  res.status(500).json({
    error: 'Erro Interno do Servidor (Dev Mode)',
    message: err.message,
    stack: err.stack, // Expor o stack trace apenas em desenvolvimento
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('Health check configurado');
  console.log('API /state configurada');
  console.log(`Server rodando em http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});

const gracefulShutdown = (signal) => {
  console.log(`\n${signal} recebido. Encerrando o servidor...`);
  server.close(() => {
    console.log('Servidor encerrado.');
    // Aqui voce fecharia conexoes com o banco, ex: await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;


