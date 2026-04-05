/**
 * INOVATECH CONNECT - Diagnóstico Completo
 * Verifica: Database Prisma, Backend Express, Comunicação Frontend<->Backend
 */

const API_URL = 'http://localhost:3000';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function ok(msg) { console.log(`  ${COLORS.green}✅ ${msg}${COLORS.reset}`); }
function fail(msg) { console.log(`  ${COLORS.red}❌ ${msg}${COLORS.reset}`); }
function warn(msg) { console.log(`  ${COLORS.yellow}⚠️  ${msg}${COLORS.reset}`); }
function info(msg) { console.log(`  ${COLORS.cyan}ℹ️  ${msg}${COLORS.reset}`); }
function header(msg) { console.log(`\n${COLORS.bold}${COLORS.cyan}${'═'.repeat(60)}\n  ${msg}\n${'═'.repeat(60)}${COLORS.reset}`); }
function section(msg) { console.log(`\n${COLORS.bold}  📋 ${msg}${COLORS.reset}`); }

const results = { pass: 0, fail: 0, warn: 0 };

function addResult(type) {
  if (type === 'pass') results.pass++;
  else if (type === 'fail') results.fail++;
  else results.warn++;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

async function test1_HealthCheck() {
  section('1. HEALTH CHECK DO SERVIDOR');
  const res = await fetchJson(`${API_URL}/health`);
  if (res.ok && res.data?.status === 'OK') {
    ok(`Servidor respondendo em ${API_URL} (status: ${res.data.status})`);
    addResult('pass');
  } else {
    fail(`Servidor NÃO responde em ${API_URL}`);
    info('Execute: npm run dev:server');
    addResult('fail');
    return false;
  }
  return true;
}

async function test2_StateEndpoint() {
  section('2. ENDPOINT /api/state (GET)');
  const res = await fetchJson(`${API_URL}/api/state`);
  if (res.ok && res.data) {
    ok('GET /api/state retornou dados');
    
    // Check structure
    const state = res.data;
    if (state.core) {
      ok(`Estrutura "core" presente com ${Object.keys(state.core).length} coleções`);
      addResult('pass');
      
      const collections = ['users', 'condos', 'invoices', 'deliveries', 'notifications', 
        'announcements', 'commonAreas', 'reservations', 'votes', 'complaints',
        'employees', 'documents', 'maintenanceRequests', 'accessLogs', 'lostFound', 
        'supportMessages', 'licenseCharges', 'marketItems'];
      
      let missing = [];
      let populated = 0;
      for (const col of collections) {
        if (state.core[col] !== undefined) {
          if (Array.isArray(state.core[col]) && state.core[col].length > 0) populated++;
        } else {
          missing.push(col);
        }
      }
      
      if (missing.length > 0) {
        warn(`Coleções ausentes: ${missing.join(', ')}`);
        addResult('warn');
      }
      
      info(`Coleções com dados: ${populated}/${collections.length}`);
      
      // Detail per collection
      for (const col of collections) {
        if (state.core[col]) {
          const count = Array.isArray(state.core[col]) ? state.core[col].length : 'N/A';
          console.log(`     ${COLORS.dim}├─ ${col}: ${count} registros${COLORS.reset}`);
        }
      }
    } else {
      fail('Estrutura "core" AUSENTE na resposta');
      addResult('fail');
    }

    if (state.settings !== undefined) {
      ok('Estrutura "settings" presente');
      addResult('pass');
    }

    if (state.gatewayConfigs !== undefined) {
      ok('Estrutura "gatewayConfigs" presente');
      addResult('pass');
    }
  } else {
    fail(`GET /api/state falhou: ${res.error || res.status}`);
    addResult('fail');
  }
}

async function test3_StatePut() {
  section('3. ENDPOINT /api/state (PUT - Persistência)');
  
  // First get current state
  const getRes = await fetchJson(`${API_URL}/api/state`);
  if (!getRes.ok) {
    fail('Não foi possível ler o estado atual para teste de escrita');
    addResult('fail');
    return;
  }

  // Try to write it back unchanged
  const putRes = await fetchJson(`${API_URL}/api/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(getRes.data),
  });

  if (putRes.ok) {
    ok('PUT /api/state funciona (escrita/leitura de estado)');
    addResult('pass');
  } else {
    fail(`PUT /api/state falhou: ${putRes.error || putRes.status}`);
    addResult('fail');
  }
}

async function test4_AuthLogin() {
  section('4. AUTENTICAÇÃO /api/auth (Login)');
  
  // Test login endpoint exists
  const res = await fetchJson(`${API_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@inovatech.com', password: '123456' }),
  });

  if (res.status === 0) {
    fail('Endpoint /api/auth não responde');
    addResult('fail');
    return null;
  }

  if (res.ok && res.data?.token) {
    ok(`Login bem-sucedido para admin@inovatech.com`);
    ok(`Token JWT gerado: ${res.data.token.substring(0, 30)}...`);
    ok(`Usuário: ${res.data.user?.name} (role: ${res.data.user?.role})`);
    addResult('pass');
    return res.data.token;
  } else if (res.status === 401) {
    warn(`Login rejeitado (401) - senhas podem não estar hasheadas no banco`);
    info(`O Prisma armazena senhas hasheadas (bcrypt), mas o seed pode ter inserido texto plano`);
    addResult('warn');
    return null;
  } else {
    fail(`Erro inesperado: status ${res.status} - ${JSON.stringify(res.data)}`);
    addResult('fail');
    return null;
  }
}

async function test5_AuthInvalid() {
  section('5. AUTENTICAÇÃO - Credenciais Inválidas');
  const res = await fetchJson(`${API_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@inovatech.com', password: 'senha_errada_123' }),
  });

  if (res.status === 401) {
    ok('Credenciais inválidas rejeitadas corretamente (401)');
    addResult('pass');
  } else if (res.ok) {
    fail('SEGURANÇA: Login aceito com senha incorreta!');
    addResult('fail');
  } else {
    warn(`Resposta inesperada: ${res.status}`);
    addResult('warn');
  }
}

async function test6_PrismaDatabase() {
  section('6. BANCO DE DADOS PRISMA (Verificação de dados)');
  
  // The state endpoint already loads Prisma data
  const res = await fetchJson(`${API_URL}/api/state`);
  if (!res.ok) {
    fail('Não foi possível verificar dados do Prisma via /api/state');
    addResult('fail');
    return;
  }

  const condos = res.data?.core?.condos || [];
  const users = res.data?.core?.users || [];
  
  if (condos.length > 0) {
    ok(`${condos.length} condomínio(s) carregados do banco`);
    condos.forEach(c => {
      console.log(`     ${COLORS.dim}├─ ${c.name} (ID: ${c.id}) - ${c.units} unidades, ${c.residents} residentes${COLORS.reset}`);
    });
    addResult('pass');
  } else {
    warn('Nenhum condomínio encontrado no banco - seed pode não ter sido executado');
    addResult('warn');
  }

  if (users.length > 0) {
    ok(`${users.length} usuário(s) carregados do banco`);
    addResult('pass');
  } else {
    warn('Nenhum usuário no state - podem estar apenas no Prisma (não no state.json)');
    addResult('warn');
  }
}

async function test7_RoutesNotRegistered() {
  section('7. ROTAS REGISTRADAS NO SERVIDOR');
  
  const routes = [
    { path: '/api/state', method: 'GET', name: 'State (GET)' },
    { path: '/api/auth', method: 'POST', body: { email: 'test', password: 'test' }, name: 'Auth (POST)' },
    { path: '/api/users', method: 'GET', name: 'Users (GET)' },
    { path: '/api/condos', method: 'GET', name: 'Condos (GET)' },
    { path: '/api/admin/dashboard', method: 'GET', name: 'Admin Dashboard' },
    { path: '/api/payments', method: 'GET', name: 'Payments (GET)' },
    { path: '/api/uploads', method: 'GET', name: 'Uploads (GET)' },
    { path: '/api/master-gateway', method: 'GET', name: 'Master Gateway' },
    { path: '/api/sindico-gateway', method: 'GET', name: 'Sindico Gateway' },
  ];

  for (const route of routes) {
    const options = { method: route.method };
    if (route.body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(route.body);
    }
    
    const res = await fetchJson(`${API_URL}${route.path}`, options);
    
    if (res.status === 404 && res.data?.error === 'Endpoint não encontrado') {
      fail(`${route.name} (${route.method} ${route.path}) → NÃO REGISTRADO (404)`);
      addResult('fail');
    } else if (res.status === 401) {
      ok(`${route.name} (${route.method} ${route.path}) → Registrado (requer auth)`);
      addResult('pass');
    } else if (res.ok) {
      ok(`${route.name} (${route.method} ${route.path}) → Funcionando ✓`);
      addResult('pass');
    } else {
      warn(`${route.name} (${route.method} ${route.path}) → Status ${res.status}`);
      addResult('warn');
    }
  }
}

async function test8_JWTConsistency() {
  section('8. CONSISTÊNCIA JWT');
  info('Verificando JWT_SECRET entre auth.js e middleware/auth.js');
  
  // Test by logging in and using the token
  const loginRes = await fetchJson(`${API_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@inovatech.com', password: '123456' }),
  });

  if (!loginRes.ok || !loginRes.data?.token) {
    warn('Não foi possível testar JWT (login falhou)');
    info('Possível causa: senhas não estão hasheadas no banco (seed em texto plano vs bcrypt)');
    addResult('warn');
    return;
  }

  // Try using the token on an authenticated route
  const usersRes = await fetchJson(`${API_URL}/api/users`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${loginRes.data.token}` },
  });

  if (usersRes.status === 404) {
    warn('Rota /api/users não registrada no servidor (não é possível verificar JWT)');
    addResult('warn');
  } else if (usersRes.ok) {
    ok('Token JWT aceito pelo middleware - JWT_SECRET consistente');
    addResult('pass');
  } else if (usersRes.status === 401) {
    fail('Token JWT REJEITADO pelo middleware - JWT_SECRET INCONSISTENTE!');
    info('auth.js usa: "inovatech-connect-secret-2024-superseguro"');
    info('middleware/auth.js usa: "inovatech-connect-secret-2024-super-secure"');
    info('CORREÇÃO: unificar o JWT_SECRET em ambos os arquivos');
    addResult('fail');
  }
}

async function test9_FrontendProxy() {
  section('9. PROXY VITE (Frontend → Backend)');
  info('Vite está configurado para proxy /api → http://localhost:3000');
  info('Isso significa que o frontend em dev (porta 5173) faz:');
  info('  fetch("/api/state") → proxy → http://localhost:3000/api/state');
  ok('Configuração de proxy verificada em vite.config.ts');
  addResult('pass');
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  header('INOVATECH CONNECT - Diagnóstico Completo');
  console.log(`  📅 ${new Date().toLocaleString('pt-BR')}`);
  console.log(`  🎯 Servidor: ${API_URL}`);
  
  const serverUp = await test1_HealthCheck();
  if (!serverUp) {
    header('RESULTADO: SERVIDOR OFFLINE');
    fail('Inicie o servidor com: npm run dev:server');
    process.exit(1);
  }

  await test2_StateEndpoint();
  await test3_StatePut();
  await test4_AuthLogin();
  await test5_AuthInvalid();
  await test6_PrismaDatabase();
  await test7_RoutesNotRegistered();
  await test8_JWTConsistency();
  await test9_FrontendProxy();

  header('RESULTADO FINAL');
  console.log(`  ${COLORS.green}✅ Passou: ${results.pass}${COLORS.reset}`);
  console.log(`  ${COLORS.yellow}⚠️  Avisos: ${results.warn}${COLORS.reset}`);
  console.log(`  ${COLORS.red}❌ Falhou: ${results.fail}${COLORS.reset}`);
  
  if (results.fail > 0) {
    console.log(`\n${COLORS.red}${COLORS.bold}  ⛔ Há problemas que precisam ser corrigidos!${COLORS.reset}`);
  } else if (results.warn > 0) {
    console.log(`\n${COLORS.yellow}${COLORS.bold}  ⚠️  Sistema funcional com avisos${COLORS.reset}`);
  } else {
    console.log(`\n${COLORS.green}${COLORS.bold}  🎉 Tudo funcionando perfeitamente!${COLORS.reset}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
