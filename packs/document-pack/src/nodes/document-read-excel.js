"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.realReadExcel = realReadExcel;
const XLSX = __importStar(require("xlsx"));
async function realReadExcel(ctx, fileService, libraryService, documentService) {
    const libraryFileId = ctx.config['library_file_id'];
    const fileId = (ctx.inputs['file_id'] ?? ctx.config['file_id']);
    let fileBuffer;
    if (libraryFileId && libraryService) {
        ctx.logger.info(`Reading from library file: ${libraryFileId}`);
        let storagePath;
        try {
            const libFile = await libraryService.getFile(libraryFileId);
            storagePath = libFile.storage_path;
        }
        catch (err) {
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
        }
        catch (err) {
            return {
                status: 'failure', outputs: {}, logs: [],
                error: {
                    code: 'DOWNLOAD_FAILED',
                    message: err instanceof Error ? err.message : 'Download failed',
                },
            };
        }
    }
    else if (fileId) {
        ctx.logger.info(`Fetching upload record: ${fileId}`);
        let storagePath;
        try {
            const upload = await fileService.getUpload(fileId);
            storagePath = upload.storage_path;
        }
        catch (err) {
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
        }
        catch (err) {
            return {
                status: 'failure', outputs: {}, logs: [],
                error: {
                    code: 'DOWNLOAD_FAILED',
                    message: err instanceof Error ? err.message : 'Download failed',
                },
            };
        }
    }
    else {
        return {
            status: 'failure', outputs: {}, logs: [],
            error: {
                code: 'NO_FILE_ID',
                message: 'No file source provided. Set library_file_id in config or connect an upload node.',
            },
        };
    }
    ctx.logger.info('Parsing Excel file...');
    try {
        const result = documentService
            ? documentService.parseExcel(fileBuffer, {
                headerRow: ctx.config['header_row'],
                sheetName: ctx.config['sheet_name'],
            })
            : fallbackParseExcel(fileBuffer, ctx);
        ctx.logger.info(`Parsed ${result.rowCount} rows from sheet "${result.sheetName}"`);
        return {
            status: 'success',
            outputs: {
                file_id: fileId,
                sheet_name: result.sheetName,
                sheets: result.sheets,
                headers: result.headers,
                row_count: result.rowCount,
                rows: result.rows,
            },
            logs: [],
            summary: `Read ${result.rowCount} rows from sheet "${result.sheetName}"`,
        };
    }
    catch (err) {
        return {
            status: 'failure', outputs: {}, logs: [],
            error: {
                code: 'PARSE_FAILED',
                message: err instanceof Error ? err.message : 'Could not parse Excel file',
            },
        };
    }
}
function fallbackParseExcel(buffer, ctx) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = ctx.config['sheet_name'] ?? workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName ?? ''];
    if (!sheet)
        throw new Error(`Sheet "${sheetName}" not found`);
    const raw = XLSX.utils.sheet_to_json(sheet, {
        header: 1, defval: null, blankrows: false,
    });
    const headerRowRaw = ctx.config['header_row'];
    const headerRowNum = Number(headerRowRaw);
    const headerRowIndex = headerRowRaw !== undefined && headerRowRaw !== null && headerRowRaw !== '' && headerRowNum > 0
        ? headerRowNum - 1
        : raw.findIndex((row) => row.filter(Boolean).length >= 3);
    if (headerRowIndex < 0)
        throw new Error('Could not find header row');
    const headers = (raw[headerRowIndex] ?? []).map((h) => String(h ?? '').trim().toLowerCase().replace(/\s+/g, '_'));
    const rows = [];
    for (let i = headerRowIndex + 1; i < raw.length; i++) {
        const rowData = raw[i];
        if (!rowData || rowData.every((v) => v === null || v === ''))
            continue;
        const obj = { row: i + 1 };
        headers.forEach((h, colIdx) => { if (h)
            obj[h] = rowData[colIdx] ?? null; });
        rows.push(obj);
    }
    return { sheetName: sheetName ?? '', sheets: workbook.SheetNames, headers, rows, rowCount: rows.length };
}
//# sourceMappingURL=document-read-excel.js.map