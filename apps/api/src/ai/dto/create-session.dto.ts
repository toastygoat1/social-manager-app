import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsOptional()
  @IsUUID('4')
  accountId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;
}
