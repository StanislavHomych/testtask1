import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVersionUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52_428_800)
  size!: number;
}

export class CompleteVersionUploadDto {
  @IsString()
  @IsNotEmpty()
  stagingKey!: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52_428_800)
  size!: number;
}
