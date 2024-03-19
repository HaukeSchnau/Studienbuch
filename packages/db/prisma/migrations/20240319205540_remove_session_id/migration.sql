/*
  Warnings:

  - The primary key for the `Session` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Session` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Session_token_key";

-- AlterTable
ALTER TABLE "Session" DROP CONSTRAINT "Session_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("token");
