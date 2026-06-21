/**
 * ArtifactService
 *
 * Manages lados_artifacts — the project-scoped, versioned key-value store
 * used for inter-workflow data handoff within a project.
 *
 * Design:
 *   - artifact.write node → upsertArtifact() → increments version, appends to lados_artifact_versions
 *   - artifact.read node  → readArtifact()   → returns current value or null
 *   - Emits ArtifactWritten event on every write
 *
 * See docs/LCE_V1/Lados_Core_Engine_V1_Implementation_Blueprint.md §4.10
 *
 * Phase 9 Correction — replaces legacy project_artifacts table.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService }  from '../common/supabase/supabase.service';
import { EventBusService }  from '../event-bus/event-bus.service';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ArtifactRecord {
  id:              string;
  organisation_id: string;
  project_id:      string;
  workflow_id:     string | null;
  run_id:          string | null;
  artifact_key:    string;
  artifact_type:   'json' | 'text' | 'file';
  data:            Record<string, unknown> | null;
  file_url:        string | null;
  version:         number;
  created_by:      string | null;
  created_at:      string;
  updated_at:      string;
}

export interface UpsertArtifactParams {
  organisationId: string;
  projectId:      string;
  key:            string;
  type?:          'json' | 'text' | 'file';
  data?:          Record<string, unknown>;
  fileUrl?:       string;
  workflowId?:    string;
  runId?:         string;
  createdBy?:     string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ArtifactService {
  constructor(
    private readonly supabase:  SupabaseService,
    private readonly eventBus:  EventBusService,
  ) {}

  // ── Read ──────────────────────────────────────────────────────────────────

  async listArtifacts(projectId: string): Promise<ArtifactRecord[]> {
    const { data, error } = await this.supabase.admin
      .from('lados_artifacts')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as ArtifactRecord[];
  }

  async readArtifact(
    projectId: string,
    key: string,
    required = false,
  ): Promise<ArtifactRecord | null> {
    const { data, error } = await this.supabase.admin
      .from('lados_artifacts')
      .select('*')
      .eq('project_id', projectId)
      .eq('artifact_key', key)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data && required) {
      throw new NotFoundException(`Artifact "${key}" not found in project ${projectId}`);
    }
    return data as ArtifactRecord | null;
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  async upsertArtifact(params: UpsertArtifactParams): Promise<ArtifactRecord> {
    const {
      organisationId, projectId, key,
      type = 'json', data, fileUrl,
      workflowId, runId, createdBy,
    } = params;

    // 1. Fetch current record to determine next version
    const existing = await this.readArtifact(projectId, key);
    const nextVersion = (existing?.version ?? 0) + 1;

    // 2. Upsert the live artifact record
    const { data: upserted, error } = await this.supabase.admin
      .from('lados_artifacts')
      .upsert(
        {
          organisation_id: organisationId,
          project_id:      projectId,
          artifact_key:    key,
          artifact_type:   type,
          data:            data ?? null,
          file_url:        fileUrl ?? null,
          workflow_id:     workflowId ?? null,
          run_id:          runId ?? null,
          version:         nextVersion,
          created_by:      existing ? undefined : (createdBy ?? null),
        },
        { onConflict: 'project_id,artifact_key' },
      )
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    const record = upserted as ArtifactRecord;

    // 3. Append immutable version history entry
    await this.supabase.admin
      .from('lados_artifact_versions')
      .insert({
        artifact_id:  record.id,
        project_id:   projectId,
        artifact_key: key,
        version:      nextVersion,
        artifact_type: type,
        data:         data ?? null,
        file_url:     fileUrl ?? null,
        workflow_id:  workflowId ?? null,
        run_id:       runId ?? null,
        written_by:   createdBy ?? null,
      });

    // 4. Emit artifact.written event via EventBus
    // 'event.custom' is the catch-all for non-lifecycle events;
    // the specific event name is carried in payload.eventType.
    await this.eventBus.publish({
      orgId:      organisationId,
      type:       'event.custom',
      sourceType: 'system',
      sourceId:   record.id,
      actorId:    createdBy ?? undefined,
      payload: {
        eventType:  'artifact.written',
        artifactId: record.id,
        projectId,
        key,
        version:    nextVersion,
        artifactType: type,
        workflowId: workflowId ?? null,
        runId:      runId ?? null,
      },
    });

    return record;
  }

  // ── Legacy compatibility (old project.save_artifact / project.read_artifact nodes) ──
  // These remain so old workflows that used the legacy node types don't break.
  // Deprecated: use upsertArtifact / readArtifact instead.

  async upsert(
    projectId: string,
    key: string,
    value: Record<string, unknown>,
    meta?: { sourceWorkflowId?: string; executionRunId?: string; organisationId?: string },
  ): Promise<ArtifactRecord> {
    return this.upsertArtifact({
      organisationId: meta?.organisationId ?? 'unknown',
      projectId,
      key,
      type:       'json',
      data:       value,
      workflowId: meta?.sourceWorkflowId,
      runId:      meta?.executionRunId,
    });
  }

  async get(projectId: string, key: string): Promise<ArtifactRecord> {
    const record = await this.readArtifact(projectId, key, true);
    return record!;
  }

  async list(projectId: string): Promise<ArtifactRecord[]> {
    return this.listArtifacts(projectId);
  }
}
