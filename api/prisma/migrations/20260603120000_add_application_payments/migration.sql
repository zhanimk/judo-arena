-- Tournament entry fee and application payment tracking.

CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED');

ALTER TABLE "Tournament"
ADD COLUMN "entryFeeKzt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "kaspiPaymentUrl" TEXT;

ALTER TABLE "Application"
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "paymentAmountKzt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paymentProvider" TEXT,
ADD COLUMN "paymentReference" TEXT,
ADD COLUMN "paymentUrl" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE INDEX "Application_paymentStatus_idx" ON "Application"("paymentStatus");
CREATE INDEX "Application_paymentReference_idx" ON "Application"("paymentReference");
