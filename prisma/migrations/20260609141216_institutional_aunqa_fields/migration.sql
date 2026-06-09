-- AlterTable
ALTER TABLE "academic_staff" ADD COLUMN     "employmentType" TEXT,
ADD COLUMN     "fte" DOUBLE PRECISION,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "recruitedYear" INTEGER,
ADD COLUMN     "trainingActivities" TEXT;

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN     "area" DOUBLE PRECISION,
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "usableYear" INTEGER,
ADD COLUMN     "utilizationRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "outcome_metrics" ADD COLUMN     "benchmark" DOUBLE PRECISION,
ADD COLUMN     "cohort" TEXT,
ADD COLUMN     "dataSource" TEXT,
ADD COLUMN     "target" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "student_services" ADD COLUMN     "beneficiaries" INTEGER,
ADD COLUMN     "responsibleUnit" TEXT,
ADD COLUMN     "targetGroup" TEXT;
