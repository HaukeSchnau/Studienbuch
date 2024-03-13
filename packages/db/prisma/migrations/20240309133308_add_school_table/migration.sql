/*
  Warnings:

  - Added the required column `schoolId` to the `Year` table without a default value. This is not possible if the table is not empty.

*/

-- CreateTable
CREATE TABLE "School" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_name_key" ON "School"("name");

INSERT INTO "School" ("id", "name") VALUES (1, 'IGS Lilienthal');

-- AlterTable
ALTER TABLE "Year" ADD COLUMN     "schoolId" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "Year" ADD CONSTRAINT "Year_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Year" ALTER COLUMN "schoolId" DROP DEFAULT;
