/*
  Warnings:

  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "StaticRole" AS ENUM ('TEACHER', 'STUDENT');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "StaticRole";

-- Seed Role Column
UPDATE "User" SET "role" = 'TEACHER' WHERE "role" IS NULL;
