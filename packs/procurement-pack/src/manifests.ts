/**
 * @lados/procurement-pack — NodeManifestV2 declarations (Phase 1F)
 */

import type { NodeManifestV2 } from '@lados/node-sdk';

// ── procurement.generate_rfq ──────────────────────────────────────────────────

export const procurementGenerateRfqManifest: NodeManifestV2 = {
  type:        'procurement.generate_rfq',
  name:        'Generate RFQ',
  version:     '1.0.0',
  description: 'Generates Request for Quotation DOCX files for each trade work package and uploads to Supabase Storage. AI guardrail: produces a draft for human review only.',
  category:    'procurement',
  packId:      'procurement-pack',
  tags:        ['procurement', 'rfq', 'document', 'docx'],
  inputs: [
    { id: 'work_packages', name: 'Work Packages', dataType: 'array',  required: true  },
    { id: 'project_name',  name: 'Project Name',  dataType: 'string', required: false },
    { id: 'project_ref',   name: 'Project Ref',   dataType: 'string', required: false },
    { id: 'deadline_date', name: 'Deadline Date',  dataType: 'string', required: false },
    { id: 'currency',      name: 'Currency',       dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'rfq_artifacts', name: 'RFQ Artifacts', dataType: 'array'  },
    { id: 'rfq_count',     name: 'RFQ Count',     dataType: 'number' },
  ],
  config: [
    { key: 'project_name',  label: 'Project Name',  type: 'string', required: false },
    { key: 'project_ref',   label: 'Project Ref',   type: 'string', required: false },
    { key: 'deadline_date', label: 'Deadline Date',  type: 'string', required: false, description: 'ISO 8601 date.' },
    { key: 'currency',      label: 'Currency',       type: 'string', required: false, defaultValue: 'MYR' },
  ],
};

// ── procurement.generate_po ───────────────────────────────────────────────────

export const procurementGeneratePoManifest: NodeManifestV2 = {
  type:        'procurement.generate_po',
  name:        'Generate PO',
  version:     '1.0.0',
  description: 'Generates a Purchase Order DOCX for an awarded trade package and uploads to Supabase Storage. Draft for human review — does not constitute a binding contract until signed.',
  category:    'procurement',
  packId:      'procurement-pack',
  tags:        ['procurement', 'po', 'purchase-order', 'document', 'docx'],
  inputs: [
    { id: 'trade',        name: 'Trade',        dataType: 'string', required: true  },
    { id: 'line_items',   name: 'Line Items',   dataType: 'array',  required: true  },
    { id: 'supplier',     name: 'Supplier',     dataType: 'object', required: false },
    { id: 'project_name', name: 'Project Name', dataType: 'string', required: false },
    { id: 'project_ref',  name: 'Project Ref',  dataType: 'string', required: false },
    { id: 'currency',     name: 'Currency',     dataType: 'string', required: false },
    { id: 'po_reference', name: 'PO Reference', dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'po_artifact', name: 'PO Artifact', dataType: 'object' },
  ],
  config: [
    { key: 'project_name', label: 'Project Name', type: 'string', required: false },
    { key: 'project_ref',  label: 'Project Ref',  type: 'string', required: false },
    { key: 'currency',     label: 'Currency',     type: 'string', required: false, defaultValue: 'MYR' },
  ],
};

// ── Collected manifest array ──────────────────────────────────────────────────

export const nodeManifests: NodeManifestV2[] = [
  procurementGenerateRfqManifest,
  procurementGeneratePoManifest,
];
