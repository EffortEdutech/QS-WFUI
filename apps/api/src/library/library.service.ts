/**
 * LibraryService
 *
 * Manages the Project Document Library — files uploaded once and
 * referenced by nodes via library_file_id in config.
 * Sprint 8 (S8-002)
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

const BUCKET = 'workflow-uploads';

export type LibraryCategory = 'boq' | 'spec' | 'drawing' | 'schedule' | 'other';

export interface LibraryFile {
  id: string;
  organization_id: string;
  project_id: string | null;
  label: string;
  category: LibraryCategory;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

export interface UploadToLibraryResult {
  id: string;
  label: string;
  category: LibraryCategory;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

@Injectable()
export class LibraryService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Upload a file to the library */
  async uploadFile(
    file: Express.Multer.File,
    organizationId: string,
    userId: string,
    label: string,
    category: LibraryCategory = 'other',
    projectId?: string,
  ): Promise<UploadToLibraryResult> {
    if (!file) throw new BadRequestException('No file provided');

    // Store under library/ prefix to distinguish from run-time uploads
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = ['library', organizationId, `${timestamp}_${safeName}`].join('/');

    const { error: storageErr } = await this.supabase.admin.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (storageErr) {
      throw new BadRequestException(`Storage upload failed: ${storageErr.message}`);
    }

    const { data, error: dbErr } = await this.supabase.admin
      .from('project_files')
      .insert({
        organization_id: organizationId,
        project_id: projectId ?? null,
        label,
        category,
        original_name: file.originalname,
        storage_path: storagePath,
        mime_type: file.mimetype,
        size_bytes: file.size,
        uploaded_by: userId,
      })
      .select('id, label, category, original_name, storage_path, mime_type, size_bytes, created_at')
      .single();

    if (dbErr ?? !data) {
      await this.supabase.admin.storage.from(BUCKET).remove([storagePath]);
      throw new BadRequestException(`Failed to record library file: ${dbErr?.message}`);
    }

    return data as UploadToLibraryResult;
  }

  /** List library files for an org (optionally filtered by project / category) */
  async listFiles(
    organizationId: string,
    projectId?: string,
    category?: string,
  ): Promise<LibraryFile[]> {
    let query = this.supabase.admin
      .from('project_files')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (projectId) query = query.eq('project_id', projectId);
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as LibraryFile[];
  }

  /** Get a single library file by ID */
  async getFile(fileId: string): Promise<LibraryFile> {
    const { data, error } = await this.supabase.admin
      .from('project_files')
      .select('*')
      .eq('id', fileId)
      .is('deleted_at', null)
      .single();

    if (error ?? !data) throw new NotFoundException(`Library file ${fileId} not found`);
    return data as LibraryFile;
  }

  /** Soft-delete a library file */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('project_files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', fileId)
      .eq('uploaded_by', userId);

    if (error) throw new BadRequestException(error.message);
  }

  /** Download file bytes — used by document.read_excel real node */
  async downloadFile(storagePath: string): Promise<Buffer> {
    const { data, error } = await this.supabase.admin.storage
      .from(BUCKET)
      .download(storagePath);

    if (error ?? !data) {
      throw new BadRequestException(`Failed to download library file: ${error?.message}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }
}
