import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ResourceType } from '../../../generated/prisma/client';

export class CreateShareDto {
  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @IsUUID()
  resourceId!: string;

  @IsIn(['USER', 'PUBLIC'])
  audience!: 'USER' | 'PUBLIC';

  @ValidateIf((dto: CreateShareDto) => dto.audience === 'USER')
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  email?: string;

  @IsOptional()
  @Type(() => String)
  @IsISO8601()
  expiresAt?: string;
}
