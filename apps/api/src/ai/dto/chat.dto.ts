import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;
}
