/*
  Warnings:

  - You are about to drop the column `classId` on the `Course` table. All the data in the column will be lost.

*/

-- CreateTable
CREATE TABLE "_ClassToCourse" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ClassToCourse_AB_unique" ON "_ClassToCourse"("A", "B");

-- CreateIndex
CREATE INDEX "_ClassToCourse_B_index" ON "_ClassToCourse"("B");

-- AddForeignKey
ALTER TABLE "_ClassToCourse" ADD CONSTRAINT "_ClassToCourse_A_fkey" FOREIGN KEY ("A") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClassToCourse" ADD CONSTRAINT "_ClassToCourse_B_fkey" FOREIGN KEY ("B") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Move data from Course.classId to _ClassToCourse.B
INSERT INTO "_ClassToCourse" ("A", "B")
  SELECT "classId" AS "A", "id" AS "B"
  FROM "Course";

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_classId_fkey";

-- DropIndex
DROP INDEX "Course_courseId_classId_key";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "classId";
