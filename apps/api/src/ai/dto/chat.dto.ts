import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ChatDto {
  @IsOptional()
  @IsUUID('4')
  accountId?: string;

  @IsUUID('4')
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;
}
