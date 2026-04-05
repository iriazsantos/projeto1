const API = 'http://localhost:3000';

async function f(url, o = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 5000);
  try {
    const r = await fetch(url, { ...o, signal: c.signal });
    clearTimeout(t);
    const tx = await r.text();
    let d = null;
    try { d = JSON.parse(tx); } catch { d = tx; }
    return { ok: r.ok, status: r.status, data: d };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, status: 0, data: null, error: e.message };
  }
}

async function main() {
  const out = [];
  function log(s) { out.push(s); }

  log('=== DIAGNOSTICO INOVATECH CONNECT ===');
  log('');

  // 1. Health
  log('1. HEALTH CHECK');
  let r = await f(API + '/health');
  log('  /health: ' + (r.ok ? 'OK' : 'FAIL') + ' ' + (r.data?.status || ''));
  if (!r.ok) { log('  SERVIDOR OFFLINE - execute: npm run dev:server'); console.log(out.join('\n')); return; }

  // 2. GET /api/state
  log('');
  log('2. GET /api/state');
  r = await f(API + '/api/state');
  if (r.ok && r.data?.core) {
    log('  Resultado: OK');
    const c = r.data.core;
    const cols = ['users','condos','invoices','deliveries','notifications','announcements',
      'commonAreas','reservations','votes','complaints','employees','documents',
      'maintenanceRequests','accessLogs','lostFound','supportMessages','licenseCharges','marketItems'];
    cols.forEach(k => {
      const arr = c[k];
      log('    ' + k + ': ' + (Array.isArray(arr) ? arr.length + ' registros' : 'AUSENTE'));
    });
  } else {
    log('  FALHOU: ' + r.status + ' ' + (r.error || ''));
  }

  // 3. PUT /api/state
  log('');
  log('3. PUT /api/state (persistencia)');
  if (r.ok) {
    const p = await f(API + '/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.data) });
    log('  Resultado: ' + (p.ok ? 'OK' : 'FALHOU (' + p.status + ')'));
  }

  // 4. Login
  log('');
  log('4. LOGIN admin@inovatech.com / 123456');
  r = await f(API + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@inovatech.com', password: '123456' }) });
  log('  Status: ' + r.status);
  if (r.ok && r.data?.token) {
    log('  SUCESSO - Token: ' + r.data.token.substring(0, 30) + '...');
    log('  User: ' + r.data.user?.name + ' (role: ' + r.data.user?.role + ')');
  } else {
    log('  FALHA - ' + JSON.stringify(r.data));
    log('  CAUSA PROVAVEL: senhas no banco nao estao hasheadas com bcrypt');
  }

  // 5. Login invalido
  log('');
  log('5. LOGIN COM SENHA ERRADA');
  r = await f(API + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@inovatech.com', password: 'wrong' }) });
  log('  Status: ' + r.status + ' (esperado: 401)');
  log('  ' + (r.status === 401 ? 'OK - Rejeitado corretamente' : 'INESPERADO'));

  // 6. Rotas
  log('');
  log('6. ROTAS REGISTRADAS NO SERVIDOR');
  const routes = [
    { p: '/api/state', m: 'GET', n: 'State' },
    { p: '/api/auth', m: 'POST', n: 'Auth', b: { email: 'x', password: 'x' } },
    { p: '/api/users', m: 'GET', n: 'Users' },
    { p: '/api/condos', m: 'GET', n: 'Condos' },
    { p: '/api/admin/dashboard', m: 'GET', n: 'Admin' },
    { p: '/api/payments', m: 'GET', n: 'Payments' },
    { p: '/api/uploads', m: 'GET', n: 'Uploads' },
    { p: '/api/master-gateway', m: 'GET', n: 'Master GW' },
    { p: '/api/sindico-gateway', m: 'GET', n: 'Sindico GW' },
  ];
  for (const rt of routes) {
    const o = { method: rt.m };
    if (rt.b) { o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(rt.b); }
    const rr = await f(API + rt.p, o);
    const is404 = rr.status === 404;
    log('  ' + rt.m.padEnd(4) + ' ' + rt.p.padEnd(25) + ' -> ' + (is404 ? 'NAO REGISTRADO (404)' : rr.ok ? 'OK' : 'Status ' + rr.status));
  }

  // 7. JWT
  log('');
  log('7. JWT SECRET MISMATCH');
  log('  server/routes/auth.js:      "inovatech-connect-secret-2024-superseguro"');
  log('  server/middleware/auth.js:   "inovatech-connect-secret-2024-super-secure"');
  log('  RESULTADO: INCONSISTENTE! Token gerado no login sera rejeitado pelo middleware.');

  // 8. Rotas definidas mas nao montadas
  log('');
  log('8. ROTAS DEFINIDAS MAS NAO MONTADAS EM server/index.js');
  log('  Arquivos existem em server/routes/:');
  log('    - admin.js        (NAO montado)');
  log('    - condos.js       (NAO montado)');
  log('    - master-gateway.js (NAO montado)');
  log('    - payments.js     (NAO montado)');
  log('    - sindico-gateway.js (NAO montado)');
  log('    - state.js        (NAO montado - server/index.js tem logica inline duplicada)');
  log('    - uploads.js      (NAO montado)');
  log('    - users.js        (NAO montado)');
  log('    - auth.js         (MONTADO em /api/auth)');

  // Summary
  log('');
  log('=== RESUMO DOS PROBLEMAS ENCONTRADOS ===');
  log('');
  log('CRITICO:');
  log('  1. JWT_SECRET DIFERENTE entre auth.js e middleware/auth.js');
  log('     -> Login gera token que o middleware rejeita');
  log('  2. Rotas /api/users, /api/condos, etc NAO registradas no server/index.js');
  log('     -> Frontend nao consegue acessar APIs do Prisma');
  log('  3. Senhas no banco SQLite provavelmente em texto plano');
  log('     -> auth.js usa bcrypt.compare() que falha com texto plano');
  log('');
  log('AVISOS:');
  log('  4. server/index.js tem logica /api/state inline duplicada');
  log('     -> Existe server/routes/state.js com versao melhorada');
  log('  5. Frontend usa dual-storage: backendState (JSON file) + IndexedDB concepts');
  log('     -> Dados do Prisma (condos, invoices) sobrescrevem state.json no GET');

  console.log(out.join('\n'));
}

main().catch(e => { console.error('Erro:', e); process.exit(1); });
