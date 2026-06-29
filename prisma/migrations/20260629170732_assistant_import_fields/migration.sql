-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accommodation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "assistantRole" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gender" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "persalNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "subject" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "surnameInitials" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "User_persalNumber_idx" ON "User"("persalNumber");
