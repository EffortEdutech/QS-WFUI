/**
 * Construction Pack — Type Catalogue
 *
 * Canonical resource type names, event type names, and data shapes
 * for the Construction Pack.
 *
 * These resource type names match the lados_resources.type CHECK
 * constraint values added in migration 0041.
 *
 * AI guardrails (non-negotiable):
 *   - construction.certify_progress_claim: must appear DOWNSTREAM of
 *     foundation.request_approval. AI cannot certify payment.
 *   - construction.approve_variation: must appear DOWNSTREAM of
 *     foundation.request_approval. AI cannot approve contract changes.
 */

// ── Resource types ────────────────────────────────────────────────────────────

export const CONSTRUCTION_RESOURCE_TYPES = [
  'construction_project',
  'progress_claim',
  'variation',
  'defect',
  'boq',
  'site_inspection',
] as const;

export type ConstructionResourceType = typeof CONSTRUCTION_RESOURCE_TYPES[number];

// ── Event types ───────────────────────────────────────────────────────────────

export const CONSTRUCTION_EVENTS = {
  // Project
  PROJECT_CREATED:             'construction_project.created',
  PROJECT_ACTIVATED:           'construction_project.activated',
  PROJECT_COMPLETED:           'construction_project.completed',
  PROJECT_CANCELLED:           'construction_project.cancelled',

  // Progress Claim
  CLAIM_SUBMITTED:             'progress_claim.submitted',
  CLAIM_ASSESSMENT_STARTED:    'progress_claim.assessment_started',
  CLAIM_CERTIFIED:             'progress_claim.certified',
  CLAIM_REJECTED:              'progress_claim.rejected',
  CLAIM_PAID:                  'progress_claim.paid',

  // Variation
  VARIATION_SUBMITTED:         'variation.submitted',
  VARIATION_UNDER_REVIEW:      'variation.under_review',
  VARIATION_APPROVED:          'variation.approved',  // human approval — AI guardrail
  VARIATION_REJECTED:          'variation.rejected',
  VARIATION_EXECUTED:          'variation.executed',

  // Defect
  DEFECT_LOGGED:               'defect.logged',
  DEFECT_ACKNOWLEDGED:         'defect.acknowledged',
  DEFECT_RESOLVED:             'defect.resolved',
  DEFECT_CLOSED:               'defect.closed',

  // BOQ
  BOQ_GENERATED:               'boq.generated',
  BOQ_SUBMITTED:               'boq.submitted',
  BOQ_APPROVED:                'boq.approved',

  // Site Inspection
  INSPECTION_CREATED:          'site_inspection.created',
  INSPECTION_COMPLETED:        'site_inspection.completed',
  INSPECTION_FAILED:           'site_inspection.failed',
} as const;

export type ConstructionEventType = typeof CONSTRUCTION_EVENTS[keyof typeof CONSTRUCTION_EVENTS];

// ── Service interface ─────────────────────────────────────────────────────────
//
// IConstructionResourceService is satisfied by NestJS ResourceService via
// structural (duck) typing — no NestJS imports in this pack.

export interface IConstructionResource {
  id:         string;
  org_id:     string;
  project_id: string | null;
  type:       string;
  name:       string;
  state:      string;
  data:       Record<string, unknown>;
  parent_id:  string | null;
  created_at: string;
  updated_at: string;
}

export interface IConstructionResourceService {
  create(params: {
    orgId:      string;
    type:       string;
    name:       string;
    data?:      Record<string, unknown>;
    projectId?: string;
    parentId?:  string;
    createdBy?: string;
  }): Promise<IConstructionResource>;

  findById(id: string, orgId: string): Promise<IConstructionResource | null>;

  updateResource(
    id:        string,
    orgId:     string,
    updates:   { name?: string; data?: Record<string, unknown> },
    updatedBy: string,
  ): Promise<IConstructionResource>;

  transitionState(
    id:      string,
    orgId:   string,
    toState: string,
    actorId: string,
  ): Promise<IConstructionResource>;
}

// ── Optional AI service (used by construction.generate_boq) ──────────────────

export interface IConstructionAiService {
  complete(params: {
    systemPrompt: string;
    userPrompt:   string;
    maxTokens?:   number;
  }): Promise<string>;
}

// ── Data shapes (stored in lados_resources.data JSONB) ────────────────────────

export interface ConstructionProjectData {
  description?:    string;
  contractValue?:  number;      // MYR
  currency?:       string;
  startDate?:      string;      // ISO 8601
  endDate?:        string;      // ISO 8601
  clientName?:     string;
  contractorName?: string;
  siteAddress?:    string;
  contractNo?:     string;
  projectType?:    string;      // residential | commercial | industrial | infrastructure
}

export interface ProgressClaimData {
  projectResourceId: string;   // parent construction_project resource ID
  claimNo?:          string;   // e.g. "PC-001"
  claimPeriodStart?: string;   // ISO 8601
  claimPeriodEnd?:   string;   // ISO 8601
  claimAmount?:      number;   // MYR (contractor's claimed amount)
  currency?:         string;
  claimItems?:       ProgressClaimItem[];
  submittedBy?:      string;   // user ID
  submittedAt?:      string;   // ISO 8601
  // QS Assessment fields (populated by assess_progress_claim)
  assessedAmount?:   number;   // MYR (QS-certified amount)
  assessedBy?:       string;   // user ID
  assessedAt?:       string;   // ISO 8601
  assessmentNotes?:  string;
  // Certificate fields (populated by certify_progress_claim)
  certifiedAmount?:  number;   // MYR
  certificateNo?:    string;
  certifiedBy?:      string;   // user ID
  certifiedAt?:      string;   // ISO 8601
  certificationComments?: string;
}

export interface ProgressClaimItem {
  boqItemNo?:      string;
  description:     string;
  unit?:           string;
  previousQty?:    number;
  thisClaimQty?:   number;
  totalQty?:       number;
  rate?:           number;
  amount?:         number;
  certifiedQty?:   number;    // QS-certified quantity
  certifiedAmount?: number;
}

export interface VariationData {
  projectResourceId: string;   // parent construction_project resource ID
  variationNo?:      string;   // e.g. "VO-001"
  reason:            string;
  description?:      string;
  costImpact?:       number;   // MYR (positive = addition, negative = omission)
  timeImpact?:       number;   // days extension
  currency?:         string;
  supportingDocs?:   string[]; // file URLs
  submittedBy?:      string;   // user ID
  submittedAt?:      string;   // ISO 8601
  // Review / approval fields
  reviewNotes?:      string;
  approvedBy?:       string;   // user ID — must be set by human approval node
  approvedAt?:       string;   // ISO 8601
  approvedAmount?:   number;   // MYR — may differ from claimed costImpact
  timeExtension?:    number;   // days approved
  approvalComments?: string;
}

export interface DefectData {
  projectResourceId: string;   // parent construction_project resource ID
  inspectionId?:     string;   // site_inspection resource ID (if from inspection)
  description:       string;
  location?:         string;
  severity:          'low' | 'medium' | 'high' | 'critical';
  discoveredBy?:     string;   // user ID
  discoveredDate?:   string;   // ISO 8601
  photoUrls?:        string[];
  remarks?:          string;
  resolutionNotes?:  string;
  resolvedBy?:       string;   // user ID
  resolvedAt?:       string;   // ISO 8601
}

export interface BOQLineItem {
  itemNo?:      string;
  description:  string;
  unit?:        string;
  quantity?:    number;
  rate?:        number;
  amount?:      number;
  trade?:       string;
  notes?:       string;
}

export interface BOQData {
  projectResourceId: string;   // parent construction_project resource ID
  projectType?:      string;   // residential | commercial | industrial | infrastructure
  scope?:            string;   // brief scope description
  floorArea?:        number;   // m²
  currency?:         string;
  totalValue?:       number;   // MYR — sum of all line items
  itemCount?:        number;
  sections?:         string[];
  lineItems?:        BOQLineItem[];
  generatedBy?:      'ai' | 'template' | 'manual';
  generatedAt?:      string;   // ISO 8601
  aiModel?:          string;   // model used if generatedBy === 'ai'
}

export interface InspectionFinding {
  location:    string;
  description: string;
  severity?:   'minor' | 'major' | 'critical';
  photoUrls?:  string[];
  rectified?:  boolean;
}

export interface SiteInspectionData {
  projectResourceId: string;   // parent construction_project resource ID
  inspectionType:    string;   // pre-concrete | structural | finishes | mep | final | general
  scheduledDate?:    string;   // ISO 8601
  inspector?:        string;   // user ID
  inspectorName?:    string;
  notes?:            string;
  // Report fields (populated by submit_inspection_report)
  findings?:         InspectionFinding[];
  overallResult?:    'pass' | 'fail' | 'conditional';
  defectCount?:      number;
  remarks?:          string;
  photoUrls?:        string[];
  completedAt?:      string;   // ISO 8601
}
