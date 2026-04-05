export type UserRole = 'admin' | 'sindico' | 'porteiro' | 'morador' | 'admin-master';

export interface LicenseCharge {
  id: string;
  condoId: string;
  condoName: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: string;
  viewedAt?: string;       // quando o síndico visualizou
  viewedBySindico: boolean;
  createdAt: string;
  reference: string;       // ex: "Novembro/2024"
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  cpf: string;
  birthDate: string;
  condoId?: string;
  unit?: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  active: boolean;
  photo?: string;             // foto do usuário (base64 ou URL)
  canViewCharges?: boolean;   // se morador pode visualizar cobranças da unidade
  kinship?: string;           // parentesco com o titular (ex: Cônjuge, Filho, etc.)
}

export interface Condo {
  id: string;
  name: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address: string;
  city: string;
  units: number;
  residents: number;
  sindico?: string;
  sindicoId?: string;
  active: boolean;
  blocked: boolean;        // bloqueado por inadimplência de licença
  blockedAt?: string;
  monthlyRevenue: number;
  pendingCharges: number;
  createdAt: string;
  licenseValue: number;    // valor mensal da licença INOVATECH
}

export interface Invoice {
  id: string;
  condoId: string;
  userId: string;
  userName: string;
  unit: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: string;
  createdAt: string;
}

export interface Delivery {
  id: string;
  condoId: string;
  unit: string;
  residentName: string;
  sender: string;
  trackingCode: string;
  description: string;
  arrivedAt: string;
  deliveredAt?: string;
  status: 'waiting' | 'delivered';
  qrToken: string;
  notified: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'delivery' | 'charge' | 'announcement' | 'vote' | 'reservation' | 'complaint';
  read: boolean;
  createdAt: string;
}

export interface Announcement {
  id: string;
  condoId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  priority: 'normal' | 'important' | 'urgent';
  createdAt: string;
}

export interface CommonArea {
  id: string;
  condoId: string;
  name: string;
  capacity: number;
  maxHours: number;
  pricePerHour: number;
  description: string;
  rules: string[];
  image: string;
  photoUrl?: string;
  cancellationFinePercent?: number;
  cancellationFineWindowHours?: number;
}

export interface Reservation {
  id: string;
  condoId: string;
  areaId: string;
  areaName: string;
  userId: string;
  userName: string;
  unit: string;
  date: string;
  startTime: string;
  endTime: string;
  totalCost: number;
  status: 'confirmed' | 'cancelled' | 'pending';
  cancelledAt?: string;
  cancellationFine?: number;
  createdAt: string;
}

export interface Vote {
  id: string;
  condoId: string;
  title: string;
  description: string;
  options: VoteOption[];
  createdBy: string;
  endDate: string;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface VoteOption {
  id: string;
  text: string;
  votes: string[];
}

export interface Complaint {
  id: string;
  condoId: string;
  category: string;
  description: string;
  location: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'read' | 'resolved';
  anonymous: boolean;
  reporterId?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  condoId: string;
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  email?: string;
  role: string; // Cargo: Zelador, Faxineiro, Jardineiro, etc.
  department: string;
  admissionDate: string;
  salary?: number;
  address?: string;
  notes?: string;
  document?: string; // RG
  createdAt: string;
}

export interface PixConfig {
  id: string;
  condoId: string;
  pixKey: string;               // chave PIX (CPF, CNPJ, email, telefone, aleatória)
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  receiverName: string;         // nome do recebedor
  receiverCity: string;         // cidade do recebedor
  bankName: string;             // banco
  qrCodeImage?: string;         // QR Code estático em base64 (opcional upload)
  description?: string;         // descrição padrão do pagamento
  updatedAt: string;
}

export interface MarketItem {
  id: string;
  condoId: string;
  sellerId: string;
  sellerName: string;
  unit: string;
  title: string;
  description: string;
  price: number;
  category: string;
  status: 'available' | 'sold';
  createdAt: string;
}
