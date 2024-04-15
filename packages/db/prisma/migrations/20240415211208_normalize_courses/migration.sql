/*
  Warnings:

  - A unique constraint covering the columns `[courseId,classId]` on the table `Course` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_yearId_fkey";

-- DropIndex
DROP INDEX "Course_courseId_classId_yearId_key";

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "yearId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Course_courseId_classId_key" ON "Course"("courseId", "classId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "Year"("id") ON DELETE SET NULL ON UPDATE CASCADE;
