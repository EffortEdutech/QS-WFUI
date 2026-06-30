import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class GenerateWorkflowDto {
  /** Plain-English (or Bahasa Melayu) description of what the workflow should do. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}
