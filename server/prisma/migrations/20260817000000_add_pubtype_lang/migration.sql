-- AlterTable
ALTER TABLE "ArticleMeta" ADD COLUMN     "lang" TEXT NOT NULL DEFAULT 'eng',
ADD COLUMN     "pubType" TEXT[] DEFAULT ARRAY[]::TEXT[];

