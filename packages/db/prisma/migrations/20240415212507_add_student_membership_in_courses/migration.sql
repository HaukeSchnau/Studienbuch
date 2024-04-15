/*
  Warnings:

  - You are about to drop the column `yearId` on the `Course` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_yearId_fkey";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "yearId";

-- CreateTable
CREATE TABLE "_students" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_students_AB_unique" ON "_students"("A", "B");

-- CreateIndex
CREATE INDEX "_students_B_index" ON "_students"("B");

-- AddForeignKey
ALTER TABLE "_students" ADD CONSTRAINT "_students_A_fkey" FOREIGN KEY ("A") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_students" ADD CONSTRAINT "_students_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
