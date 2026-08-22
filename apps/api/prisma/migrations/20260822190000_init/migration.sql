-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('DATA_ROOM', 'FOLDER', 'FILE');

-- CreateEnum
CREATE TYPE "ShareRole" AS ENUM ('VIEWER', 'EDITOR');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('ACTIVE', 'DELETING', 'DELETED');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING_UPLOAD', 'AVAILABLE', 'FAILED', 'DELETING', 'DELETED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRoom" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DataRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "dataRoomId" UUID NOT NULL,
    "parentId" UUID,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "folderId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Share" (
    "id" UUID NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "dataRoomId" UUID,
    "folderId" UUID,
    "fileId" UUID,
    "userId" UUID,
    "publicToken" TEXT,
    "role" "ShareRole" NOT NULL DEFAULT 'VIEWER',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "DataRoom_ownerId_status_createdAt_id_idx" ON "DataRoom"("ownerId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Folder_dataRoomId_parentId_status_nameKey_id_idx" ON "Folder"("dataRoomId", "parentId", "status", "nameKey", "id");

-- CreateIndex
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_dataRoomId_parentId_nameKey_key" ON "Folder"("dataRoomId", "parentId", "nameKey");

-- Prisma compound uniqueness treats NULL parent IDs as distinct. This partial
-- index enforces case-normalized sibling uniqueness for root folders too.
CREATE UNIQUE INDEX "Folder_root_nameKey_key"
ON "Folder"("dataRoomId", "nameKey")
WHERE "parentId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "File_storageKey_key" ON "File"("storageKey");

-- CreateIndex
CREATE INDEX "File_folderId_status_nameKey_id_idx" ON "File"("folderId", "status", "nameKey", "id");

-- CreateIndex
CREATE INDEX "File_uploadedById_idx" ON "File"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "File_folderId_nameKey_key" ON "File"("folderId", "nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Share_publicToken_key" ON "Share"("publicToken");

-- CreateIndex
CREATE INDEX "Share_userId_revokedAt_resourceType_idx" ON "Share"("userId", "revokedAt", "resourceType");

-- CreateIndex
CREATE INDEX "Share_dataRoomId_userId_revokedAt_idx" ON "Share"("dataRoomId", "userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Share_folderId_userId_revokedAt_idx" ON "Share"("folderId", "userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Share_fileId_userId_revokedAt_idx" ON "Share"("fileId", "userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Share_createdById_revokedAt_idx" ON "Share"("createdById", "revokedAt");

-- A share has exactly one typed resource target and exactly one audience.
ALTER TABLE "Share" ADD CONSTRAINT "Share_target_check" CHECK (
    ("resourceType" = 'DATA_ROOM' AND "dataRoomId" IS NOT NULL AND "folderId" IS NULL AND "fileId" IS NULL)
 OR ("resourceType" = 'FOLDER' AND "dataRoomId" IS NULL AND "folderId" IS NOT NULL AND "fileId" IS NULL)
 OR ("resourceType" = 'FILE' AND "dataRoomId" IS NULL AND "folderId" IS NULL AND "fileId" IS NOT NULL)
);

ALTER TABLE "Share" ADD CONSTRAINT "Share_audience_check" CHECK (
    ("userId" IS NOT NULL AND "publicToken" IS NULL)
 OR ("userId" IS NULL AND "publicToken" IS NOT NULL)
);

CREATE UNIQUE INDEX "Share_active_dataRoom_user_key"
ON "Share"("dataRoomId", "userId")
WHERE "dataRoomId" IS NOT NULL AND "userId" IS NOT NULL AND "revokedAt" IS NULL;

CREATE UNIQUE INDEX "Share_active_folder_user_key"
ON "Share"("folderId", "userId")
WHERE "folderId" IS NOT NULL AND "userId" IS NOT NULL AND "revokedAt" IS NULL;

CREATE UNIQUE INDEX "Share_active_file_user_key"
ON "Share"("fileId", "userId")
WHERE "fileId" IS NOT NULL AND "userId" IS NOT NULL AND "revokedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "DataRoom" ADD CONSTRAINT "DataRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_dataRoomId_fkey" FOREIGN KEY ("dataRoomId") REFERENCES "DataRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_dataRoomId_fkey" FOREIGN KEY ("dataRoomId") REFERENCES "DataRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
