import pkg from '@prisma/client'; const { PrismaClient } = pkg;
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function encodeBase64(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function generateQRToken(deliveryId) {
  const payload = {
    sys: 'INOVATECH',
    id: deliveryId,
    ts: Date.now(),
    sig: encodeBase64(`${deliveryId}-INOVATECH-SECURE-2024`).slice(0, 16),
  };
  return encodeBase64(JSON.stringify(payload));
}

async function clearSqliteDatabase() {
  const tables = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'"
  );

  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  try {
    for (const table of tables) {
      const tableName = String(table.name || '').replace(/"/g, '""');
      if (!tableName) continue;
      await prisma.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
    }
  } finally {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  }
}

async function main() {
  const SALT_ROUNDS = 12;
  const adminPassword = process.env.ADMIN_PASSWORD || 'Stilo@273388';
  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || '123456';
  const hashedDefaultPassword = await bcrypt.hash(defaultPassword, SALT_ROUNDS);
  const hashedAdminPassword = adminPassword === defaultPassword
    ? hashedDefaultPassword
    : await bcrypt.hash(adminPassword, SALT_ROUNDS);

  // Limpar dados existentes primeiro (inclui tabelas novas automaticamente)
  await clearSqliteDatabase();

  const now = new Date();
  const isoNow = now.toISOString();
  const today = isoNow.split('T')[0];
  const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const daysAhead = (days) => new Date(Date.now() + days * 86400000).toISOString();
  const dateAhead = (days) => daysAhead(days).split('T')[0];
  const dateAgo = (days) => daysAgo(days).split('T')[0];

  const deliveryOneId = 'del1';
  const deliveryTwoId = 'del2';
  const deliveryThreeId = 'del3';

  // Criar condomínios
  await prisma.condominium.createMany({
    data: [
      { id: 'c1', name: 'Residencial Aurora', address: 'Av. das Flores, 1200', city: 'Sao Paulo - SP', units: 120, residents: 98, sindico: 'Carlos Mendes', sindicoId: 'u2', active: true, blocked: false, monthlyRevenue: 48000, pendingCharges: 3200, licenseValue: 299, createdAt: new Date(isoNow) },
      { id: 'c2', name: 'Edificio Horizonte', address: 'Rua das Palmeiras, 450', city: 'Campinas - SP', units: 64, residents: 55, sindico: 'Ana Lima', sindicoId: 'u6', active: true, blocked: false, monthlyRevenue: 28000, pendingCharges: 1800, licenseValue: 199, createdAt: new Date(isoNow) },
      { id: 'c3', name: 'Condominio Vista Verde', address: 'Rua dos Ipes, 88', city: 'Santos - SP', units: 200, residents: 175, sindico: 'Roberto Dias', sindicoId: 'u7', active: true, blocked: false, monthlyRevenue: 76000, pendingCharges: 5100, licenseValue: 399, createdAt: new Date(isoNow) },
    ]
  });

  // Criar usuários
await prisma.user.createMany({
    data: [
      { id: 'u1', name: 'inovatech', email: 'admin@inovatech.com', password: hashedAdminPassword, role: 'admin', cpf: '000.000.000-00', birthDate: '1990-01-01', phone: '(11) 99999-0001', createdAt: new Date(isoNow), active: true },
      { id: 'u2', name: 'Carlos Mendes', email: 'sindico@inovatech.com', password: hashedDefaultPassword, role: 'sindico', cpf: '123.456.789-09', birthDate: '1975-05-15', condoId: 'c1', unit: 'AP 01', phone: '(11) 99999-0002', createdAt: new Date(isoNow), active: true },
      { id: 'u3', name: 'Joao Porteiro', email: 'porteiro@inovatech.com', password: hashedDefaultPassword, role: 'porteiro', cpf: '987.654.321-00', birthDate: '1990-08-20', condoId: 'c1', phone: '(11) 99999-0003', createdAt: new Date(isoNow), active: true },
      { id: 'u4', name: 'Maria Silva', email: 'morador@inovatech.com', password: hashedDefaultPassword, role: 'morador', cpf: '111.222.333-44', birthDate: '1995-03-10', condoId: 'c1', unit: '101-A', phone: '(11) 99999-0004', createdAt: new Date(isoNow), active: true, canViewCharges: true },
      { id: 'u5', name: 'Pedro Costa', email: 'pedro@inovatech.com', password: hashedDefaultPassword, role: 'morador', cpf: '555.666.777-88', birthDate: '1988-11-22', condoId: 'c1', unit: '202-B', phone: '(11) 99999-0005', createdAt: new Date(isoNow), active: true, canViewCharges: true },
      { id: 'u6', name: 'Ana Lima', email: 'ana@inovatech.com', password: hashedDefaultPassword, role: 'sindico', cpf: '222.333.444-55', birthDate: '1970-07-07', condoId: 'c2', unit: 'AP 01', phone: '(11) 99999-0006', createdAt: new Date(isoNow), active: true },
      { id: 'u7', name: 'Roberto Dias', email: 'roberto@inovatech.com', password: hashedDefaultPassword, role: 'sindico', cpf: '333.444.555-66', birthDate: '1968-12-30', condoId: 'c3', unit: 'AP 01', phone: '(11) 99999-0007', createdAt: new Date(isoNow), active: true },
    ]
  });

  // Criar faturas
  await prisma.invoice.createMany({
    data: [
      { id: 'inv1', condoId: 'c1', userId: 'u4', userName: 'Maria Silva', unit: '101-A', description: 'Taxa Condominial - Outubro/2024', amount: 450, dueDate: new Date(daysAgo(150)), status: 'paid', paidAt: new Date(daysAgo(155)), createdAt: new Date(daysAgo(160)) },
      { id: 'inv2', condoId: 'c1', userId: 'u4', userName: 'Maria Silva', unit: '101-A', description: 'Taxa Condominial - Novembro/2024', amount: 450, dueDate: new Date(dateAhead(5)), status: 'pending', createdAt: new Date(daysAgo(2)) },
      { id: 'inv3', condoId: 'c1', userId: 'u5', userName: 'Pedro Costa', unit: '202-B', description: 'Taxa Condominial - Outubro/2024', amount: 480, dueDate: new Date(dateAgo(20)), status: 'overdue', createdAt: new Date(daysAgo(30)) },
      { id: 'inv4', condoId: 'c1', userId: 'u5', userName: 'Pedro Costa', unit: '202-B', description: 'Taxa Condominial - Novembro/2024', amount: 480, dueDate: new Date(dateAhead(7)), status: 'pending', createdAt: new Date(daysAgo(2)) },
    ]
  });

  // Criar entregas
  await prisma.delivery.createMany({
    data: [
      { id: deliveryOneId, condoId: 'c1', unit: '101-A', residentName: 'Maria Silva', sender: 'Amazon', trackingCode: 'AMZ123456BR', description: 'Caixa media - Eletronicos', arrivedAt: new Date(isoNow), status: 'waiting', qrToken: generateQRToken(deliveryOneId), notified: true },
      { id: deliveryTwoId, condoId: 'c1', unit: '202-B', residentName: 'Pedro Costa', sender: 'Mercado Livre', trackingCode: 'ML789012BR', description: 'Envelope - Documentos', arrivedAt: new Date(daysAgo(1)), status: 'waiting', qrToken: generateQRToken(deliveryTwoId), notified: true },
      { id: deliveryThreeId, condoId: 'c1', unit: '101-A', residentName: 'Maria Silva', sender: 'Shopee', trackingCode: 'SH345678BR', description: 'Pacote pequeno - Vestuario', arrivedAt: new Date(daysAgo(2)), deliveredAt: new Date(daysAgo(1)), status: 'delivered', qrToken: generateQRToken(deliveryThreeId), notified: true },
    ]
  });

  // Criar notificações
  await prisma.notification.createMany({
    data: [
      { id: 'n1', userId: 'u4', title: 'Nova encomenda chegou!', message: 'Voce tem uma nova encomenda da Amazon aguardando na portaria. Use seu QR Code para retirar.', type: 'delivery', read: false, createdAt: new Date(isoNow) },
      { id: 'n2', userId: 'u4', title: 'Cobranca pendente', message: 'Taxa Condominial de Novembro/2024 com vencimento em breve. Valor: R$ 450,00.', type: 'charge', read: false, createdAt: new Date(daysAgo(1)) },
      { id: 'n3', userId: 'u4', title: 'Novo comunicado', message: 'Carlos Mendes publicou: Assembleia Geral Ordinaria - 20/11 as 19h.', type: 'announcement', read: true, createdAt: new Date(daysAgo(2)) },
    ]
  });

  // Criar anúncios
  await prisma.announcement.createMany({
    data: [
      { id: 'ann1', condoId: 'c1', title: 'Manutencao da Piscina', content: 'Informamos que a piscina ficara fechada para manutencao nos proximos dois dias.', authorId: 'u2', authorName: 'Carlos Mendes', priority: 'normal', createdAt: new Date(daysAgo(2)) },
      { id: 'ann2', condoId: 'c1', title: 'Assembleia Geral Ordinaria', content: 'Convocamos todos os condominos para a Assembleia Geral Ordinaria que sera realizada no salao de festas.', authorId: 'u2', authorName: 'Carlos Mendes', priority: 'urgent', createdAt: new Date(daysAgo(1)) },
    ]
  });

  // Criar áreas comuns
  await prisma.commonArea.createMany({
    data: [
      { id: 'area1', condoId: 'c1', name: 'Salao de Festas', capacity: 80, maxHours: 8, pricePerHour: 50, description: 'Espaco climatizado com cozinha equipada', rules: JSON.stringify(['Maximo 80 pessoas', 'Ate 8 horas', 'Limpeza obrigatoria apos uso']), image: 'FESTA', cancellationFinePercent: 50, cancellationFineWindowHours: 72 },
      { id: 'area2', condoId: 'c1', name: 'Churrasqueira', capacity: 30, maxHours: 6, pricePerHour: 30, description: 'Area gourmet com 4 churrasqueiras', rules: JSON.stringify(['Maximo 30 pessoas', 'Ate 6 horas', 'Nao e permitido som alto apos 22h']), image: 'FOGO', cancellationFinePercent: 50, cancellationFineWindowHours: 72 },
      { id: 'area3', condoId: 'c1', name: 'Quadra Esportiva', capacity: 20, maxHours: 2, pricePerHour: 0, description: 'Quadra poliesportiva iluminada', rules: JSON.stringify(['Maximo 20 pessoas', 'Ate 2 horas por reserva', 'Uso de calcado adequado obrigatorio']), image: 'ESPORTE', cancellationFinePercent: 0, cancellationFineWindowHours: 48 },
    ]
  });

  // Criar reservas
  await prisma.reservation.createMany({
    data: [
      { id: 'res1', condoId: 'c1', areaId: 'area1', areaName: 'Salao de Festas', userId: 'u4', userName: 'Maria Silva', unit: '101-A', date: today, startTime: '14:00', endTime: '20:00', totalCost: 300, status: 'confirmed', createdAt: new Date(daysAgo(1)) },
      { id: 'res2', condoId: 'c1', areaId: 'area2', areaName: 'Churrasqueira', userId: 'u5', userName: 'Pedro Costa', unit: '202-B', date: dateAhead(3), startTime: '12:00', endTime: '18:00', totalCost: 180, status: 'confirmed', createdAt: new Date(isoNow) },
    ]
  });

  // Criar votações
  await prisma.vote.createMany({
    data: [
      { id: 'v1', condoId: 'c1', title: 'Instalacao de Cameras no Estacionamento', description: 'Votacao para aprovacao da instalacao de cameras de seguranca no estacionamento.', options: JSON.stringify([{ id: 'v1o1', text: 'Aprovar instalacao', votes: ['u4', 'u5'] }, { id: 'v1o2', text: 'Reprovar instalacao', votes: [] }, { id: 'v1o3', text: 'Quero mais informacoes', votes: [] }]), createdBy: 'u2', endDate: new Date(dateAhead(7)), status: 'open', createdAt: new Date(daysAgo(1)) },
      { id: 'v2', condoId: 'c1', title: 'Horario da Academia', description: 'Definicao do horario de funcionamento da academia do condominio.', options: JSON.stringify([{ id: 'v2o1', text: '6h as 22h', votes: ['u4'] }, { id: 'v2o2', text: '5h as 23h', votes: ['u5'] }, { id: 'v2o3', text: '24 horas', votes: [] }]), createdBy: 'u2', endDate: new Date(dateAhead(14)), status: 'open', createdAt: new Date(isoNow) },
    ]
  });

  // Criar reclamações
  await prisma.complaint.createMany({
    data: [
      { id: 'comp1', condoId: 'c1', category: 'Barulho', description: 'Barulho excessivo no apartamento 304 apos as 22h nos finais de semana.', location: 'Bloco A - AP 304', urgency: 'high', status: 'pending', anonymous: true, createdAt: new Date(daysAgo(1)) },
      { id: 'comp2', condoId: 'c1', category: 'Vazamento', description: 'Vazamento de agua no teto do corredor do 2 andar.', location: 'Bloco B - 2 Andar', urgency: 'critical', status: 'read', anonymous: false, reporterId: 'u4', createdAt: new Date(daysAgo(2)) },
    ]
  });

  // Criar itens de mercado
  await prisma.marketItem.createMany({
    data: [
      { id: 'mkt1', condoId: 'c1', sellerId: 'u5', sellerName: 'Pedro Costa', unit: '202-B', title: 'Sofa 3 Lugares', description: 'Sofa em otimo estado, cor cinza, 2 anos de uso.', price: 800, category: 'Moveis', status: 'available', createdAt: new Date(daysAgo(3)) },
      { id: 'mkt2', condoId: 'c1', sellerId: 'u4', sellerName: 'Maria Silva', unit: '101-A', title: 'Bicicleta Ergonometrica', description: 'Bicicleta ergonometrica com 8 niveis de resistencia.', price: 350, category: 'Esportes', status: 'available', createdAt: new Date(daysAgo(5)) },
    ]
  });

  // Criar documentos
  await prisma.document.createMany({
    data: [
      { id: 'doc1', condoId: 'c1', title: 'Convencao do Condominio', category: 'Juridico', description: 'Convencao condominial atualizada em 2023', fileType: 'PDF', fileSize: '2.4 MB', uploadedBy: 'u2', uploadedByName: 'Carlos Mendes', createdAt: new Date(daysAgo(30)), version: '3.0', tags: JSON.stringify(['convencao', 'regras', 'juridico']) },
      { id: 'doc2', condoId: 'c1', title: 'Regimento Interno', category: 'Regras', description: 'Regimento interno com normas de convivencia', fileType: 'PDF', fileSize: '1.8 MB', uploadedBy: 'u2', uploadedByName: 'Carlos Mendes', createdAt: new Date(daysAgo(20)), version: '2.1', tags: JSON.stringify(['regimento', 'normas']) },
    ]
  });

  // Criar requisições de manutenção - corrigido para ter apenas os campos válidos
  await prisma.maintenanceRequest.createMany({
    data: [
      { id: 'tkt1', condoId: 'c1', userId: 'u4', title: 'Lampada queimada no corredor', description: 'Lampada do corredor do 3 andar esta queimada ha 3 dias.', location: 'Bloco A - 3 Andar', priority: 'medium', status: 'open', category: 'Eletrica', photos: JSON.stringify([]), createdAt: new Date(daysAgo(2)), updatedAt: new Date(isoNow) },
      { id: 'tkt2', condoId: 'c1', userId: 'u5', title: 'Vazamento no banheiro da piscina', description: 'Torneira com vazamento constante desperdicando agua.', location: 'Area da Piscina', priority: 'high', status: 'in_progress', category: 'Hidraulica', assignedTo: 'Encanador Jose', photos: JSON.stringify([]), createdAt: new Date(daysAgo(5)), updatedAt: new Date(isoNow) },
    ]
  });

  // Criar logs de acesso - corrigido para incluir o campo obrigatório authorizedBy
  await prisma.accessLog.createMany({
    data: [
      { id: 'acc1', condoId: 'c1', type: 'visitor', name: 'Roberto Alves', document: '123.456.789-00', destination: 'AP 202-B', purpose: 'Visita familiar', enteredAt: new Date(daysAgo(0)), authorizedBy: 'u2', status: 'inside' },
      { id: 'acc2', condoId: 'c1', type: 'service', name: 'Carlos Eletricista', document: '987.654.321-00', destination: 'Area Comum', purpose: 'Manutencao eletrica', company: 'Eletro Servicos LTDA', enteredAt: new Date(daysAgo(1)), exitedAt: new Date(daysAgo(1)), authorizedBy: 'u2', status: 'exited' },
    ]
  });

  // Criar achados e perdidos
  await prisma.lostFound.createMany({
    data: [
      { id: 'lf1', condoId: 'c1', type: 'found', title: 'Chave com chaveiro azul', description: 'Encontrada no corredor do 2 andar', location: 'Corredor Bloco B - 2 Andar', category: 'Chaves', reportedBy: 'u3', reportedByName: 'Joao Porteiro', status: 'active', createdAt: new Date(daysAgo(1)) },
      { id: 'lf2', condoId: 'c1', type: 'lost', title: 'Oculos de grau - armacao vermelha', description: 'Perdi meus oculos na area da piscina ou academia', location: 'Piscina / Academia', category: 'Acessorios', reportedBy: 'u4', reportedByName: 'Maria Silva', contactPhone: '(11) 99999-0004', status: 'active', createdAt: new Date(daysAgo(0)) },
    ]
  });

  // Criar mensagens de suporte
  await prisma.supportMessage.createMany({
    data: [
      { id: 'sm1', condoId: 'c1', userId: 'u4', subject: 'Problemas com o app', message: 'Estou tendo dificuldades para fazer login no aplicativo.', priority: 'medium', status: 'open', createdAt: new Date(daysAgo(1)), updatedAt: new Date(daysAgo(1)) },
      { id: 'sm2', condoId: 'c1', userId: 'u5', subject: 'Solicitação de funcionalidade', message: 'Gostaria de sugerir a inclusão de um chat entre moradores.', priority: 'low', status: 'in_progress', assignedTo: 'u1', createdAt: new Date(daysAgo(2)), updatedAt: new Date(isoNow) },
    ]
  });

  // Criar cobranças de licença
  await prisma.licenseCharge.createMany({
    data: [
      { id: 'lic1', condoId: 'c1', condoName: 'Residencial Aurora', description: 'Licenca INOVATECH CONNECT - Novembro/2024', amount: 299, dueDate: new Date(dateAhead(5)), status: 'pending', viewedBySindico: false, createdAt: new Date(isoNow), reference: 'Novembro/2024' },
      { id: 'lic2', condoId: 'c2', condoName: 'Edificio Horizonte', description: 'Licenca INOVATECH CONNECT - Novembro/2024', amount: 199, dueDate: new Date(dateAhead(5)), status: 'pending', viewedBySindico: false, createdAt: new Date(isoNow), reference: 'Novembro/2024' },
      { id: 'lic3', condoId: 'c1', condoName: 'Residencial Aurora', description: 'Licenca INOVATECH CONNECT - Outubro/2024', amount: 299, dueDate: new Date(dateAgo(10)), status: 'paid', paidAt: new Date(daysAgo(12)), viewedBySindico: true, viewedAt: new Date(daysAgo(15)), createdAt: new Date(daysAgo(30)), reference: 'Outubro/2024' },
    ]
  });

  // Criar funcionários
  await prisma.employee.createMany({
    data: [
      { id: 'emp1', condoId: 'c1', name: 'Jose Carlos Oliveira', cpf: '444.555.666-77', birthDate: '1985-03-15', phone: '(11) 98888-1111', email: 'jose.zelador@email.com', role: 'Zelador', department: 'Manutencao', admissionDate: '2020-01-10', salary: 2200, address: 'Rua das Acacias, 45 - Sao Paulo', notes: 'Responsavel pela manutencao geral', document: '12.345.678-9', createdAt: new Date(daysAgo(365)) },
      { id: 'emp2', condoId: 'c1', name: 'Maria Aparecida Santos', cpf: '777.888.999-00', birthDate: '1990-07-22', phone: '(11) 97777-2222', role: 'Faxineira', department: 'Limpeza', admissionDate: '2021-05-03', salary: 1800, address: 'Av. Paulista, 100 - Sao Paulo', document: '98.765.432-1', createdAt: new Date(daysAgo(300)) },
    ]
  });

  console.log('Seed concluido com sucesso.');
  console.log('Admin login: admin@inovatech.com / ' + adminPassword);
  console.log('Usuario padrao login: <email cadastrado> / ' + defaultPassword);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
