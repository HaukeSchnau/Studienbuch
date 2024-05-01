/*
  Warnings:

  - A unique constraint covering the columns `[year,type,schoolId]` on the table `Semester` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Semester_year_type_schoolId_key" ON "Semester"("year", "type", "schoolId");
