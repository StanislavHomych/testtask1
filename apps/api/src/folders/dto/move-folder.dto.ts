import { IsUUID } from 'class-validator';

export class MoveFolderDto {
  @IsUUID()
  targetParentId!: string;
}
