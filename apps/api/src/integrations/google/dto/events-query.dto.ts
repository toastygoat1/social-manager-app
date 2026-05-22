import { IsDateString } from 'class-validator';

export class EventsQueryDto {
  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;
}
