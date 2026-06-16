/**
 * FileService
 *
 * Handles file uploads to Supabase Storage and metadata persistence.
 * Sprint 7 (S7-003)
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

const BUCKET = 'workflow-uploads';

export interface UploadResult {
  fileId: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string | null;
}

@Injectable()
export class FileService {
  constructor(private readonly supabase: SupabaseService) {}

  async uploadFile(
    file: Express.Multer.File,
    organizationId: string,
    userId: string,
    projectId?: string,
    workflowId?: string,
  ): Promise<UploadResult> {
    if (!file) throw new BadRequestException('No file provided');

    // Build storage path: org/project/timestamp_filename
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = [
      organizationId,
      projectId ?? 'general',
      `${timestamp}_${safeName}`,
    ].join('/');

    // Upload to Supabase Storage
    const { error: storageErr } = await this.supabase.admin.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (storageErr) {
      throw new BadRequestException(`Storage upload failed: ${storageErr.message}`);
    }

    // Persist metadata to uploads table
    const { data: upload, error: dbErr } = await this.supabase.admin
      .from('uploads')
      .insert({
        organization_id: organizationId,
        project_id: projectId ?? null,
        workflow_id: workflowId ?? null,
        original_name: file.originalname,
        storage_path: storagePath,
        bucket: BUCKET,
        mime_type: file.mimetype,
        size_bytes: file.size,
        status: 'ready',
        uploaded_by: userId,
      })
      .select('id')
      .single();

    if (dbErr ?? !upload) {
      // Best-effort cleanup of storage
      await this.supabase.admin.storage.from(BUCKET).remove([storagePath]);
      throw new BadRequestException(`Failed to record upload: ${dbErr?.message}`);
    }

    return {
      fileId: upload.id as string,
      originalName: file.originalname,
      storagePath,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      publicUrl: null, // bucket is private — use signed URL when needed
    };
  }

  /** Download file bytes from storage — used by real node implementations */
  async downloadFile(storagePath: string): Promise<Buffer> {
    const { data, error } = await this.supabase.admin.storage
      .from(BUCKET)
      .download(storagePath);

    if (error ?? !data) {
      throw new BadRequestException(`Failed to download file: ${error?.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  /** Get upload metadata by ID */
  async getUpload(fileId: string) {
    const { data, error } = await this.supabase.admin
      .from('uploads')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error ?? !data) throw new BadRequestException(`Upload ${fileId} not found`);
    return data;
  }
}
