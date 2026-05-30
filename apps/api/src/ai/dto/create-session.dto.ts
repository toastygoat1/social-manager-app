import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsString()
  @IsOptional()
  title?: string;
}
