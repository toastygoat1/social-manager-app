import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWorkspaceFolderDto {
  @IsString()
  @MaxLength(80)
  name!: string;
}

export class UpdateWorkspaceFolderDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}
