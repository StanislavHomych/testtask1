import { IsOptional } from 'class-validator';

export class CompleteFileUploadDto {
  @IsOptional()
  confirm?: boolean;
}
