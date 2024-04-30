-- CreateEnum
CREATE TYPE "StateCode" AS ENUM ('BB', 'BE', 'BW', 'BY', 'HB', 'HE', 'HH', 'MV', 'NI', 'NW', 'RP', 'SH', 'SL', 'SN', 'ST', 'TH');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "stateCode" "StateCode" NOT NULL DEFAULT 'NI';
