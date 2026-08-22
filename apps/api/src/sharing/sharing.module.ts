import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { SharedPublicController } from './shared-public.controller';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [SharingController, SharedPublicController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
