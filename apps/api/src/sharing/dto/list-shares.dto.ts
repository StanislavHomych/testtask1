import { IsEnum, IsUUID } from 'class-validator';
import { ResourceType } from '../../../generated/prisma/client';

export class ListSharesDto {
  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @IsUUID()
  resourceId!: string;
}
