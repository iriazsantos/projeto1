const ollama = require('ollama');

async function testOllama() {
  try {
    const response = await ollama.chat({
      model: 'minimax-m2.7:cloud',
      messages: [
        { role: 'user', content: 'Olá! Crie um exemplo de pagamento PIX para R$ 299,90 da INOVATECH CONNECT' }
      ],
    });
    console.log('✅ Ollama resposta:');
    console.log(response.message.content);
  } catch (error) {
    console.error('❌ Erro Ollama:', error.message);
  }
}

testOllama();
