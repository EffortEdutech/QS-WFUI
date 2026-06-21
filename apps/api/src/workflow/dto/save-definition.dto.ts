import { IsObject, IsNotEmpty } from 'class-validator';

/**
 * Payload for PUT /workflows/:id/definition
 * The definition field holds the full Workflow JSON object.
 * Validated by @lados/workflow-json before writing to DB.
 */
export class SaveDefinitionDto {
  @IsObject()
  @IsNotEmpty()
  definition!: Record<string, unknown>;
}
