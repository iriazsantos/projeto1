export interface GatewayConfig {
  id: string;
  provider: 'asaas' | 'mercadopago' | 'stripe';
  name: string;
  environment: 'sandbox' | 'production';
  isActive: boolean;
  blockGraceDays?: number;
  billingDay?: number;
  defaultLicenseValue?: number;
  autoGenerateBillings?: boolean;
  recurrenceDay?: number;
  autoIssueCharges?: boolean;
  autoIssueMethod?: 'pix' | 'boleto';
  lastRecurringRunMonth?: string | null;
  lastRecurringRunAt?: string | null;
  createdAt?: string;
}

export interface GatewayStatus {
  id: string;
  provider: string;
  isConnected: boolean;
  lastHealthCheck: string;
  lastSuccessfulRequest: string;
  requestsSent: number;
  requestsReceived: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  consecutiveFailures: number;
  lastError: string;
  lastErrorAt: string;
  trafficPercentage: number;
}

export interface Payment {
  id: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'processing';
  method: 'pix' | 'boleto' | 'credit_card' | 'debit_card';
  customerName: string;
  customerEmail: string;
  gatewayProvider: string;
  pixCode?: string;
  qrCodeImage?: string;
  boletoUrl?: string;
  createdAt: string;
  paidAt?: string;
}

export interface CreatePaymentForm {
  amount: string;
  customerName: string;
  customerEmail: string;
  customerCpf: string;
  method: 'pix' | 'boleto' | 'credit_card' | 'debit_card';
  description: string;
}

export interface Condominium {
  id: string;
  name: string;
  cnpj?: string;
  email?: string;
  address?: string;
  city?: string;
  units?: number;
}
