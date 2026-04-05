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
  console.log('=== TESTE FINAL ===');

  // 1. Health
  let r = await f(API + '/health');
  console.log('Health:', r.ok ? 'OK' : 'FALHA');

  // 2. Login com username inovatech
  r = await f(API + '/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inovatech', password: 'Stilo@273388' })
  });
  console.log('Login username "inovatech":', r.status, r.ok ? 'SUCESSO' : 'FALHA');
  if (r.ok) {
    console.log('  User:', r.data?.user?.name, '| Role:', r.data?.user?.role);
    console.log('  Token:', r.data?.token?.substring(0, 30) + '...');
  } else {
    console.log('  Erro:', JSON.stringify(r.data));
  }

  // 3. Login com email admin@inovatech.com
  r = await f(API + '/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@inovatech.com', password: 'Stilo@273388' })
  });
  console.log('Login email "admin@inovatech.com":', r.status, r.ok ? 'SUCESSO' : 'FALHA');

  // 4. Login com senha errada
  r = await f(API + '/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inovatech', password: 'senhaerrada' })
  });
  console.log('Login senha errada:', r.status, r.status === 401 ? 'OK (rejeitado)' : 'PROBLEMA');

  // 5. Rotas registradas
  const token = (await f(API + '/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inovatech', password: 'Stilo@273388' })
  })).data?.token;

  const routes = ['/api/state', '/api/users', '/api/condos', '/api/admin/dashboard'];
  for (const route of routes) {
    r = await f(API + route, {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    });
    console.log('GET ' + route + ':', r.status === 404 ? 'NAO ENCONTRADO' : r.ok ? 'OK' : 'Status ' + r.status);
  }

  console.log('\n=== FIM ===');
}

main().catch(e => console.error('Erro:', e));
