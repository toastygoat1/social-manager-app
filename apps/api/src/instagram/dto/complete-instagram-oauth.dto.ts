import { IsString, MaxLength } from 'class-validator';

export class CompleteInstagramOAuthDto {
  @IsString()
  @MaxLength(2048)
  code!: string;

  @IsString()
  @MaxLength(2048)
  state!: string;
}
