import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

function trimMessageText(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class SendDmMessageDto {
  @Transform(({ value }: { value: unknown }) => trimMessageText(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  messageText!: string;
}
