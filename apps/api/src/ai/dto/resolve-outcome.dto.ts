import { IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class ResolveOutcomeDto {
  @IsString()
  @IsNotEmpty()
  outcome!: string;

  @IsNumber()
  engagementDelta!: number;

  @IsNumber()
  savesDelta!: number;
}
