/*
  Warnings:

  - The primary key for the `Absence` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Grade` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Semester` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Task` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `type` to the `Semester` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `Semester` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SemesterType" AS ENUM ('SUMMER', 'WINTER');

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_semesterId_fkey";

-- AlterTable
ALTER TABLE "Absence" DROP CONSTRAINT "Absence_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Absence_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Absence_id_seq";

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "semesterId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Grade_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Grade_id_seq";

-- AlterTable
ALTER TABLE "Semester" DROP CONSTRAINT "Semester_pkey",
ADD COLUMN     "type" "SemesterType" NOT NULL,
ADD COLUMN     "year" INTEGER NOT NULL,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Semester_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Task" DROP CONSTRAINT "Task_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Task_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Task_id_seq";

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;
