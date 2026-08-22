import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ResolvePublicShareQueryDto } from './dto/resolve-public-share.dto';
import { SharingService } from './sharing.service';

@ApiTags('shared')
@Controller('shared')
export class SharedPublicController {
  constructor(private readonly sharingService: SharingService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Resolve a public share token (no auth)',
  })
  @ApiOkResponse({
    description: 'Read-only payload for a shared room, folder, or file',
  })
  resolve(
    @Param('token') token: string,
    @Query() query: ResolvePublicShareQueryDto,
  ) {
    return this.sharingService.resolvePublicToken(token, query.folderId);
  }

  @Get(':token/files/:fileId/view-url')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create a short-lived view URL for a file covered by the token',
  })
  createFileViewUrl(
    @Param('token') token: string,
    @Param('fileId') fileId: string,
  ) {
    return this.sharingService.createPublicFileViewUrl(token, fileId);
  }
}
