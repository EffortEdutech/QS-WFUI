import { IsOptional, IsObject } from 'class-validator';

export class TriggerRunDto {
  @IsOptional()
  @IsObject()
  inputs?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
