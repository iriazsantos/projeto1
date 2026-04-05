
import fetch from 'node-fetch';

async function test() {
  try {
    console.log('Testando GET /api/gateway/configs...');
    const res = await fetch('http://localhost:3000/api/gateway/configs');
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Data:', JSON.stringify(data).slice(0, 100));
  } catch (err) {
    console.error('Erro no teste:', err.message);
  }
}

test();
