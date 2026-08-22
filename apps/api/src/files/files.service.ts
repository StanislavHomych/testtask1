import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  FileStatus,
  ResourceStatus,
  type File,
  type Folder,
} from '../../generated/prisma/client';
import { AccessService } from '../common/authorization/access.service';
import type { AccessRole } from '../common/authorization/access.types';
import { allocateUniqueFileName } from '../common/utils/unique-name';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import type { CompleteFileUploadDto } from './dto/complete-file-upload.dto';
import type { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import type { MoveFileDto } from './dto/move-file.dto';
import type { UpdateFileDto } from './dto/update-file.dto';

const PDF_MIME = 'application/pdf';
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface FileResponse {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: string;
  folderId: string;
  dataRoomId: string;
  status: FileStatus;
  createdAt: string;
  updatedAt: string;
  role?: AccessRole;
  canWrite?: boolean;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly accessService: AccessService,
    private readonly storage: StorageService,
  ) {}

  async createUploadUrl(
    clerkUserId: string,
    dto: CreateUploadUrlDto,
  ): Promise<{
    file: FileResponse;
    uploadUrl: string;
    expiresInSeconds: number;
  }> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const folder = await this.assertCanWriteFolder(user.id, dto.folderId);

    if (dto.mimeType !== PDF_MIME) {
      throw new BadRequestException('Only PDF uploads are supported');
    }
    if (dto.size <= 0 || dto.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `File size must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`,
      );
    }

    const originalName = dto.fileName.trim();
    if (!originalName.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('File name must end with .pdf');
    }

    const fileId = randomUUID();
    const storageKey = this.storage.fileObjectKey(folder.dataRoomId, fileId);
    const { name, nameKey } = await allocateUniqueFileName(
      this.prisma,
      folder.id,
      originalName,
    );

    const file = await this.prisma.file.create({
      data: {
        id: fileId,
        name,
        nameKey,
        originalName,
        mimeType: PDF_MIME,
        size: BigInt(dto.size),
        storageKey,
        folderId: folder.id,
        uploadedById: user.id,
        status: FileStatus.PENDING_UPLOAD,
      },
    });

    const upload = await this.storage.createUploadUrl(storageKey, PDF_MIME);

    return {
      file: this.toResponse(file, folder.dataRoomId),
      uploadUrl: upload.url,
      expiresInSeconds: upload.expiresInSeconds,
    };
  }

  async completeUpload(
    clerkUserId: string,
    fileId: string,
    dto: CompleteFileUploadDto,
  ): Promise<FileResponse> {
    void dto;
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const file = await this.findFileOrThrow(fileId);
    await this.assertCanWriteFolder(user.id, file.folderId);

    if (
      file.status !== FileStatus.PENDING_UPLOAD &&
      file.status !== FileStatus.FAILED
    ) {
      throw new BadRequestException('File is not awaiting upload completion');
    }

    const metadata = await this.storage.getObjectMetadata(file.storageKey);
    if (!metadata) {
      await this.prisma.file.update({
        where: { id: fileId },
        data: { status: FileStatus.FAILED },
      });
      throw new BadRequestException('Uploaded object was not found in storage');
    }

    if (metadata.contentLength !== Number(file.size)) {
      await this.prisma.file.update({
        where: { id: fileId },
        data: { status: FileStatus.FAILED },
      });
      throw new BadRequestException(
        'Uploaded object size does not match the declared file size',
      );
    }

    if (
      metadata.contentType &&
      metadata.contentType !== PDF_MIME &&
      metadata.contentType !== 'application/octet-stream'
    ) {
      await this.prisma.file.update({
        where: { id: fileId },
        data: { status: FileStatus.FAILED },
      });
      throw new BadRequestException('Uploaded object is not a PDF');
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { status: FileStatus.AVAILABLE },
      include: { folder: { select: { dataRoomId: true } } },
    });

    return this.toResponse(updated, updated.folder.dataRoomId);
  }

  async getOne(clerkUserId: string, fileId: string): Promise<FileResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const access = await this.accessService.getFileAccess(user.id, fileId);
    if (!access.allowed || !access.role) {
      throw new NotFoundException('File not found');
    }

    const file = await this.findAvailableOrPendingOrThrow(fileId);
    return {
      ...this.toResponse(file, file.folder.dataRoomId),
      role: access.role,
      canWrite: access.role === 'OWNER' || access.role === 'EDITOR',
    };
  }

  async createViewUrl(
    clerkUserId: string,
    fileId: string,
  ): Promise<{ url: string; expiresInSeconds: number; file: FileResponse }> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const access = await this.accessService.getFileAccess(user.id, fileId);
    if (!access.allowed || !access.role) {
      throw new NotFoundException('File not found');
    }

    const file = await this.findAvailableOrThrow(fileId);
    const download = await this.storage.createDownloadUrl(file.storageKey);

    return {
      url: download.url,
      expiresInSeconds: download.expiresInSeconds,
      file: this.toResponse(file, file.folder.dataRoomId),
    };
  }

  async update(
    clerkUserId: string,
    fileId: string,
    dto: UpdateFileDto,
  ): Promise<FileResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const file = await this.findMutableFileOrThrow(fileId);
    await this.assertCanWriteFolder(user.id, file.folderId);

    const desiredName = dto.name.trim().toLowerCase().endsWith('.pdf')
      ? dto.name.trim()
      : `${dto.name.trim()}.pdf`;

    const { name, nameKey } = await allocateUniqueFileName(
      this.prisma,
      file.folderId,
      desiredName,
      file.id,
    );

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { name, nameKey },
      include: { folder: { select: { dataRoomId: true } } },
    });

    return this.toResponse(updated, updated.folder.dataRoomId);
  }

  async move(
    clerkUserId: string,
    fileId: string,
    dto: MoveFileDto,
  ): Promise<FileResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const file = await this.findMutableFileOrThrow(fileId);
    await this.assertCanWriteFolder(user.id, file.folderId);

    const targetFolder = await this.assertCanWriteFolder(
      user.id,
      dto.targetFolderId,
    );
    if (targetFolder.dataRoomId !== file.folder.dataRoomId) {
      throw new BadRequestException('Files cannot be moved across data rooms');
    }

    const { name, nameKey } = await allocateUniqueFileName(
      this.prisma,
      targetFolder.id,
      file.name,
      file.id,
    );

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        folderId: targetFolder.id,
        name,
        nameKey,
      },
      include: { folder: { select: { dataRoomId: true } } },
    });

    return this.toResponse(updated, updated.folder.dataRoomId);
  }

  async remove(clerkUserId: string, fileId: string): Promise<void> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const file = await this.findMutableFileOrThrow(fileId);
    await this.assertCanWriteFolder(user.id, file.folderId);

    const freedNameKey = `${file.nameKey}__deleted__${file.id}`;
    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.DELETED,
        deletedAt: new Date(),
        nameKey: freedNameKey,
      },
    });

    try {
      await this.storage.deleteObject(file.storageKey);
    } catch {
      // Soft-deleted metadata remains authoritative; orphan cleanup can retry.
    }
  }

  private async assertCanWriteFolder(
    userId: string,
    folderId: string,
  ): Promise<Folder> {
    const access = await this.accessService.getFolderAccess(userId, folderId);
    if (!access.allowed || !access.folder) {
      throw new NotFoundException('Folder not found');
    }
    if (access.role !== 'OWNER' && access.role !== 'EDITOR') {
      throw new ForbiddenException('You cannot modify files in this folder');
    }
    return access.folder;
  }

  private async findFileOrThrow(
    fileId: string,
  ): Promise<File & { folder: Folder }> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { folder: true },
    });
    if (!file || file.status === FileStatus.DELETED) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  private async findMutableFileOrThrow(
    fileId: string,
  ): Promise<File & { folder: Folder }> {
    const file = await this.findFileOrThrow(fileId);
    if (file.folder.status !== ResourceStatus.ACTIVE) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  private async findAvailableOrThrow(
    fileId: string,
  ): Promise<File & { folder: { dataRoomId: string } }> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { folder: { select: { dataRoomId: true, status: true } } },
    });
    if (
      !file ||
      file.status !== FileStatus.AVAILABLE ||
      file.folder.status !== ResourceStatus.ACTIVE
    ) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  private async findAvailableOrPendingOrThrow(
    fileId: string,
  ): Promise<File & { folder: { dataRoomId: string } }> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { folder: { select: { dataRoomId: true, status: true } } },
    });
    if (
      !file ||
      file.folder.status !== ResourceStatus.ACTIVE ||
      (file.status !== FileStatus.AVAILABLE &&
        file.status !== FileStatus.PENDING_UPLOAD &&
        file.status !== FileStatus.FAILED)
    ) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  private toResponse(file: File, dataRoomId: string): FileResponse {
    return {
      id: file.id,
      name: file.name,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size.toString(),
      folderId: file.folderId,
      dataRoomId,
      status: file.status,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  }
}
