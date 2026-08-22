import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @SkipThrottle({ default: true, strict: true })
  @ApiOperation({ summary: 'API info' })
  @ApiOkResponse({ description: 'Basic service metadata' })
  getInfo() {
    return this.appService.getInfo();
  }

  @Get('health')
  @SkipThrottle({ default: true, strict: true })
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({ description: 'Database connectivity check' })
  getHealth() {
    return this.appService.getHealth();
  }
}
