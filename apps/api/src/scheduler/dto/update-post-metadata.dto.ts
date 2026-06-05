import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PostMetadataDto } from './post-metadata.dto.js';

export class UpdatePostMetadataDto {
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PostMetadataDto)
  metadata!: PostMetadataDto[];
}
