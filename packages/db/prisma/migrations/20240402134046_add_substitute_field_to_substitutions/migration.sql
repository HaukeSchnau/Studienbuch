-- AlterTable
ALTER TABLE "Substitution" ADD COLUMN     "substituteId" INTEGER;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_substituteId_fkey" FOREIGN KEY ("substituteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
