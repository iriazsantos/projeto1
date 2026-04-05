import fetch from 'node-fetch';

async function run() {
  try {
    // 1. Login to get token
    const loginRes = await fetch('http://localhost:3000/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@inovatech.com', password: 'Stilo@273388' })
    });
    
    if (!loginRes.ok) throw new Error('Falha no login');
    const loginData = await loginRes.json();
    const token = loginData.token;

    // 2. Fetch condos to get a real ID (as Admin Master)
    const condosRes = await fetch('http://localhost:3000/api/admin/condos', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const condos = await condosRes.json();
    const realCondoId = condos[0] ? condos[0].id : null;

    if (!realCondoId) {
      console.log('Nenhum condo encontrado.');
      return;
    }

    // 3. Try to create a user
    const createRes = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Teste Local',
        email: 'teste.local@example.com',
        password: 'password123',
        role: 'morador',
        cpf: '11122233344',
        phone: '11999999999',
        condoId: realCondoId,
        birthDate: '1990-01-01',
        photo: '',
        canViewCharges: true
      })
    });

    const createData = await createRes.json();
    console.log('Status:', createRes.status);
    console.log('Response:', createData);
  } catch (err) {
    console.error('Script Error:', err);
  }
}

run();
