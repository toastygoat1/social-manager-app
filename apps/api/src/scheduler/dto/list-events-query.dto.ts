import { IsDateString } from 'class-validator';

export class ListEventsQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
