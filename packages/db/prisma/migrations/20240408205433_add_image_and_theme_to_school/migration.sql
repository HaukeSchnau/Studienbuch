/*
  Warnings:

  - Added the required column `image` to the `School` table without a default value. This is not possible if the table is not empty.
  - Added the required column `theme` to the `School` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "School" ADD COLUMN     "image" TEXT NOT NULL DEFAULT 'https://studienbuch.app/assets/icon.png',
ADD COLUMN     "theme" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "School" ALTER COLUMN "image" DROP DEFAULT,
ALTER COLUMN "theme" DROP DEFAULT;
