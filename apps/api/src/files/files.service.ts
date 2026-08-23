import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
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
import { looksLikePdf } from '../common/utils/pdf';
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
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  role?: AccessRole;
  canWrite?: boolean;
}

export interface FileVersionResponse {
  id: string;
  fileId: string;
  version: number;
  name: string;
  originalName: string;
  mimeType: string;
  size: string;
  createdAt: string;
  isCurrent: boolean;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

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
        currentVersion: 1,
      },
    });

    const upload = await this.storage.createUploadUrl(storageKey);

    return {
      file: this.toResponse(file, folder.dataRoomId),
      uploadUrl: upload.url,
      expiresInSeconds: upload.expiresInSeconds,
    };
  }

  async createVersionUploadUrl(
    clerkUserId: string,
    fileId: string,
    dto: { fileName: string; mimeType: string; size: number },
  ): Promise<{
    file: FileResponse;
    uploadUrl: string;
    expiresInSeconds: number;
    stagingKey: string;
    nextVersion: number;
  }> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const file = await this.findMutableFileOrThrow(fileId);
    await this.assertCanWriteFolder(user.id, file.folderId);

    if (file.status !== FileStatus.AVAILABLE) {
      throw new BadRequestException(
        'Only available files can receive a new version',
      );
    }
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

    const nextVersion = file.currentVersion + 1;
    const stagingKey = `${file.storageKey}.v${nextVersion}.${randomUUID()}`;
    const upload = await this.storage.createUploadUrl(stagingKey);

    return {
      file: this.toResponse(file, file.folder.dataRoomId),
      uploadUrl: upload.url,
      expiresInSeconds: upload.expiresInSeconds,
      stagingKey,
      nextVersion,
    };
  }

  async completeVersionUpload(
    clerkUserId: string,
    fileId: string,
    dto: { size: number; fileName: string; stagingKey: string },
  ): Promise<FileResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const file = await this.findMutableFileOrThrow(fileId);
    await this.assertCanWriteFolder(user.id, file.folderId);

    if (file.status !== FileStatus.AVAILABLE) {
      throw new BadRequestException(
        'Only available files can receive a new version',
      );
    }
    if (!dto.stagingKey.startsWith(`${file.storageKey}.v`)) {
      throw new BadRequestException('Invalid staging object key');
    }

    const metadata = await this.storage.getObjectMetadata(dto.stagingKey);
    if (!metadata) {
      throw new BadRequestException('Uploaded object was not found in storage');
    }
    if (metadata.contentLength !== dto.size) {
      throw new BadRequestException(
        'Uploaded object size does not match the declared file size',
      );
    }
    await this.assertStoredObjectIsPdf(dto.stagingKey);

    const nextVersion = file.currentVersion + 1;
    const originalName = dto.fileName.trim().toLowerCase().endsWith('.pdf')
      ? dto.fileName.trim()
      : `${dto.fileName.trim()}.pdf`;
    const previousKey = file.storageKey;

    await this.prisma.$transaction(async (tx) => {
      await tx.fileVersion.create({
        data: {
          fileId: file.id,
          version: file.currentVersion,
          name: file.name,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          storageKey: previousKey,
          uploadedById: file.uploadedById,
        },
      });

      await tx.file.update({
        where: { id: file.id },
        data: {
          storageKey: dto.stagingKey,
          size: BigInt(dto.size),
          originalName,
          mimeType: PDF_MIME,
          currentVersion: nextVersion,
          uploadedById: user.id,
          status: FileStatus.AVAILABLE,
        },
      });
    });

    const updated = await this.prisma.file.findUniqueOrThrow({
      where: { id: file.id },
      include: { folder: { select: { dataRoomId: true } } },
    });

    return this.toResponse(updated, updated.folder.dataRoomId);
  }

  async uploadVersionContent(
    clerkUserId: string,
    fileId: string,
    body: Buffer,
    mimeType: string,
    fileName: string,
  ): Promise<FileResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const file = await this.findMutableFileOrThrow(fileId);
    await this.assertCanWriteFolder(user.id, file.folderId);

    if (file.status !== FileStatus.AVAILABLE) {
      throw new BadRequestException(
        'Only available files can receive a new version',
      );
    }
    if (mimeType !== PDF_MIME && mimeType !== 'application/octet-stream') {
      throw new BadRequestException('Only PDF uploads are supported');
    }
    if (!looksLikePdf(body)) {
      throw new BadRequestException('Uploaded bytes are not a valid PDF');
    }
    if (body.byteLength <= 0 || body.byteLength > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `File size must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`,
      );
    }

    const nextVersion = file.currentVersion + 1;
    const stagingKey = `${file.storageKey}.v${nextVersion}.${randomUUID()}`;
    try {
      await this.storage.putObject(stagingKey, body, PDF_MIME);
    } catch (error) {
      const awsError = error as { Code?: string; name?: string };
      const code = awsError.Code ?? awsError.name ?? 'UnknownError';
      this.logger.error(
        `Storage version upload failed for file ${fileId}: ${code}`,
      );
      throw new ServiceUnavailableException(
        'Could not store the uploaded file. Try again in a moment.',
      );
    }

    return this.completeVersionUpload(clerkUserId, fileId, {
      size: body.byteLength,
      fileName,
      stagingKey,
    });
  }

  async listVersions(
    clerkUserId: string,
    fileId: string,
  ): Promise<{ items: FileVersionResponse[] }> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const access = await this.accessService.getFileAccess(user.id, fileId);
    if (!access.allowed || !access.role) {
      throw new NotFoundException('File not found');
    }

    const file = await this.findAvailableOrThrow(fileId);
    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { version: 'desc' },
    });

    return {
      items: [
        {
          id: `current-${file.id}`,
          fileId: file.id,
          version: file.currentVersion,
          name: file.name,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size.toString(),
          createdAt: file.updatedAt.toISOString(),
          isCurrent: true,
        },
        ...versions.map((row) => ({
          id: row.id,
          fileId: row.fileId,
          version: row.version,
          name: row.name,
          originalName: row.originalName,
          mimeType: row.mimeType,
          size: row.size.toString(),
          createdAt: row.createdAt.toISOString(),
          isCurrent: false,
        })),
      ],
    };
  }

  async createVersionViewUrl(
    clerkUserId: string,
    fileId: string,
    versionId: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const access = await this.accessService.getFileAccess(user.id, fileId);
    if (!access.allowed || !access.role) {
      throw new NotFoundException('File not found');
    }

    if (versionId.startsWith('current-')) {
      const file = await this.findAvailableOrThrow(fileId);
      return this.storage.createDownloadUrl(file.storageKey);
    }

    const version = await this.prisma.fileVersion.findFirst({
      where: { id: versionId, fileId },
    });
    if (!version) {
      throw new NotFoundException('File version not found');
    }
    return this.storage.createDownloadUrl(version.storageKey);
  }

  async uploadContent(
    clerkUserId: string,
    fileId: string,
    body: Buffer,
    mimeType: string,
  ): Promise<FileResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const file = await this.findFileOrThrow(fileId);
    await this.assertCanWriteFolder(user.id, file.folderId);

    if (
      file.status !== FileStatus.PENDING_UPLOAD &&
      file.status !== FileStatus.FAILED
    ) {
      throw new BadRequestException('File is not awaiting upload');
    }
    if (mimeType !== PDF_MIME && mimeType !== 'application/octet-stream') {
      throw new BadRequestException('Only PDF uploads are supported');
    }
    if (!looksLikePdf(body)) {
      throw new BadRequestException('Uploaded bytes are not a valid PDF');
    }
    if (body.byteLength !== Number(file.size)) {
      throw new BadRequestException(
        'Uploaded bytes do not match the declared file size',
      );
    }

    try {
      await this.storage.putObject(file.storageKey, body, PDF_MIME);
    } catch (error) {
      await this.prisma.file.update({
        where: { id: fileId },
        data: { status: FileStatus.FAILED },
      });

      const awsError = error as { Code?: string; name?: string };
      const code = awsError.Code ?? awsError.name ?? 'UnknownError';
      this.logger.error(`Storage upload failed for file ${fileId}: ${code}`);

      if (code === 'SignatureDoesNotMatch' || code === 'InvalidAccessKeyId') {
        throw new ServiceUnavailableException(
          'File storage credentials are misconfigured. Check AWS keys on the API host.',
        );
      }

      throw new ServiceUnavailableException(
        'Could not store the uploaded file. Try again in a moment.',
      );
    }

    return this.completeUpload(clerkUserId, fileId, {});
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

    try {
      await this.assertStoredObjectIsPdf(file.storageKey);
    } catch (error) {
      await this.prisma.file.update({
        where: { id: fileId },
        data: { status: FileStatus.FAILED },
      });
      throw error;
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

    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId },
      select: { storageKey: true },
    });

    const freedNameKey = `${file.nameKey}__deleted__${file.id}`;
    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.DELETED,
        deletedAt: new Date(),
        nameKey: freedNameKey,
      },
    });

    await this.storage.deleteObjectsBestEffort([
      file.storageKey,
      ...versions.map((row) => row.storageKey),
    ]);
  }

  private async assertStoredObjectIsPdf(storageKey: string): Promise<void> {
    const prefix = await this.storage.getObjectPrefix(storageKey, 5);
    if (!prefix || !looksLikePdf(prefix)) {
      throw new BadRequestException('Uploaded object is not a valid PDF');
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
      currentVersion: file.currentVersion,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  }
}
