/**
 * Resource DTOs — Phase 3
 */
import {
  IsString, IsOptional, IsIn, IsObject, IsUUID,
  MinLength, MaxLength,
} from 'class-validator';

const RESOURCE_TYPES = [
  // Core types (Phase 3)
  'job', 'fleet', 'worker', 'material', 'site',
  // Phase 5 additions
  'trip', 'invoice', 'payment',
  // Phase 9 M1 — Contractor Edition
  'customer', 'driver', 'vehicle', 'equipment',
  'fuel_receipt', 'maintenance_record', 'expense',
  // Phase 9 M3 — operators
  'operator',
  // Phase 9 M4 — payroll
  'payroll_run',
  // escape hatch
  'custom',
] as const;

export class CreateResourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsIn(RESOURCE_TYPES)
  type!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class TransitionStateDto {
  @IsString()
  @MinLength(1)
  toState!: string;
}

export class ListResourcesDto {
  // organizationId is passed as a query param by the frontend but handled separately
  // via @Query('organizationId') — must be declared here to pass forbidNonWhitelisted
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsIn(RESOURCE_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
