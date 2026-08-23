import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { CompleteFileUploadDto } from './dto/complete-file-upload.dto';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { MoveFileDto } from './dto/move-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import {
  CompleteVersionUploadDto,
  CreateVersionUploadUrlDto,
} from './dto/version-upload.dto';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiBearerAuth('clerk')
@Controller('files')
@UseGuards(ClerkAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  @ApiOperation({
    summary: 'Create a pending file and a short-lived S3 upload URL',
  })
  createUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.filesService.createUploadUrl(user.clerkUserId, dto);
  }

  @Put(':id/content')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  @ApiOperation({
    summary:
      'Upload PDF bytes through the API (fallback when browser S3 CORS is blocked)',
  })
  uploadContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('file is required');
    }
    return this.filesService.uploadContent(
      user.clerkUserId,
      id,
      file.buffer,
      file.mimetype,
    );
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark an upload complete after browser PUT to S3' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteFileUploadDto,
  ) {
    return this.filesService.completeUpload(user.clerkUserId, id, dto);
  }

  @Post(':id/versions/upload-url')
  @ApiOperation({ summary: 'Create a presigned URL for a new file version' })
  createVersionUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVersionUploadUrlDto,
  ) {
    return this.filesService.createVersionUploadUrl(user.clerkUserId, id, dto);
  }

  @Post(':id/versions/complete')
  @ApiOperation({ summary: 'Finalize a new file version after S3 upload' })
  completeVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteVersionUploadDto,
  ) {
    return this.filesService.completeVersionUpload(user.clerkUserId, id, dto);
  }

  @Put(':id/versions/content')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  @ApiOperation({
    summary: 'Upload a new file version through the API (CORS fallback)',
  })
  uploadVersionContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('file is required');
    }
    return this.filesService.uploadVersionContent(
      user.clerkUserId,
      id,
      file.buffer,
      file.mimetype,
      file.originalname || 'document.pdf',
    );
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List file versions' })
  listVersions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.listVersions(user.clerkUserId, id);
  }

  @Get(':id/versions/:versionId/view-url')
  @ApiOperation({ summary: 'Create a short-lived view URL for a file version' })
  versionViewUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.filesService.createVersionViewUrl(
      user.clerkUserId,
      id,
      versionId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file metadata' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.getOne(user.clerkUserId, id);
  }

  @Get(':id/view-url')
  @ApiOperation({ summary: 'Create a short-lived S3 view URL' })
  viewUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.createViewUrl(user.clerkUserId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a file' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFileDto,
  ) {
    return this.filesService.update(user.clerkUserId, id, dto);
  }

  @Post(':id/move')
  @ApiOperation({ summary: 'Move a file within the same data room' })
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveFileDto,
  ) {
    return this.filesService.move(user.clerkUserId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a file and its S3 object' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.filesService.remove(user.clerkUserId, id);
  }
}
