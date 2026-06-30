/**
 * @lados/construction-pack — NodeManifestV2 declarations (Phase 7)
 */

import type { NodeManifestV2 } from '@lados/node-sdk';

// ── construction.create_project ───────────────────────────────────────────────

export const constructionCreateProjectManifest: NodeManifestV2 = {
  type:        'construction.create_project',
  name:        'Create Construction Project',
  version:     '1.0.0',
  description: 'Creates a new ConstructionProject resource — the master record for all claims, variations, defects, BOQ, and site inspections.',
  category:    'construction',
  packId:      'construction-pack',
  tags:        ['construction', 'project', 'resource'],
  inputs: [
    { id: 'name',           name: 'Project Name',     dataType: 'string', required: true  },
    { id: 'description',    name: 'Description',      dataType: 'string', required: false },
    { id: 'contractValue',  name: 'Contract Value',   dataType: 'number', required: false },
    { id: 'currency',       name: 'Currency',         dataType: 'string', required: false },
    { id: 'startDate',      name: 'Start Date',       dataType: 'string', required: false },
    { id: 'endDate',        name: 'End Date',         dataType: 'string', required: false },
    { id: 'clientName',     name: 'Client Name',      dataType: 'string', required: false },
    { id: 'contractorName', name: 'Contractor Name',  dataType: 'string', required: false },
    { id: 'siteAddress',    name: 'Site Address',     dataType: 'string', required: false },
    { id: 'contractNo',     name: 'Contract No.',     dataType: 'string', required: false },
    { id: 'projectType',    name: 'Project Type',     dataType: 'string', required: false },
    { id: 'projectId',      name: 'Lados Project ID', dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'constructionProjectId',    name: 'Project Resource ID', dataType: 'string' },
    { id: 'constructionProjectState', name: 'Project State',       dataType: 'string' },
    { id: 'constructionProjectName',  name: 'Project Name',        dataType: 'string' },
  ],
  config: [
    { key: 'projectType', label: 'Project Type', type: 'string', required: false, description: 'residential | commercial | industrial | infrastructure' },
    { key: 'currency',    label: 'Currency',      type: 'string', required: false, defaultValue: 'MYR' },
  ],
};

// ── construction.submit_progress_claim ────────────────────────────────────────

export const constructionSubmitProgressClaimManifest: NodeManifestV2 = {
  type:        'construction.submit_progress_claim',
  name:        'Submit Progress Claim',
  version:     '1.0.0',
  description: 'Creates a ProgressClaim resource and submits it for QS assessment. The claim is linked to a ConstructionProject.',
  category:    'construction',
  packId:      'construction-pack',
  tags:        ['construction', 'progress-claim', 'payment', 'resource'],
  inputs: [
    { id: 'projectResourceId', name: 'Project Resource ID',  dataType: 'string', required: true  },
    { id: 'claimNo',           name: 'Claim No.',            dataType: 'string', required: false },
    { id: 'claimPeriodStart',  name: 'Claim Period Start',   dataType: 'string', required: false },
    { id: 'claimPeriodEnd',    name: 'Claim Period End',     dataType: 'string', required: false },
    { id: 'claimAmount',       name: 'Claim Amount (MYR)',   dataType: 'number', required: false },
    { id: 'currency',          name: 'Currency',             dataType: 'string', required: false },
    { id: 'claimItems',        name: 'Claim Items',          dataType: 'array',  required: false },
    { id: 'projectId',         name: 'Lados Project ID',     dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'claimId',     name: 'Claim Resource ID', dataType: 'string' },
    { id: 'claimState',  name: 'Claim State',        dataType: 'string' },
    { id: 'claimNo',     name: 'Claim No.',          dataType: 'string' },
    { id: 'claimAmount', name: 'Claim Amount',       dataType: 'number' },
  ],
  config: [
    { key: 'currency', label: 'Currency', type: 'string', required: false, defaultValue: 'MYR' },
  ],
};

// ── construction.assess_progress_claim ────────────────────────────────────────

export const constructionAssessProgressClaimManifest: NodeManifestV2 = {
  type:        'construction.assess_progress_claim',
  name:        'Assess Progress Claim',
  version:     '1.0.0',
  description: 'QS assessment of a submitted progress claim. Records assessed amount and transitions claim to under_assessment.',
  category:    'construction',
  packId:      'construction-pack',
  tags:        ['construction', 'progress-claim', 'qs', 'assessment'],
  inputs: [
    { id: 'claimId',         name: 'Claim Resource ID',  dataType: 'string', required: true  },
    { id: 'assessedAmount',  name: 'Assessed Amount (MYR)', dataType: 'number', required: true },
    { id: 'assessmentNotes', name: 'Assessment Notes',   dataType: 'string', required: false },
    { id: 'certifiedItems',  name: 'Certified Items',    dataType: 'array',  required: false },
  ],
  outputs: [
    { id: 'claimId',        name: 'Claim Resource ID', dataType: 'string' },
    { id: 'assessedAmount', name: 'Assessed Amount',   dataType: 'number' },
    { id: 'claimState',     name: 'Claim State',       dataType: 'string' },
  ],
  config: [],
};

// ── construction.certify_progress_claim ───────────────────────────────────────

export const constructionCertifyProgressClaimManifest: NodeManifestV2 = {
  type:        'construction.certify_progress_claim',
  name:        'Certify Progress Claim',
  version:     '1.0.0',
  description: 'Issues a Certificate of Payment and transitions claim to certified. ⚠️ AI guardrail: must appear downstream of foundation.request_approval.',
  category:    'construction',
  packId:      'construction-pack',
  tags:        ['construction', 'progress-claim', 'certificate', 'payment', 'approval-required'],
  inputs: [
    { id: 'claimId',              name: 'Claim Resource ID',       dataType: 'string', required: true  },
    { id: 'certifiedAmount',      name: 'Certified Amount (MYR)',  dataType: 'number', required: true  },
    { id: 'certificateNo',        name: 'Certificate No.',         dataType: 'string', required: false },
    { id: 'certificationComments', name: 'Certification Comments', dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'claimId',         name: 'Claim Resource ID', dataType: 'string' },
    { id: 'certifiedAmount', name: 'Certified Amount',  dataType: 'number' },
    { id: 'certificateNo',   name: 'Certificate No.',   dataType: 'string' },
    { id: 'claimState',      name: 'Claim State',       dataType: 'string' },
  ],
  config: [],
};

// ── construction.submit_variation ─────────────────────────────────────────────

export const constructionSubmitVariationManifest: NodeManifestV2 = {
  type:        'construction.submit_variation',
  name:        'Submit Variation',
  version:     '1.0.0',
  description: 'Creates a Variation (VO / contract change order) and submits it for review.',
  category:    'construction',
  packId:      'construction-pack',
  tags:        ['construction', 'variation', 'change-order', 'resource'],
  inputs: [
    { id: 'projectResourceId', name: 'Project Resource ID', dataType: 'string', required: true  },
    { id: 'reason',            name: 'Reason',              dataType: 'string', required: true  },
    { id: 'variationNo',       name: 'Variation No.',       dataType: 'string', required: false },
    { id: 'description',       name: 'Description',         dataType: 'string', required: false },
    { id: 'costImpact',        name: 'Cost Impact (MYR)',   dataType: 'number', required: false },
    { id: 'timeImpact',        name: 'Time Impact (days)',  dataType: 'number', required: false },
    { id: 'currency',          name: 'Currency',            dataType: 'string', required: false },
    { id: 'supportingDocs',    name: 'Supporting Docs',     dataType: 'array',  required: false },
    { id: 'projectId',         name: 'Lados Project ID',    dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'variationId',    name: 'Variation Resource ID', dataType: 'string' },
    { id: 'variationState', name: 'Variation State',       dataType: 'string' },
    { id: 'variationNo',    name: 'Variation No.',         dataType: 'string' },
    { id: 'costImpact',     name: 'Cost Impact',           dataType: 'number' },
  ],
  config: [
    { key: 'currency', label: 'Currency', type: 'string', required: false, defaultValue: 'MYR' },
  ],
};

// ── construction.approve_variation ────────────────────────────────────────────

export const constructionApproveVariationManifest: NodeManifestV2 = {
  type:        'construction.approve_variation',
  name:        'Approve Variation',
  version:     '1.0.0',
  description: 'Approves a submitted Variation. ⚠️ AI guardrail: must appear downstream of foundation.request_approval.',
  category:    'construction',
  packId:      'construction-pack',
  tags:        ['construction', 'variation', 'approval', 'approval-required'],
  inputs: [
    { id: 'variationId',      name: 'Variation Resource ID', dataType: 'string', required: true  },
    { id: 'approvedAmount',   name: 'Approved Amount (MYR)', dataType: 'number', required: false },
    { id: 'timeExtension',    name: 'Time Extension (days)', dataType: 'number', required: false },
    { id: 'approvalComments', name: 'Approval Comments',     dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'variationId',    name: 'Variation Resource ID', dataType: 'string' },
    { id: 'approvedAmount', name: 'Approved Amount',       dataType: 'number' },
    { id: 'timeExtension',  name: 'Time Extension',        dataType: 'number' },
    { id: 'variationState', name: 'Variation State',       dataType: 'string' },
  ],
  config: [],
};

// ── construction.create_site_inspection ───────────────────────────────────────

export const constructionCreateSiteInspectionManifest: NodeManifestV2 = {
  type:        'construction.create_site_inspection',
  name:        'Create Site Inspection',
  version:     '1.0.0',
  description: 'Creates a SiteInspection resource linked to a ConstructionProject. Initial state: scheduled.',
  category:    'construction',
  packId:      'construction-pack',
  tags:        ['construction', 'inspection', 'quality', 'resource'],
  inputs: [
    { id: 'projectResourceId', name: 'Project Resource ID', dataType: 'string', required: true  },
    { id: 'inspectionType',    name: 'Inspection Type',     dataType: 'string', required: true  },
    { id: 'scheduledDate',     name: 'Scheduled Date',      dataType: 'string', required: false },
    { id: 'inspector',         name: 'Inspector (User ID)', dataType: 'string', required: false },
    { id: 'inspectorName',     name: 'Inspector Name',      dataType: 'string', required: false },
    { id: 'notes',             name: 'Pre-inspection Notes',dataType: 'string', required: false },
    { id: 'projectId',         name: 'Lados Project ID',    dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'inspectionId',    name: 'Inspection Resource ID', dataType: 'string' },
    { id: 'inspectionState', name: 'Inspection State',       dataType: 'string' },
    { id: 'inspectionType',  name: 'Inspection Type',        dataType: 'string' },
    { id: 'scheduledDate',   name: 'Scheduled Date',         dataType: 'string' },
  ],
  config: [
    { key: 'inspectionType', label: 'Inspection Type', type: 'string', required: false,
      description: 'pre-concrete | structural | finishes | mep | final | general' },
  ],
};

// ── construction.submit_inspection_report ─────────────────────────────────────

export const constructionSubmitInspectionReportManifest: NodeManifestV2 = {
  type:        'construction.submit_inspection_report',
  name:        'Submit Inspection Report',
  version:     '1.0.0',
  description: 'Records inspection findings and transitions a SiteInspection to completed or failed.',
  category:    'construction',
  packId:      'construction-pack',
  tags:        ['construction', 'inspection', 'report', 'quality'],
  inputs: [
    { id: 'inspectionId',   name: 'Inspection Resource ID', dataType: 'string', required: true  },
    { id: 'overallResult',  name: 'Overall Result',          dataType: 'string', required: true  },
    { id: 'findings',       name: 'Findings',                dataType: 'array',  required: false },
    { id: 'defectCount',    name: 'Defect Count',            dataType: 'number', required: false },
    { id: 'remarks',        name: 'Remarks',                 dataType: 'string', required: false },
    { id: 'photoUrls',      name: 'Photo URLs',              dataType: 'array',  required: false },
  ],
  outputs: [
    { id: 'inspectionId',    name: 'Inspection Resource ID', dataType: 'string' },
    { id: 'overallResult',   name: 'Overall Result',         dataType: 'string' },
    { id: 'defectCount',     name: 'Defect Count',           dataType: 'number' },
    { id: 'inspectionState', name: 'Inspection State',       dataType: 'string' },
  ],
  config: [],
};

// ── construction.log_defect ───────────────────────────────────────────────────

export const constructionLogDefectManifest: NodeManifestV2 = {
  type:        'construction.log_defect',
  name:        'Log Defect',
  version:     '1.0.0',
  description: 'Creates a Defect resource linked to a ConstructionProject. Initial state: open.',
  category:    'construction',
  packId:      'construction-pack',
  tags:        ['construction', 'defect', 'quality', 'resource'],
  inputs: [
    { id: 'projectResourceId', name: 'Project Resource ID', dataType: 'string', required: true  },
    { id: 'description',       name: 'Description',         dataType: 'string', required: true  },
    { id: 'severity',          name: 'Severity',            dataType: 'string', required: true  },
    { id: 'inspectionId',      name: 'Inspection ID',       dataType: 'string', required: false },
    { id: 'location',          name: 'Location',            dataType: 'string', required: false },
    { id: 'discoveredDate',    name: 'Discovered Date',     dataType: 'string', required: false },
    { id: 'photoUrls',         name: 'Photo URLs',          dataType: 'array',  required: false },
    { id: 'remarks',           name: 'Remarks',             dataType: 'string', required: false },
    { id: 'projectId',         name: 'Lados Project ID',    dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'defectId',    name: 'Defect Resource ID', dataType: 'string' },
    { id: 'defectState', name: 'Defect State',        dataType: 'string' },
    { id: 'severity',    name: 'Severity',            dataType: 'string' },
  ],
  config: [
    { key: 'severity', label: 'Severity', type: 'string', required: false,
      description: 'low | medium | high | critical' },
  ],
};

// ── construction.generate_boq ─────────────────────────────────────────────────

export const constructionGenerateBoqManifest: NodeManifestV2 = {
  type:        'construction.generate_boq',
  name:        'Generate BOQ',
  version:     '1.0.0',
  description: 'Generates a preliminary Bill of Quantities linked to a ConstructionProject. Optionally uses AI to generate line items. BOQ starts in draft state.',
  category:    'construction',
  packId:      'construction-pack',
  tags:        ['construction', 'boq', 'quantity-surveying', 'ai', 'resource'],
  inputs: [
    { id: 'projectResourceId', name: 'Project Resource ID', dataType: 'string',  required: true  },
    { id: 'projectType',       name: 'Project Type',        dataType: 'string',  required: true  },
    { id: 'scope',             name: 'Project Scope',       dataType: 'string',  required: false },
    { id: 'floorArea',         name: 'Floor Area (m²)',     dataType: 'number',  required: false },
    { id: 'currency',          name: 'Currency',            dataType: 'string',  required: false },
    { id: 'useAi',             name: 'Use AI Generation',   dataType: 'boolean', required: false },
    { id: 'projectId',         name: 'Lados Project ID',    dataType: 'string',  required: false },
  ],
  outputs: [
    { id: 'boqId',      name: 'BOQ Resource ID', dataType: 'string' },
    { id: 'boqState',   name: 'BOQ State',        dataType: 'string' },
    { id: 'totalValue', name: 'Total Value',      dataType: 'number' },
    { id: 'itemCount',  name: 'Item Count',       dataType: 'number' },
  ],
  config: [
    { key: 'projectType', label: 'Project Type', type: 'string', required: false,
      description: 'residential | commercial | industrial | infrastructure' },
    { key: 'currency',    label: 'Currency',      type: 'string',  required: false, defaultValue: 'MYR' },
    { key: 'useAi',       label: 'Use AI',        type: 'boolean', required: false, defaultValue: false,
      description: 'Use GPT-4o to generate contextual line items. Falls back to template if AI unavailable.' },
  ],
};

// ── Collected manifest array ──────────────────────────────────────────────────

export const nodeManifests: NodeManifestV2[] = [
  constructionCreateProjectManifest,
  constructionSubmitProgressClaimManifest,
  constructionAssessProgressClaimManifest,
  constructionCertifyProgressClaimManifest,
  constructionSubmitVariationManifest,
  constructionApproveVariationManifest,
  constructionCreateSiteInspectionManifest,
  constructionSubmitInspectionReportManifest,
  constructionLogDefectManifest,
  constructionGenerateBoqManifest,
];
