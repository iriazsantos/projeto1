const API_URL = 'http://localhost:3001';

async function testLoginAPI() {
  try {
    console.log('🧪 Testando API de Login\n');
    
    console.log('1️⃣ Testando health check...');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const healthRes = await fetch(`${API_URL}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!healthRes.ok) throw new Error(`Status ${healthRes.status}`);
      const healthData = await healthRes.json();
      
      console.log('   ✅ Servidor respondendo!');
      console.log(`   📊 Status: ${healthData.status}`);
    } catch (err) {
      console.log('   ❌ Servidor não responde em http://localhost:3001');
      console.log('   ℹ️ Execute: npm run server');
      process.exit(1);
    }

    console.log('\n2️⃣ Testando login com credenciais válidas...');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const loginRes = await fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@inovatechconnect.com',
          password: '123456'
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        console.log('   ❌ Erro na API de login:');
        console.log(`   📌 Status: ${loginRes.status}`);
        console.log(`   💬 Mensagem: ${loginData.error || loginData.message}`);
      } else {
        console.log('   ✅ Login bem-sucedido!');
        console.log(`   👤 Usuário: ${loginData.user.name}`);
        console.log(`   🎯 Role: ${loginData.user.role}`);
        console.log(`   🔐 Token gerado: ${loginData.token.substring(0, 30)}...`);
      }
    } catch (err) {
      console.log('   ❌ Erro ao conectar:');
      console.log(`   💬 ${err.message}`);
    }

    console.log('\n3️⃣ Testando login com credenciais inválidas...');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const loginRes = await fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@inovatechconnect.com',
          password: 'senha_errada'
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        console.log(`   ✅ Rejeitado corretamente (${loginRes.status})`);
        console.log(`   💬 Mensagem: ${loginData.error}`);
      } else {
        console.log('   ❌ Deveria ter retornado erro!');
      }
    } catch (err) {
      console.log(`   ❌ Erro: ${err.message}`);
    }

    console.log('\n✅ Testes concluídos!');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testLoginAPI();
