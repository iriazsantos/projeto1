/**
 * Script para atualizar credenciais do Admin Master
 * Usuário: inovatech | Senha: Stilo@273388 (hasheada com bcrypt)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function updateAdmin() {
  const ADMIN_NAME = 'inovatech';
  const ADMIN_EMAIL = 'admin@inovatech.com';
  const ADMIN_PASSWORD = 'Stilo@273388';
  const SALT_ROUNDS = 12;

  console.log('🔧 Atualizando credenciais do Admin Master...\n');

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
  console.log('  ✅ Senha hasheada com bcrypt');

  // Verificar se o admin existe
  const existing = await prisma.user.findFirst({
    where: { OR: [{ id: 'u1' }, { email: ADMIN_EMAIL }, { role: 'admin' }] }
  });

  if (existing) {
    // Atualizar admin existente
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        active: true,
      }
    });
    console.log(`  ✅ Admin atualizado (ID: ${existing.id})`);
  } else {
    // Criar admin
    const admin = await prisma.user.create({
      data: {
        id: 'u1',
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        cpf: '000.000.000-00',
        phone: '(11) 99999-0001',
        active: true,
      }
    });
    console.log(`  ✅ Admin criado (ID: ${admin.id})`);
  }

  // Hashear senhas dos outros usuários também
  console.log('\n🔧 Hasheando senhas dos demais usuários...');
  const users = await prisma.user.findMany();
  let updated = 0;
  for (const user of users) {
    // Se a senha não começa com $2 (bcrypt hash), hashear
    if (!user.password.startsWith('$2')) {
      const hashed = await bcrypt.hash(user.password, SALT_ROUNDS);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed }
      });
      updated++;
    }
  }
  console.log(`  ✅ ${updated} senha(s) hasheada(s)`);

  // Verificação final
  console.log('\n📋 Usuários no banco:');
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true }
  });
  allUsers.forEach(u => {
    console.log(`  ${u.active ? '✅' : '❌'} ${u.name} (${u.email}) [${u.role}]`);
  });

  console.log('\n🎉 Pronto! Login do Admin Master:');
  console.log(`  👤 Usuário: ${ADMIN_NAME}`);
  console.log(`  🔑 Senha: ${ADMIN_PASSWORD}`);

  await prisma.$disconnect();
}

updateAdmin().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
