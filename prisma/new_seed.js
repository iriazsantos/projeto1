import pkg from '@prisma/client'; const { PrismaClient } = pkg;
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const SALT_ROUNDS = 12;
  const hashedPassword = await bcrypt.hash('123456', SALT_ROUNDS);

  await prisma.user.deleteMany();
  await prisma.condominium.deleteMany();

  const isoNow = new Date().toISOString();

  // Admin Master
  await prisma.user.create({
    data: {
      id: 'u1',
      name: 'Admin Master',
      email: 'admin@inovatechconnect.com',
      password: hashedPassword,
      role: 'admin',
      cpf: '000.000.000-00',
      phone: '(11) 99999-0001',
      createdAt: new Date(isoNow),
      active: true
    }
  });

  console.log('Admin Master criado: admin@inovatechconnect.com / 123456');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

