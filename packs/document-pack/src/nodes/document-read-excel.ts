/**
 * Real implementation: document.read_excel
 *
 * Downloads the uploaded .xlsx from Supabase Storage then delegates
 * parsing to DocumentService (S14-001).
 *
 * Sprint 7  (S7-004): initial implementation
 * Sprint 8  (S8-003): library_file_id support
 * Sprint 14 (S14-001): parsing delegated to DocumentService
 * Phase 2: migrated from apps/api/src/execution/real-nodes/ to document-pack
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import * as XLSX from 'xlsx';

// ── Local service interfaces (NestJS services satisfy these via duck typing) ──

export type ExcelRow = Record<string, string | number | boolean | null | undefined> & { row?: number };

export interface IFileService {
  getUpload(fileId: string): Promise<{ storage_path: string }>;
  downloadFile(storagePath: string): Promise<Buffer>;
}

export interface ILibraryService {
  getFile(fileId: string): Promise<{ storage_path: string }>;
  downloadFile(storagePath: string): Promise<Buffer>;
}

export interface IDocumentService {
  parseExcel(
    buffer: Buffer,
    options?: { headerRow?: number | string; sheetName?: string },
  ): {
    sheetName: string;
    sheets: string[];
    headers: string[];
    rows: ExcelRow[];
    rowCount: number;
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function realReadExcel(
  ctx: NodeContext,
  fileService: IFileService,
  libraryService?: ILibraryService,
  documentService?: IDocumentService,
): Promise<NodeExecuteResult> {
  // ── Resolve file source ───────────────────────────────────────────────────
  // Priority:
  //   1. config.library_file_id — design-time library selection (S8)
  //   2. inputs.file_id         — runtime upload (legacy flow)
  //   3. config.file_id         — static config fallback

  const libraryFileId = ctx.config['library_file_id'] as string | undefined;
  const fileId = (ctx.inputs['file_id'] ?? ctx.config['file_id']) as string | undefined;

  let fileBuffer: Buffer;

  if (libraryFileId && libraryService) {
    ctx.logger.info(`Reading from library file: ${libraryFileId}`);
    let storagePath: string;
    try {
      const libFile = await libraryService.getFile(libraryFileId);
      storagePath = libFile.storage_path;
    } catch (err: unknown) {
      return {
        status: 'failure', outputs: {}, logs: [],
        error: {
          code: 'LIBRARY_FILE_NOT_FOUND',
          message: err instanceof Error ? err.message : 'Library file not found',
        },
      };
    }
    try {
      fileBuffer = await libraryService.downloadFile(storagePath);
      ctx.logger.info(`Downloaded ${fileBuffer.length} bytes`);
    } catch (err: unknown) {
      return {
        status: 'failure', outputs: {}, logs: [],
        error: {
          code: 'DOWNLOAD_FAILED',
          message: err instanceof Error ? err.message : 'Download failed',
        },
      };
    }
  } else if (fileId) {
    ctx.logger.info(`Fetching upload record: ${fileId}`);
    let storagePath: string;
    try {
      const upload = await fileService.getUpload(fileId);
      storagePath = upload.storage_path as string;
    } catch (err: unknown) {
      return {
        status: 'failure', outputs: {}, logs: [],
        error: {
          code: 'UPLOAD_NOT_FOUND',
          message: err instanceof Error ? err.message : 'Upload not found',
        },
      };
    }
    try {
      fileBuffer = await fileService.downloadFile(storagePath);
      ctx.logger.info(`Downloaded ${fileBuffer.length} bytes`);
    } catch (err: unknown) {
      return {
        status: 'failure', outputs: {}, logs: [],
        error: {
          code: 'DOWNLOAD_FAILED',
          message: err instanceof Error ? err.message : 'Download failed',
        },
      };
    }
  } else {
    return {
      status: 'failure', outputs: {}, logs: [],
      error: {
        code: 'NO_FILE_ID',
        message: 'No file source provided. Set library_file_id in config or connect an upload node.',
      },
    };
  }

  // ── Parse via DocumentService or inline fallback ──────────────────────────
  ctx.logger.info('Parsing Excel file...');
  try {
    const result = documentService
      ? documentService.parseExcel(fileBuffer, {
          headerRow: ctx.config['header_row'] as number | string | undefined,
          sheetName: ctx.config['sheet_name'] as string | undefined,
        })
      : fallbackParseExcel(fileBuffer, ctx);

    ctx.logger.info(`Parsed ${result.rowCount} rows from sheet "${result.sheetName}"`);

    return {
      status: 'success',
      outputs: {
        file_id:    fileId,
        sheet_name: result.sheetName,
        sheets:     result.sheets,
        headers:    result.headers,
        row_count:  result.rowCount,
        rows:       result.rows,
      },
      logs: [],
      summary: `Read ${result.rowCount} rows from sheet "${result.sheetName}"`,
    };
  } catch (err: unknown) {
    return {
      status: 'failure', outputs: {}, logs: [],
      error: {
        code: 'PARSE_FAILED',
        message: err instanceof Error ? err.message : 'Could not parse Excel file',
      },
    };
  }
}

// ── Inline fallback (used when DocumentService not injected) ──────────────────

function fallbackParseExcel(buffer: Buffer, ctx: NodeContext) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName =
    (ctx.config['sheet_name'] as string | undefined) ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName ?? ''];
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

  const raw: (string | number | boolean | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1, defval: null, blankrows: false,
  }) as (string | number | boolean | null)[][];

  const headerRowRaw = ctx.config['header_row'];
  const headerRowNum = Number(headerRowRaw);
  const headerRowIndex =
    headerRowRaw !== undefined && headerRowRaw !== null && headerRowRaw !== '' && headerRowNum > 0
      ? headerRowNum - 1
      : raw.findIndex((row) => row.filter(Boolean).length >= 3);

  if (headerRowIndex < 0) throw new Error('Could not find header row');

  const headers = (raw[headerRowIndex] ?? []).map((h) =>
    String(h ?? '').trim().toLowerCase().replace(/\s+/g, '_'),
  );
  const rows: ExcelRow[] = [];
  for (let i = headerRowIndex + 1; i < raw.length; i++) {
    const rowData = raw[i];
    if (!rowData || rowData.every((v) => v === null || v === '')) continue;
    const obj: ExcelRow = { row: i + 1 };
    headers.forEach((h, colIdx) => { if (h) obj[h] = rowData[colIdx] ?? null; });
    rows.push(obj);
  }
  return { sheetName: sheetName ?? '', sheets: workbook.SheetNames, headers, rows, rowCount: rows.length };
}
