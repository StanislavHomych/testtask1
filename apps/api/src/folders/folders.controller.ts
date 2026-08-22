import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { CreateFolderDto } from './dto/create-folder.dto';
import { ListFolderContentsDto } from './dto/list-folder-contents.dto';
import { MoveFolderDto } from './dto/move-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { FoldersService } from './folders.service';

@ApiTags('folders')
@ApiBearerAuth('clerk')
@Controller('folders')
@UseGuards(ClerkAuthGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get folder metadata and breadcrumbs' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.foldersService.getOne(user.clerkUserId, id);
  }

  @Get(':id/contents')
  @ApiOperation({ summary: 'List one level of folder contents' })
  @ApiOkResponse({ description: 'Cursor-paginated folders and files' })
  getContents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListFolderContentsDto,
  ) {
    return this.foldersService.getContents(user.clerkUserId, id, query);
  }

  @Post(':id/folders')
  @ApiOperation({ summary: 'Create a child folder' })
  createChild(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.foldersService.create(user.clerkUserId, id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a folder' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.update(user.clerkUserId, id, dto);
  }

  @Post(':id/move')
  @ApiOperation({ summary: 'Move a folder (cycle-safe, same data room)' })
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveFolderDto,
  ) {
    return this.foldersService.move(user.clerkUserId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a folder and its subtree' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.foldersService.remove(user.clerkUserId, id);
  }
}
