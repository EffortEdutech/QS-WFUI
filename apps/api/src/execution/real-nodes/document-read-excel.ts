/**
 * Real implementation: document.read_excel
 *
 * Downloads the uploaded .xlsx from Supabase Storage,
 * parses it with SheetJS, and returns structured row data.
 * Sprint 7 (S7-004)
 */
import * as XLSX from 'xlsx';
import type { NodeContext, NodeExecuteResult } from '@qsos/execution-engine';
import type { FileService } from '../../file/file.service';
import type { LibraryService } from '../../library/library.service';

export interface ExcelRow {
  row: number;
  [col: string]: string | number | boolean | null;
}

export async function realReadExcel(
  ctx: NodeContext,
  fileService: FileService,
  libraryService?: LibraryService,
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
    // ── Library path ──────────────────────────────────────────────────────
    ctx.logger.info(`Reading from library file: ${libraryFileId}`);
    let storagePath: string;
    try {
      const libFile = await libraryService.getFile(libraryFileId);
      storagePath = libFile.storage_path;
      ctx.logger.info(`Library storage path: ${storagePath}`);
    } catch (err: unknown) {
      return {
        status: 'failure',
        outputs: {},
        logs: [],
        error: {
          code: 'LIBRARY_FILE_NOT_FOUND',
          message: err instanceof Error ? err.message : 'Library file not found',
        },
      };
    }
    ctx.logger.info('Downloading library file from storage...');
    try {
      fileBuffer = await libraryService.downloadFile(storagePath);
      ctx.logger.info(`Downloaded ${fileBuffer.length} bytes`);
    } catch (err: unknown) {
      return {
        status: 'failure',
        outputs: {},
        logs: [],
        error: {
          code: 'DOWNLOAD_FAILED',
          message: err instanceof Error ? err.message : 'Download failed',
        },
      };
    }
  } else if (fileId) {
    // ── Upload path (existing flow) ───────────────────────────────────────
    ctx.logger.info(`Fetching upload record: ${fileId}`);
    let storagePath: string;
    try {
      const upload = await fileService.getUpload(fileId);
      storagePath = upload.storage_path as string;
      ctx.logger.info(`Storage path: ${storagePath}`);
    } catch (err: unknown) {
      return {
        status: 'failure',
        outputs: {},
        logs: [],
        error: {
          code: 'UPLOAD_NOT_FOUND',
          message: err instanceof Error ? err.message : 'Upload not found',
        },
      };
    }
    ctx.logger.info('Downloading file from storage...');
    try {
      fileBuffer = await fileService.downloadFile(storagePath);
      ctx.logger.info(`Downloaded ${fileBuffer.length} bytes`);
    } catch (err: unknown) {
      return {
        status: 'failure',
        outputs: {},
        logs: [],
        error: {
          code: 'DOWNLOAD_FAILED',
          message: err instanceof Error ? err.message : 'Download failed',
        },
      };
    }
  } else {
    return {
      status: 'failure',
      outputs: {},
      logs: [],
      error: {
        code: 'NO_FILE_ID',
        message: 'No file source provided. Set library_file_id in config or connect an upload node.',
      },
    };
  }

  // Parse with SheetJS
  ctx.logger.info('Parsing Excel file...');
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  } catch (err: unknown) {
    return {
      status: 'failure',
      outputs: {},
      logs: [],
      error: {
        code: 'PARSE_FAILED',
        message: err instanceof Error ? err.message : 'Could not parse Excel file',
      },
    };
  }

  const sheetName =
    (ctx.config['sheet_name'] as string | undefined) ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return {
      status: 'failure',
      outputs: {},
      logs: [],
      error: {
        code: 'SHEET_NOT_FOUND',
        message: `Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`,
      },
    };
  }

  // Convert to array of arrays (raw)
  const raw: (string | number | boolean | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  }) as (string | number | boolean | null)[][];

  // Find header row (first row with at least 3 non-empty cells)
  // header_row is 1-based. Only use it when it is a positive integer.
  // Treat 0, null, "", undefined as "auto-detect" so that the PropertyPanel
  // default value of 1 that was shipped in migration 0005 doesn't silently
  // corrupt the parse when users open & re-save the node.
  const headerRowRaw = ctx.config['header_row'];
  const headerRowNum = Number(headerRowRaw);
  const headerRowIndex =
    headerRowRaw !== undefined && headerRowRaw !== null && headerRowRaw !== '' && headerRowNum > 0
      ? headerRowNum - 1   // 1-based → 0-based
      : raw.findIndex((row) => row.filter(Boolean).length >= 3);

  if (headerRowIndex < 0) {
    return {
      status: 'failure',
      outputs: {},
      logs: [],
      error: { code: 'NO_HEADER', message: 'Could not find a header row with ≥3 columns' },
    };
  }

  const headers = raw[headerRowIndex].map((h) =>
    String(h ?? '').trim().toLowerCase().replace(/\s+/g, '_'),
  );

  // Build row objects
  const rows: ExcelRow[] = [];
  for (let i = headerRowIndex + 1; i < raw.length; i++) {
    const rowData = raw[i];
    if (!rowData || rowData.every((v) => v === null || v === '')) continue;

    const obj: ExcelRow = { row: i + 1 };
    headers.forEach((h, colIdx) => {
      if (h) obj[h] = rowData[colIdx] ?? null;
    });
    rows.push(obj);
  }

  ctx.logger.info(`Parsed ${rows.length} data rows from sheet "${sheetName}"`);

  return {
    status: 'success',
    outputs: {
      file_id: fileId,
      sheet_name: sheetName,
      sheets: workbook.SheetNames,
      headers,
      row_count: rows.length,
      rows,
    },
    logs: [],
    summary: `Read ${rows.length} rows from sheet "${sheetName}"`,
  };
}
