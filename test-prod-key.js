
import fetch from 'node-fetch';

const apiKey = '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmJhNjc0ZTdhLTBjZDgtNDU0Zi1hYzNkLTc2N2NmNDM1ZDU2YTo6JGFhY2hfYTBiYzA0MDAtOWEyNS00NjY0LTgyMjUtYmVjMzlhMGQ3NzU5';
const baseUrl = 'https://api.asaas.com/v3';

async function testAsaas() {
  try {
    console.log('Testando conexão com Asaas Produção...');
    const res = await fetch(`${baseUrl}/customers?limit=1`, {
      headers: { 'access_token': apiKey }
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    if (res.ok) {
      console.log('✅ Conexão OK! Total de clientes:', data.totalCount);
    } else {
      console.error('❌ Erro:', data);
    }
  } catch (err) {
    console.error('Erro no fetch:', err.message);
  }
}

testAsaas();
