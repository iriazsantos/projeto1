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

export function createInitialState() {
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

  return {
    core: {
      users: [
        { id: 'u1', name: 'inovatech', email: 'admin@inovatech.com', password: 'Stilo@273388', role: 'admin', cpf: '000.000.000-00', birthDate: '1980-01-01', phone: '(11) 99999-0001', createdAt: isoNow, active: true },
        { id: 'u2', name: 'Carlos Mendes', email: 'sindico@inovatech.com', password: '123456', role: 'sindico', cpf: '123.456.789-09', birthDate: '1975-05-15', condoId: 'c1', unit: 'AP 01', phone: '(11) 99999-0002', createdAt: isoNow, active: true },
        { id: 'u3', name: 'Joao Porteiro', email: 'porteiro@inovatech.com', password: '123456', role: 'porteiro', cpf: '987.654.321-00', birthDate: '1990-08-20', condoId: 'c1', phone: '(11) 99999-0003', createdAt: isoNow, active: true },
        { id: 'u4', name: 'Maria Silva', email: 'morador@inovatech.com', password: '123456', role: 'morador', cpf: '111.222.333-44', birthDate: '1995-03-10', condoId: 'c1', unit: '101-A', phone: '(11) 99999-0004', createdAt: isoNow, active: true, canViewCharges: true },
        { id: 'u5', name: 'Pedro Costa', email: 'pedro@inovatech.com', password: '123456', role: 'morador', cpf: '555.666.777-88', birthDate: '1988-11-22', condoId: 'c1', unit: '202-B', phone: '(11) 99999-0005', createdAt: isoNow, active: true, canViewCharges: true },
        { id: 'u6', name: 'Ana Lima', email: 'ana@inovatech.com', password: '123456', role: 'sindico', cpf: '222.333.444-55', birthDate: '1970-07-07', condoId: 'c2', unit: 'AP 01', phone: '(11) 99999-0006', createdAt: isoNow, active: true },
        { id: 'u7', name: 'Roberto Dias', email: 'roberto@inovatech.com', password: '123456', role: 'sindico', cpf: '333.444.555-66', birthDate: '1968-12-30', condoId: 'c3', unit: 'AP 01', phone: '(11) 99999-0007', createdAt: isoNow, active: true },
      ],
      condos: [
        { id: 'c1', name: 'Residencial Aurora', address: 'Av. das Flores, 1200', city: 'Sao Paulo - SP', units: 120, residents: 98, sindico: 'Carlos Mendes', sindicoId: 'u2', active: true, blocked: false, monthlyRevenue: 48000, pendingCharges: 3200, licenseValue: 299, createdAt: isoNow },
        { id: 'c2', name: 'Edificio Horizonte', address: 'Rua das Palmeiras, 450', city: 'Campinas - SP', units: 64, residents: 55, sindico: 'Ana Lima', sindicoId: 'u6', active: true, blocked: false, monthlyRevenue: 28000, pendingCharges: 1800, licenseValue: 199, createdAt: isoNow },
        { id: 'c3', name: 'Condominio Vista Verde', address: 'Rua dos Ipes, 88', city: 'Santos - SP', units: 200, residents: 175, sindico: 'Roberto Dias', sindicoId: 'u7', active: true, blocked: false, monthlyRevenue: 76000, pendingCharges: 5100, licenseValue: 399, createdAt: isoNow },
      ],
      invoices: [
        { id: 'inv1', condoId: 'c1', userId: 'u4', userName: 'Maria Silva', unit: '101-A', description: 'Taxa Condominial - Outubro/2024', amount: 450, dueDate: dateAgo(150), status: 'paid', paidAt: daysAgo(155), createdAt: daysAgo(160) },
        { id: 'inv2', condoId: 'c1', userId: 'u4', userName: 'Maria Silva', unit: '101-A', description: 'Taxa Condominial - Novembro/2024', amount: 450, dueDate: dateAhead(5), status: 'pending', createdAt: daysAgo(2) },
        { id: 'inv3', condoId: 'c1', userId: 'u5', userName: 'Pedro Costa', unit: '202-B', description: 'Taxa Condominial - Outubro/2024', amount: 480, dueDate: dateAgo(20), status: 'overdue', createdAt: daysAgo(30) },
        { id: 'inv4', condoId: 'c1', userId: 'u5', userName: 'Pedro Costa', unit: '202-B', description: 'Taxa Condominial - Novembro/2024', amount: 480, dueDate: dateAhead(7), status: 'pending', createdAt: daysAgo(2) },
      ],
      deliveries: [
        { id: deliveryOneId, condoId: 'c1', unit: '101-A', residentName: 'Maria Silva', sender: 'Amazon', trackingCode: 'AMZ123456BR', description: 'Caixa media - Eletronicos', arrivedAt: isoNow, status: 'waiting', qrToken: generateQRToken(deliveryOneId), notified: true },
        { id: deliveryTwoId, condoId: 'c1', unit: '202-B', residentName: 'Pedro Costa', sender: 'Mercado Livre', trackingCode: 'ML789012BR', description: 'Envelope - Documentos', arrivedAt: daysAgo(1), status: 'waiting', qrToken: generateQRToken(deliveryTwoId), notified: true },
        { id: deliveryThreeId, condoId: 'c1', unit: '101-A', residentName: 'Maria Silva', sender: 'Shopee', trackingCode: 'SH345678BR', description: 'Pacote pequeno - Vestuario', arrivedAt: daysAgo(2), deliveredAt: daysAgo(1), status: 'delivered', qrToken: generateQRToken(deliveryThreeId), notified: true },
      ],
      notifications: [
        { id: 'n1', userId: 'u4', title: 'Nova encomenda chegou!', message: 'Voce tem uma nova encomenda da Amazon aguardando na portaria. Use seu QR Code para retirar.', type: 'delivery', read: false, createdAt: isoNow },
        { id: 'n2', userId: 'u4', title: 'Cobranca pendente', message: 'Taxa Condominial de Novembro/2024 com vencimento em breve. Valor: R$ 450,00.', type: 'charge', read: false, createdAt: daysAgo(1) },
        { id: 'n3', userId: 'u4', title: 'Novo comunicado', message: 'Carlos Mendes publicou: Assembleia Geral Ordinaria - 20/11 as 19h.', type: 'announcement', read: true, createdAt: daysAgo(2) },
      ],
      announcements: [
        { id: 'ann1', condoId: 'c1', title: 'Manutencao da Piscina', content: 'Informamos que a piscina ficara fechada para manutencao nos proximos dois dias.', authorId: 'u2', authorName: 'Carlos Mendes', priority: 'normal', createdAt: daysAgo(2) },
        { id: 'ann2', condoId: 'c1', title: 'Assembleia Geral Ordinaria', content: 'Convocamos todos os condominos para a Assembleia Geral Ordinaria que sera realizada no salao de festas.', authorId: 'u2', authorName: 'Carlos Mendes', priority: 'urgent', createdAt: daysAgo(1) },
      ],
      commonAreas: [
        { id: 'area1', condoId: 'c1', name: 'Salao de Festas', capacity: 80, maxHours: 8, pricePerHour: 50, description: 'Espaco climatizado com cozinha equipada', rules: ['Maximo 80 pessoas', 'Ate 8 horas', 'Limpeza obrigatoria apos uso'], image: 'FESTA', cancellationFinePercent: 50, cancellationFineWindowHours: 72 },
        { id: 'area2', condoId: 'c1', name: 'Churrasqueira', capacity: 30, maxHours: 6, pricePerHour: 30, description: 'Area gourmet com 4 churrasqueiras', rules: ['Maximo 30 pessoas', 'Ate 6 horas', 'Nao e permitido som alto apos 22h'], image: 'FOGO', cancellationFinePercent: 50, cancellationFineWindowHours: 72 },
        { id: 'area3', condoId: 'c1', name: 'Quadra Esportiva', capacity: 20, maxHours: 2, pricePerHour: 0, description: 'Quadra poliesportiva iluminada', rules: ['Maximo 20 pessoas', 'Ate 2 horas por reserva', 'Uso de calcado adequado obrigatorio'], image: 'ESPORTE', cancellationFinePercent: 0, cancellationFineWindowHours: 48 },
      ],
      reservations: [
        { id: 'res1', condoId: 'c1', areaId: 'area1', areaName: 'Salao de Festas', userId: 'u4', userName: 'Maria Silva', unit: '101-A', date: today, startTime: '14:00', endTime: '20:00', totalCost: 300, status: 'confirmed', createdAt: daysAgo(1) },
        { id: 'res2', condoId: 'c1', areaId: 'area2', areaName: 'Churrasqueira', userId: 'u5', userName: 'Pedro Costa', unit: '202-B', date: dateAhead(3), startTime: '12:00', endTime: '18:00', totalCost: 180, status: 'confirmed', createdAt: isoNow },
      ],
      votes: [
        { id: 'v1', condoId: 'c1', title: 'Instalacao de Cameras no Estacionamento', description: 'Votacao para aprovacao da instalacao de cameras de seguranca no estacionamento.', options: [{ id: 'v1o1', text: 'Aprovar instalacao', votes: ['u4', 'u5'] }, { id: 'v1o2', text: 'Reprovar instalacao', votes: [] }, { id: 'v1o3', text: 'Quero mais informacoes', votes: [] }], createdBy: 'u2', endDate: dateAhead(7), status: 'open', createdAt: daysAgo(1) },
        { id: 'v2', condoId: 'c1', title: 'Horario da Academia', description: 'Definicao do horario de funcionamento da academia do condominio.', options: [{ id: 'v2o1', text: '6h as 22h', votes: ['u4'] }, { id: 'v2o2', text: '5h as 23h', votes: ['u5'] }, { id: 'v2o3', text: '24 horas', votes: [] }], createdBy: 'u2', endDate: dateAhead(14), status: 'open', createdAt: isoNow },
      ],
      complaints: [
        { id: 'comp1', condoId: 'c1', category: 'Barulho', description: 'Barulho excessivo no apartamento 304 apos as 22h nos finais de semana.', location: 'Bloco A - AP 304', urgency: 'high', status: 'pending', anonymous: true, createdAt: daysAgo(1) },
        { id: 'comp2', condoId: 'c1', category: 'Vazamento', description: 'Vazamento de agua no teto do corredor do 2 andar.', location: 'Bloco B - 2 Andar', urgency: 'critical', status: 'read', anonymous: false, reporterId: 'u4', createdAt: daysAgo(2) },
      ],
      marketItems: [
        { id: 'mkt1', condoId: 'c1', sellerId: 'u5', sellerName: 'Pedro Costa', unit: '202-B', title: 'Sofa 3 Lugares', description: 'Sofa em otimo estado, cor cinza, 2 anos de uso.', price: 800, category: 'Moveis', status: 'available', createdAt: daysAgo(3) },
        { id: 'mkt2', condoId: 'c1', sellerId: 'u4', sellerName: 'Maria Silva', unit: '101-A', title: 'Bicicleta Ergonometrica', description: 'Bicicleta ergonometrica com 8 niveis de resistencia.', price: 350, category: 'Esportes', status: 'available', createdAt: daysAgo(5) },
      ],
      documents: [],
      maintenanceRequests: [],
      accessLogs: [],
      lostFound: [],
      supportMessages: [],
      licenseCharges: [
        { id: 'lic1', condoId: 'c1', condoName: 'Residencial Aurora', description: 'Licenca INOVATECH CONNECT - Novembro/2024', amount: 299, dueDate: dateAhead(5), status: 'pending', viewedBySindico: false, createdAt: isoNow, reference: 'Novembro/2024' },
        { id: 'lic2', condoId: 'c2', condoName: 'Edificio Horizonte', description: 'Licenca INOVATECH CONNECT - Novembro/2024', amount: 199, dueDate: dateAhead(5), status: 'pending', viewedBySindico: false, createdAt: isoNow, reference: 'Novembro/2024' },
        { id: 'lic3', condoId: 'c1', condoName: 'Residencial Aurora', description: 'Licenca INOVATECH CONNECT - Outubro/2024', amount: 299, dueDate: dateAgo(10), status: 'paid', paidAt: daysAgo(12), viewedBySindico: true, viewedAt: daysAgo(15), createdAt: daysAgo(30), reference: 'Outubro/2024' },
      ],
      employees: [
        { id: 'emp1', condoId: 'c1', name: 'Jose Carlos Oliveira', cpf: '444.555.666-77', birthDate: '1985-03-15', phone: '(11) 98888-1111', email: 'jose.zelador@email.com', role: 'Zelador', department: 'Manutencao', admissionDate: '2020-01-10', salary: 2200, address: 'Rua das Acacias, 45 - Sao Paulo', notes: 'Responsavel pela manutencao geral', document: '12.345.678-9', createdAt: daysAgo(365) },
        { id: 'emp2', condoId: 'c1', name: 'Maria Aparecida Santos', cpf: '777.888.999-00', birthDate: '1990-07-22', phone: '(11) 97777-2222', role: 'Faxineira', department: 'Limpeza', admissionDate: '2021-05-03', salary: 1800, address: 'Av. Paulista, 100 - Sao Paulo', document: '98.765.432-1', createdAt: daysAgo(300) },
      ],
      pixConfigs: [],
    },
    settings: {
      db_initialized: true,
      gatewayConfig: null,
    },
    marketplaceListings: [
      {
        id: 'ml1',
        condoId: 'c1',
        sellerId: 'u5',
        sellerName: 'Pedro Costa',
        sellerUnit: '202-B',
        title: 'Sofa 3 Lugares Cinza',
        description: 'Sofa em otimo estado, cor cinza claro, 2 anos de uso. Tecido suede lavavel.',
        price: 850,
        category: 'Moveis',
        condition: 'seminovo',
        status: 'available',
        photos: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80'],
        tags: ['sofa', 'sala', 'moveis'],
        views: 47,
        likes: ['u4'],
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3),
        negotiable: true,
        location: 'AP 202-B',
        whatsapp: '11999990005',
      },
      {
        id: 'ml2',
        condoId: 'c1',
        sellerId: 'u4',
        sellerName: 'Maria Silva',
        sellerUnit: '101-A',
        title: 'Bicicleta Ergonometrica Kikos',
        description: 'Bicicleta ergonometrica com 8 niveis de resistencia magnetica e pouco uso.',
        price: 380,
        category: 'Esportes',
        condition: 'seminovo',
        status: 'available',
        photos: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80'],
        tags: ['bicicleta', 'exercicio', 'academia'],
        views: 89,
        likes: ['u5'],
        createdAt: daysAgo(5),
        updatedAt: daysAgo(5),
        negotiable: false,
        location: 'AP 101-A',
      },
      {
        id: 'ml3',
        condoId: 'c1',
        sellerId: 'u5',
        sellerName: 'Pedro Costa',
        sellerUnit: '202-B',
        title: 'iPhone 12 64GB Preto',
        description: 'iPhone 12 em perfeito estado, 64GB, cor preta. Bateria com 87% de saude.',
        price: 1800,
        category: 'Eletronicos',
        condition: 'usado',
        status: 'available',
        photos: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&q=80'],
        tags: ['iphone', 'celular', 'apple'],
        views: 156,
        likes: ['u4'],
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
        negotiable: true,
        whatsapp: '11999990005',
      },
    ],
    supportConversations: [],
    waUsers: [
      { id: 'u1', unit: 'Admin', role: 'admin', online: true, lastSeen: isoNow, chatEnabled: true },
      { id: 'u2', unit: 'AP 01', role: 'sindico', condoId: 'c1', online: true, lastSeen: isoNow, chatEnabled: true },
      { id: 'u3', unit: 'Portaria', role: 'porteiro', condoId: 'c1', online: false, lastSeen: daysAgo(0), chatEnabled: true },
      { id: 'u4', unit: '101-A', role: 'morador', condoId: 'c1', online: true, lastSeen: isoNow, chatEnabled: true },
      { id: 'u5', unit: '202-B', role: 'morador', condoId: 'c1', online: false, lastSeen: daysAgo(0), chatEnabled: true },
      { id: 'u6', unit: 'AP 01', role: 'sindico', condoId: 'c2', online: false, lastSeen: daysAgo(1), chatEnabled: true },
      { id: 'u7', unit: 'AP 01', role: 'sindico', condoId: 'c3', online: false, lastSeen: daysAgo(2), chatEnabled: true },
    ],
    waChats: [
      { id: 'wc1', condoId: 'c1', type: 'direct', participants: ['u2', 'u4'], createdAt: daysAgo(1) },
      { id: 'wc2', condoId: 'c1', type: 'direct', participants: ['u2', 'u5'], createdAt: daysAgo(2) },
      { id: 'wc3', condoId: 'c1', type: 'direct', participants: ['u3', 'u4'], createdAt: daysAgo(1) },
      { id: 'wc4', condoId: 'c1', type: 'group', name: 'Condominio - Geral', participants: ['u2', 'u3', 'u4', 'u5'], adminIds: ['u2'], createdAt: daysAgo(2) },
      { id: 'wc5', condoId: 'c1', type: 'group', name: 'Encomendas e Portaria', participants: ['u2', 'u3', 'u4', 'u5'], adminIds: ['u2'], createdAt: daysAgo(2) },
    ],
    waMessages: [
      { id: 'wm1', chatId: 'wc1', senderId: 'u2', senderUnit: 'AP 01', senderRole: 'sindico', content: 'Ola! A taxa de novembro vence dia 10.', type: 'text', timestamp: daysAgo(1), read: true, readAt: daysAgo(1) },
      { id: 'wm2', chatId: 'wc1', senderId: 'u4', senderUnit: '101-A', senderRole: 'morador', content: 'Entendido, obrigado pelo aviso!', type: 'text', timestamp: daysAgo(1), read: true },
      { id: 'wm3', chatId: 'wc1', senderId: 'u2', senderUnit: 'AP 01', senderRole: 'sindico', content: 'Qualquer duvida, e so chamar aqui.', type: 'text', timestamp: isoNow, read: false },
      { id: 'wm4', chatId: 'wc3', senderId: 'u3', senderUnit: 'Portaria', senderRole: 'porteiro', content: 'Sua encomenda chegou! Retire na portaria.', type: 'text', timestamp: isoNow, read: false },
      { id: 'wm5', chatId: 'wc4', senderId: 'u2', senderUnit: 'AP 01', senderRole: 'sindico', content: 'Assembleia geral dia 20/11 as 19h no salao!', type: 'text', timestamp: daysAgo(1), read: true },
      { id: 'wm6', chatId: 'wc4', senderId: 'u5', senderUnit: '202-B', senderRole: 'morador', content: 'Eu tambem confirmo!', type: 'text', timestamp: isoNow, read: false },
      { id: 'wm7', chatId: 'wc5', senderId: 'u3', senderUnit: 'Portaria', senderRole: 'porteiro', content: 'Encomendas: 101-A (Amazon) e 202-B (ML).', type: 'text', timestamp: isoNow, read: false },
    ],
    gatewayConfigs: {},
    maintenanceTickets: [
      { id: 'tkt1', condoId: 'c1', title: 'Lampada queimada no corredor', description: 'Lampada do corredor do 3 andar esta queimada ha 3 dias.', location: 'Bloco A - 3 Andar', priority: 'medium', status: 'open', category: 'Eletrica', reportedBy: 'u4', reportedByName: 'Maria Silva', photos: [], createdAt: daysAgo(2), updatedAt: isoNow },
      { id: 'tkt2', condoId: 'c1', title: 'Vazamento no banheiro da piscina', description: 'Torneira com vazamento constante desperdicando agua.', location: 'Area da Piscina', priority: 'high', status: 'in_progress', category: 'Hidraulica', reportedBy: 'u5', reportedByName: 'Pedro Costa', assignedTo: 'Encanador Jose', photos: [], createdAt: daysAgo(5), updatedAt: isoNow },
    ],
    documentsLibrary: [
      { id: 'doc1', condoId: 'c1', title: 'Convencao do Condominio', category: 'Juridico', description: 'Convencao condominial atualizada em 2023', fileType: 'PDF', fileSize: '2.4 MB', uploadedBy: 'u2', uploadedByName: 'Carlos Mendes', createdAt: daysAgo(30), version: '3.0', tags: ['convencao', 'regras', 'juridico'] },
      { id: 'doc2', condoId: 'c1', title: 'Regimento Interno', category: 'Regras', description: 'Regimento interno com normas de convivencia', fileType: 'PDF', fileSize: '1.8 MB', uploadedBy: 'u2', uploadedByName: 'Carlos Mendes', createdAt: daysAgo(20), version: '2.1', tags: ['regimento', 'normas'] },
    ],
    accessControlLogs: [
      { id: 'acc1', condoId: 'c1', type: 'visitor', name: 'Roberto Alves', document: '123.456.789-00', destination: 'AP 202-B', purpose: 'Visita familiar', enteredAt: daysAgo(0), authorizedBy: 'Pedro Costa', status: 'inside' },
      { id: 'acc2', condoId: 'c1', type: 'service', name: 'Carlos Eletricista', document: '987.654.321-00', destination: 'Area Comum', purpose: 'Manutencao eletrica', company: 'Eletro Servicos LTDA', enteredAt: daysAgo(1), exitedAt: daysAgo(1), status: 'exited' },
    ],
    lostFoundItems: [
      { id: 'lf1', condoId: 'c1', type: 'found', title: 'Chave com chaveiro azul', description: 'Encontrada no corredor do 2 andar', location: 'Corredor Bloco B - 2 Andar', category: 'Chaves', reportedBy: 'u3', reportedByName: 'Joao Porteiro', status: 'active', createdAt: daysAgo(1) },
      { id: 'lf2', condoId: 'c1', type: 'lost', title: 'Oculos de grau - armacao vermelha', description: 'Perdi meus oculos na area da piscina ou academia', location: 'Piscina / Academia', category: 'Acessorios', reportedBy: 'u4', reportedByName: 'Maria Silva', contactPhone: '(11) 99999-0004', status: 'active', createdAt: daysAgo(0) },
    ],
  };
}
