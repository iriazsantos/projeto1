/*
  Warnings:

  - You are about to drop the `GatewayConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GatewayConfig";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "condoId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "method" TEXT NOT NULL DEFAULT 'pix',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerCpf" TEXT NOT NULL,
    "gatewayProvider" TEXT NOT NULL,
    "gatewayChargeId" TEXT,
    "gatewayStatus" TEXT,
    "pixCode" TEXT,
    "qrCodeImage" TEXT,
    "boletoUrl" TEXT,
    "webhookReceived" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "paymentProof" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "Condominium" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gateway_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "condominiumId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "gateway_configs_condominiumId_fkey" FOREIGN KEY ("condominiumId") REFERENCES "Condominium" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GatewayStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "condominiumId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastHealthCheck" DATETIME,
    "lastSuccessfulRequest" DATETIME,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "requestsSent" INTEGER NOT NULL DEFAULT 0,
    "requestsReceived" INTEGER NOT NULL DEFAULT 0,
    "successfulRequests" INTEGER NOT NULL DEFAULT 0,
    "failedRequests" INTEGER NOT NULL DEFAULT 0,
    "averageResponseTime" REAL NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastErrorAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GatewayStatus_condominiumId_fkey" FOREIGN KEY ("condominiumId") REFERENCES "Condominium" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "master_gateway_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Master Gateway',
    "provider" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "coverageType" TEXT NOT NULL DEFAULT 'all',
    "coveredCondos" TEXT,
    "defaultLicenseValue" REAL NOT NULL DEFAULT 299.00,
    "billingDay" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastHealthCheck" DATETIME,
    "lastSuccessfulCharge" DATETIME
);

-- CreateTable
CREATE TABLE "license_billings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "condoId" TEXT NOT NULL,
    "masterGatewayId" TEXT,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gatewayProvider" TEXT,
    "gatewayChargeId" TEXT,
    "gatewayStatus" TEXT,
    CONSTRAINT "license_billings_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "Condominium" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Payment_condoId_idx" ON "Payment"("condoId");

-- CreateIndex
CREATE INDEX "Payment_gatewayChargeId_idx" ON "Payment"("gatewayChargeId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_configs_provider_condominiumId_key" ON "gateway_configs"("provider", "condominiumId");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayStatus_provider_condominiumId_key" ON "GatewayStatus"("provider", "condominiumId");

-- CreateIndex
CREATE INDEX "license_billings_condoId_billingMonth_idx" ON "license_billings"("condoId", "billingMonth");

-- CreateIndex
CREATE INDEX "license_billings_status_idx" ON "license_billings"("status");
