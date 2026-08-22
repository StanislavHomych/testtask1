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
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DataRoomsService } from './data-rooms.service';
import { CreateDataRoomDto } from './dto/create-data-room.dto';
import { ListDataRoomsDto } from './dto/list-data-rooms.dto';
import { UpdateDataRoomDto } from './dto/update-data-room.dto';

@ApiTags('data-rooms')
@ApiBearerAuth('clerk')
@Controller('data-rooms')
@UseGuards(ClerkAuthGuard)
export class DataRoomsController {
  constructor(private readonly dataRoomsService: DataRoomsService) {}

  @Get()
  @ApiOperation({ summary: 'List owned and shared data rooms' })
  @ApiOkResponse({ description: 'Cursor-paginated data rooms' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDataRoomsDto,
  ) {
    return this.dataRoomsService.list(user.clerkUserId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a data room with a root folder' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDataRoomDto,
  ) {
    return this.dataRoomsService.create(user.clerkUserId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one data room' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.dataRoomsService.getOne(user.clerkUserId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a data room (owner only)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDataRoomDto,
  ) {
    return this.dataRoomsService.update(user.clerkUserId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a data room (owner only)' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.dataRoomsService.remove(user.clerkUserId, id);
  }
}
