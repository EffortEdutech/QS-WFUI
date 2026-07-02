import { IsString, IsUUID } from 'class-validator';

export class UpsertBindingDto {
  @IsUUID()
  resourceId!: string;

  @IsString()
  resourceType!: string;
}
