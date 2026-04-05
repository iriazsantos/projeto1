ALTER TABLE "master_gateway_configs"
ADD COLUMN "autoGenerateBillings" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "master_gateway_configs"
ADD COLUMN "recurrenceDay" INTEGER NOT NULL DEFAULT 25;

ALTER TABLE "master_gateway_configs"
ADD COLUMN "autoIssueCharges" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "master_gateway_configs"
ADD COLUMN "autoIssueMethod" TEXT NOT NULL DEFAULT 'boleto';

ALTER TABLE "master_gateway_configs"
ADD COLUMN "lastRecurringRunMonth" TEXT;

ALTER TABLE "master_gateway_configs"
ADD COLUMN "lastRecurringRunAt" DATETIME;
