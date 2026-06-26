-- Allow deleting users while preserving scan history.
ALTER TABLE "MealScan" DROP CONSTRAINT IF EXISTS "MealScan_userId_fkey";
ALTER TABLE "MealScan" DROP CONSTRAINT IF EXISTS "MealScan_scannedById_fkey";

ALTER TABLE "MealScan" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "MealScan" ALTER COLUMN "scannedById" DROP NOT NULL;

ALTER TABLE "MealScan"
  ADD CONSTRAINT "MealScan_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MealScan"
  ADD CONSTRAINT "MealScan_scannedById_fkey"
  FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
