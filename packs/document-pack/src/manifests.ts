/**
 * @lados/document-pack — NodeManifestV2 declarations (Phase 1F)
 */

import type { NodeManifestV2 } from '@lados/node-sdk';

// ── document.upload_file ──────────────────────────────────────────────────────

export const documentUploadFileManifest: NodeManifestV2 = {
  type:        'document.upload_file',
  name:        'Upload File',
  version:     '1.0.0',
  description: 'Pass-through node that forwards a runtime file_id to downstream nodes.',
  category:    'document',
  packId:      'document-pack',
  tags:        ['document', 'upload', 'file'],
  inputs:  [{ id: 'file_id', name: 'File ID', dataType: 'string', required: false }],
  outputs: [{ id: 'file_id', name: 'File ID', dataType: 'string' }],
  config:  [{ key: 'file_id', label: 'File ID', type: 'string', required: false, description: 'Static fallback file ID (rarely used).' }],
  inputSchema: [
    { key: 'file_id', label: 'File', type: 'file', required: false, description: 'Upload a file before running the workflow.' },
  ],
};

// ── document.read_excel ───────────────────────────────────────────────────────

export const documentReadExcelManifest: NodeManifestV2 = {
  type:        'document.read_excel',
  name:        'Read Excel',
  version:     '1.0.0',
  description: 'Parses an uploaded .xlsx file and returns structured rows, headers, and sheet metadata.',
  category:    'document',
  packId:      'document-pack',
  tags:        ['document', 'excel', 'xlsx', 'parse'],
  inputs:  [{ id: 'file_id', name: 'File ID', dataType: 'string', required: false }],
  outputs: [
    { id: 'sheetName', name: 'Sheet Name', dataType: 'string' },
    { id: 'sheets',    name: 'Sheets',     dataType: 'array'  },
    { id: 'headers',   name: 'Headers',    dataType: 'array'  },
    { id: 'rows',      name: 'Rows',       dataType: 'array'  },
    { id: 'rowCount',  name: 'Row Count',  dataType: 'number' },
  ],
  config: [
    { key: 'library_file_id', label: 'Library File ID', type: 'string', required: false, description: 'Design-time library selection overrides runtime file_id.' },
    { key: 'file_id',         label: 'File ID',         type: 'string', required: false },
    { key: 'header_row',      label: 'Header Row',      type: 'number', required: false, defaultValue: 1 },
    { key: 'sheet_name',      label: 'Sheet Name',      type: 'string', required: false, description: 'Sheet to read; defaults to first sheet.' },
  ],
};

// ── Collected manifest array ──────────────────────────────────────────────────

export const nodeManifests: NodeManifestV2[] = [
  documentUploadFileManifest,
  documentReadExcelManifest,
];
