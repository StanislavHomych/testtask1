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
    summary: 'Upload PDF bytes through the API (used when browser S3 CORS is blocked)',
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
