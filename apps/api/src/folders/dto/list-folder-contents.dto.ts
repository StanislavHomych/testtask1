import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { IsOptional, IsString } from 'class-validator';

export class ListFolderContentsDto extends CursorPaginationDto {
  @IsOptional()
  @IsString()
  foldersCursor?: string;

  @IsOptional()
  @IsString()
  filesCursor?: string;
}
