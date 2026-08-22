import { IsOptional, IsUUID } from 'class-validator';

export class ResolvePublicShareQueryDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;
}
