import { IsUUID } from 'class-validator';

export class MoveFileDto {
  @IsUUID()
  targetFolderId!: string;
}
