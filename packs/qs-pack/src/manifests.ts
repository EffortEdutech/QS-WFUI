/**
 * @lados/qs-pack — NodeManifestV2 declarations (Phase 1F)
 */

import type { NodeManifestV2 } from '@lados/node-sdk';

// ── qs.read_boq ───────────────────────────────────────────────────────────────

export const qsReadBoqManifest: NodeManifestV2 = {
  type:        'qs.read_boq',
  name:        'Read BOQ',
  version:     '1.0.0',
  description: 'Converts parsed Excel rows from document.read_excel into a structured BOQ document with item number, description, unit, quantity, rate, and amount.',
  category:    'qs',
  packId:      'qs-pack',
  tags:        ['qs', 'boq', 'parse', 'excel'],
  inputs: [
    { id: 'rows',          name: 'Rows',           dataType: 'array',  required: true  },
    { id: 'headers',       name: 'Headers',        dataType: 'array',  required: false },
    { id: 'sheetName',     name: 'Sheet Name',     dataType: 'string', required: false },
    { id: 'source_file_id', name: 'Source File ID', dataType: 'string', required: false },
    { id: 'currency',      name: 'Currency',       dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'boq',         name: 'BOQ',         dataType: 'boq'    },
    { id: 'currency',    name: 'Currency',    dataType: 'string' },
    { id: 'sections',    name: 'Sections',    dataType: 'array'  },
    { id: 'total_items', name: 'Total Items', dataType: 'number' },
    { id: 'total_value', name: 'Total Value', dataType: 'number' },
  ],
  config: [
    { key: 'col_item_no',     label: 'Item No Column',     type: 'string', required: false, description: 'Column letter (A) or key name.' },
    { key: 'col_description', label: 'Description Column', type: 'string', required: false },
    { key: 'col_unit',        label: 'Unit Column',        type: 'string', required: false },
    { key: 'col_qty',         label: 'Quantity Column',    type: 'string', required: false },
    { key: 'col_rate',        label: 'Rate Column',        type: 'string', required: false },
    { key: 'col_amount',      label: 'Amount Column',      type: 'string', required: false },
    { key: 'currency',        label: 'Currency',           type: 'string', required: false, defaultValue: 'MYR' },
  ],
};

// ── qs.clean_boq ──────────────────────────────────────────────────────────────

export const qsCleanBoqManifest: NodeManifestV2 = {
  type:        'qs.clean_boq',
  name:        'Clean BOQ',
  version:     '1.0.0',
  description: 'Normalises BOQ items — removes zero-quantity lines, trims whitespace, and passes the cleaned BOQ downstream.',
  category:    'qs',
  packId:      'qs-pack',
  tags:        ['qs', 'boq', 'clean', 'normalise'],
  inputs: [
    { id: 'boq',      name: 'BOQ',      dataType: 'boq',   required: true  },
    { id: 'currency', name: 'Currency', dataType: 'string', required: false },
    { id: 'sections', name: 'Sections', dataType: 'array',  required: false },
  ],
  outputs: [
    { id: 'boq',           name: 'BOQ',           dataType: 'boq'    },
    { id: 'removed_count', name: 'Removed Count', dataType: 'number' },
    { id: 'item_count',    name: 'Item Count',    dataType: 'number' },
  ],
  config: [
    { key: 'remove_zero_qty',    label: 'Remove Zero Qty',    type: 'boolean', required: false, defaultValue: true },
    { key: 'trim_descriptions',  label: 'Trim Descriptions',  type: 'boolean', required: false, defaultValue: true },
  ],
};

// ── qs.classify_trade ─────────────────────────────────────────────────────────

export const qsClassifyTradeManifest: NodeManifestV2 = {
  type:        'qs.classify_trade',
  name:        'Classify Trade',
  version:     '1.0.0',
  description: 'Classifies BOQ items into CIDB trade categories using AI when configured, or built-in keyword matching. AI guardrail: results are advisory only.',
  category:    'qs',
  packId:      'qs-pack',
  tags:        ['qs', 'classify', 'trade', 'ai', 'boq'],
  inputs: [
    { id: 'boq',      name: 'BOQ',      dataType: 'boq',    required: true  },
    { id: 'currency', name: 'Currency', dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'classified_items',   name: 'Classified Items',    dataType: 'array'  },
    { id: 'trade_summary',      name: 'Trade Summary',       dataType: 'object' },
    { id: 'unclassified_count', name: 'Unclassified Count',  dataType: 'number' },
    { id: 'currency',           name: 'Currency',            dataType: 'string' },
  ],
  config: [
    { key: 'use_ai', label: 'Use AI', type: 'boolean', required: false, defaultValue: true, description: 'Falls back to keyword classifier if AI is unavailable.' },
  ],
};

// ── qs.split_work_package ─────────────────────────────────────────────────────

export const qsSplitWorkPackageManifest: NodeManifestV2 = {
  type:        'qs.split_work_package',
  name:        'Split Work Package',
  version:     '1.0.0',
  description: 'Groups classified BOQ items by trade into discrete work packages ready for individual RFQ generation.',
  category:    'qs',
  packId:      'qs-pack',
  tags:        ['qs', 'work-package', 'split', 'procurement'],
  inputs: [
    { id: 'classified_items', name: 'Classified Items', dataType: 'array',  required: true  },
    { id: 'currency',         name: 'Currency',         dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'work_packages',  name: 'Work Packages',  dataType: 'array'  },
    { id: 'package_count',  name: 'Package Count',  dataType: 'number' },
  ],
  config: [
    { key: 'max_items_per_package', label: 'Max Items Per Package', type: 'number', required: false, defaultValue: 50 },
  ],
};

// ── Collected manifest array ──────────────────────────────────────────────────

export const nodeManifests: NodeManifestV2[] = [
  qsReadBoqManifest,
  qsCleanBoqManifest,
  qsClassifyTradeManifest,
  qsSplitWorkPackageManifest,
];
