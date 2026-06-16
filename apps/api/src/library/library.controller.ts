/**
 * LibraryController
 *
 * POST   /library            — upload file to project library
 * GET    /library            — list files (?organizationId=&projectId=&category=)
 * GET    /library/:id        — get single file metadata
 * DELETE /library/:id        — soft-delete
 * Sprint 8 (S8-002)
 */
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseJwtGuard as JwtAuthGuard } from '../common/guards/supabase-jwt.guard';
import { LibraryService, LibraryCategory } from './library.service';

const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/pdf',
  'application/octet-stream',
]);

const VALID_CATEGORIES = new Set<LibraryCategory>(['boq', 'spec', 'drawing', 'schedule', 'other']);

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  /**
   * POST /library
   * multipart/form-data fields:
   *   file           — the document
   *   organizationId — required (query param)
   *   label          — required (query param) — human name for the file
   *   category       — optional (query param): boq | spec | drawing | schedule | other
   *   projectId      — optional (query param)
   */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('organizationId') organizationId: string,
    @Query('label') label: string,
    @Query('category') category?: string,
    @Query('projectId') projectId?: string,
    @Request() req?: { user: { id: string } },
  ) {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    if (!label?.trim()) throw new BadRequestException('label is required');
    if (!file) throw new BadRequestException('No file attached — use field name "file"');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`File type "${file.mimetype}" not allowed`);
    }

    const cat: LibraryCategory = VALID_CATEGORIES.has(category as LibraryCategory)
      ? (category as LibraryCategory)
      : 'other';

    const result = await this.libraryService.uploadFile(
      file,
      organizationId,
      req!.user.id,
      label.trim(),
      cat,
      projectId,
    );

    return { success: true, data: result };
  }

  /**
   * GET /library
   * Query: organizationId (required), projectId (optional), category (optional)
   */
  @Get()
  async list(
    @Query('organizationId') organizationId: string,
    @Query('projectId') projectId?: string,
    @Query('category') category?: string,
  ) {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    const files = await this.libraryService.listFiles(organizationId, projectId, category);
    return { success: true, data: files };
  }

  /** GET /library/:id */
  @Get(':id')
  async getOne(@Param('id') id: string) {
    const file = await this.libraryService.getFile(id);
    return { success: true, data: file };
  }

  /** DELETE /library/:id */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    await this.libraryService.deleteFile(id, req.user.id);
    return { success: true };
  }
}
