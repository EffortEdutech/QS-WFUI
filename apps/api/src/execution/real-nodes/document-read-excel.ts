/**
 * Real implementation: document.read_excel
 *
 * Downloads the uploaded .xlsx from Supabase Storage,
 * parses it with SheetJS, and returns structured row data.
 * Sprint 7 (S7-004)
 */
import * as XLSX from 'xlsx';
import type { NodeContext, NodeExecuteResult } from '@qsos/node-sdk';
import type { FileService } from '../../file/file.service';

export interface ExcelRow {
  row: number;
  [col: string]: string | number | boolean | null;
}

export async function realReadExcel(
  ctx: NodeContext,
  fileService: FileService,
): Promise<NodeExecuteResult> {
  const fileId = (ctx.inputs['file_id'] ?? ctx.config['file_id']) as string | undefined;

  if (!fileId) {
    return {
      status: 'failed',
      outputs: {},
      logs: [],
      error: { code: 'NO_FILE_ID', message: 'No file_id provided in inputs or config' },
    };
  }

  ctx.logger.info(`Fetching upload record: ${fileId}`);

  // Get upload metadata
  let storagePath: string;
  try {
    const upload = await fileService.getUpload(fileId);
    storagePath = upload.storage_path as string;
    ctx.logger.info(`Storage path: ${storagePath}`);
  } catch (err: unknown) {
    return {
      status: 'failed',
      outputs: {},
      logs: [],
      error: {
        code: 'UPLOAD_NOT_FOUND',
        message: err instanceof Error ? err.message : 'Upload not found',
      },
    };
  }

  // Download file bytes
  ctx.logger.info('Downloading file from storage...');
  let fileBuffer: Buffer;
  try {
    fileBuffer = await fileService.downloadFile(storagePath);
    ctx.logger.info(`Downloaded ${fileBuffer.length} bytes`);
  } catch (err: unknown) {
    return {
      status: 'failed',
      outputs: {},
      logs: [],
      error: {
        code: 'DOWNLOAD_FAILED',
        message: err instanceof Error ? err.message : 'Download failed',
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
      status: 'failed',
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
      status: 'failed',
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
  const headerRowIndex =
    (ctx.config['header_row'] as number | undefined) !== undefined
      ? Number(ctx.config['header_row']) - 1   // 1-based → 0-based
      : raw.findIndex((row) => row.filter(Boolean).length >= 3);

  if (headerRowIndex < 0) {
    return {
      status: 'failed',
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
    status: 'completed',
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
