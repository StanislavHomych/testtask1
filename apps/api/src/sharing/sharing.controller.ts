import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { CreateShareDto } from './dto/create-share.dto';
import { ListSharesDto } from './dto/list-shares.dto';
import { SharingService } from './sharing.service';

@ApiTags('shares')
@ApiBearerAuth('clerk')
@Controller('shares')
@UseGuards(ClerkAuthGuard)
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a user or public share (VIEWER for MVP)',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateShareDto) {
    return this.sharingService.create(user.clerkUserId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List shares for a resource' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListSharesDto) {
    return this.sharingService.list(user.clerkUserId, query);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a share' })
  @ApiNoContentResponse()
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.sharingService.revoke(user.clerkUserId, id);
  }
}
