-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('EDIT_INFO_PAGES', 'EDIT_USERS', 'EDIT_COURSES', 'EDIT_YEARS', 'EDIT_CLASSES', 'EDIT_SCHOOLS', 'VIEW_LOGS');

-- CreateEnum
CREATE TYPE "CourseTimeWeeks" AS ENUM ('EVEN', 'ODD', 'BOTH');

-- CreateEnum
CREATE TYPE "SubstitutionType" AS ENUM ('FREISETZUNG', 'VERTRETUNG', 'BETREUUNG', 'ENTFALL', 'TROTZ_ABSENZ');

-- CreateTable
CREATE TABLE "LicenseKey" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isSuperKey" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LicenseKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "title" TEXT,
    "abbrv" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "isSuperUser" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "defaultScope" JSONB,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionOnRole" (
    "permission" "Permission" NOT NULL,
    "roleId" INTEGER NOT NULL,
    "scope" JSONB,

    CONSTRAINT "PermissionOnRole_pkey" PRIMARY KEY ("permission","roleId")
);

-- CreateTable
CREATE TABLE "PermissionOnUser" (
    "permission" "Permission" NOT NULL,
    "userId" INTEGER NOT NULL,
    "scope" JSONB,

    CONSTRAINT "PermissionOnUser_pkey" PRIMARY KEY ("permission","userId")
);

-- CreateTable
CREATE TABLE "CourseTime" (
    "id" SERIAL NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "weeks" "CourseTimeWeeks" NOT NULL DEFAULT 'BOTH',
    "courseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "room" TEXT,
    "isChoosable" BOOLEAN NOT NULL DEFAULT false,
    "teacherId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "yearId" INTEGER NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" SERIAL NOT NULL,
    "identifierInYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yearId" INTEGER NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Year" (
    "id" SERIAL NOT NULL,
    "startYear" INTEGER NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" INTEGER NOT NULL,

    CONSTRAINT "Year_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Substitution" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lessonStart" INTEGER NOT NULL,
    "lessonEnd" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" INTEGER NOT NULL,
    "room" TEXT,
    "type" "SubstitutionType",

    CONSTRAINT "Substitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSubscription" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "courseId" INTEGER NOT NULL,
    "messagingToken" TEXT NOT NULL,

    CONSTRAINT "CourseSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "LicenseKey_key_key" ON "LicenseKey"("key");

-- CreateIndex
CREATE UNIQUE INDEX "User_abbrv_key" ON "User"("abbrv");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Course_courseId_classId_yearId_key" ON "Course"("courseId", "classId", "yearId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_identifierInYear_yearId_key" ON "Class"("identifierInYear", "yearId");

-- CreateIndex
CREATE UNIQUE INDEX "Year_startYear_schoolId_key" ON "Year"("startYear", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Substitution_date_lessonStart_courseId_key" ON "Substitution"("date", "lessonStart", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSubscription_courseId_messagingToken_key" ON "CourseSubscription"("courseId", "messagingToken");

-- CreateIndex
CREATE UNIQUE INDEX "School_name_key" ON "School"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_RoleToUser_AB_unique" ON "_RoleToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionOnRole" ADD CONSTRAINT "PermissionOnRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionOnUser" ADD CONSTRAINT "PermissionOnUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTime" ADD CONSTRAINT "CourseTime_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "Year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "Year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Year" ADD CONSTRAINT "Year_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

