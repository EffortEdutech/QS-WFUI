/**
 * construction.generate_boq
 *
 * Generates a Bill of Quantities (BOQ) resource linked to a
 * ConstructionProject. Can use AI assistance (GPT-4o) to generate template
 * line items from project scope, or use built-in templates by project type.
 *
 * AI guardrail: AI-generated BOQ items are advisory only. The BOQ starts in
 * 'draft' state and must go through the approval workflow (submitted →
 * approved) before being used as a contract document.
 *
 * Inputs:
 *   projectResourceId — construction_project resource ID (required)
 *   projectType       — residential | commercial | industrial | infrastructure (required)
 *   scope             — brief scope description for AI generation (optional)
 *   floorArea         — gross floor area in m² (optional)
 *   currency          — default 'MYR' (optional)
 *   useAi             — if true, use AI to generate line items; default false (optional)
 *   projectId         — Lados project to attach to (optional)
 *
 * Outputs:
 *   boqId        — created boq resource ID
 *   boqState     — initial state ('draft')
 *   totalValue   — sum of all line item amounts
 *   itemCount    — number of line items generated
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type {
  IConstructionResourceService,
  IConstructionAiService,
  BOQData,
  BOQLineItem,
} from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

// ── Built-in BOQ templates ─────────────────────────────────────────────────────

function getTemplateSections(projectType: string): BOQLineItem[] {
  const base: BOQLineItem[] = [
    { itemNo: 'A', description: 'Preliminaries & General Requirements', unit: 'Item', quantity: 1, rate: 0, amount: 0, trade: 'preliminaries' },
    { itemNo: 'B', description: 'Earthworks & Site Preparation',        unit: 'm²',  quantity: 0, rate: 0, amount: 0, trade: 'earthworks' },
    { itemNo: 'C', description: 'Substructure / Foundation Works',      unit: 'm³',  quantity: 0, rate: 0, amount: 0, trade: 'structural' },
    { itemNo: 'D', description: 'Superstructure — Concrete Works',      unit: 'm³',  quantity: 0, rate: 0, amount: 0, trade: 'structural' },
    { itemNo: 'E', description: 'Superstructure — Brickwork & Masonry', unit: 'm²',  quantity: 0, rate: 0, amount: 0, trade: 'masonry' },
    { itemNo: 'F', description: 'Roof Structure & Covering',            unit: 'm²',  quantity: 0, rate: 0, amount: 0, trade: 'roofing' },
    { itemNo: 'G', description: 'Doors, Windows & Ironmongery',         unit: 'Item', quantity: 0, rate: 0, amount: 0, trade: 'joinery' },
    { itemNo: 'H', description: 'Internal Finishes — Floors',           unit: 'm²',  quantity: 0, rate: 0, amount: 0, trade: 'finishes' },
    { itemNo: 'I', description: 'Internal Finishes — Walls & Ceilings', unit: 'm²',  quantity: 0, rate: 0, amount: 0, trade: 'finishes' },
    { itemNo: 'J', description: 'External Works & Landscaping',         unit: 'm²',  quantity: 0, rate: 0, amount: 0, trade: 'external' },
    { itemNo: 'K', description: 'Mechanical & Plumbing (M&E)',          unit: 'Item', quantity: 1, rate: 0, amount: 0, trade: 'mep' },
    { itemNo: 'L', description: 'Electrical Installation (M&E)',        unit: 'Item', quantity: 1, rate: 0, amount: 0, trade: 'mep' },
  ];

  if (projectType === 'infrastructure') {
    return [
      { itemNo: 'A', description: 'Mobilisation & Preliminaries',   unit: 'Item', quantity: 1, rate: 0, amount: 0, trade: 'preliminaries' },
      { itemNo: 'B', description: 'Earthworks & Grading',           unit: 'm³',  quantity: 0, rate: 0, amount: 0, trade: 'earthworks' },
      { itemNo: 'C', description: 'Drainage & Culverts',            unit: 'm',   quantity: 0, rate: 0, amount: 0, trade: 'drainage' },
      { itemNo: 'D', description: 'Road Pavement — Sub-base',       unit: 'm²',  quantity: 0, rate: 0, amount: 0, trade: 'pavement' },
      { itemNo: 'E', description: 'Road Pavement — Asphalt',        unit: 'ton', quantity: 0, rate: 0, amount: 0, trade: 'pavement' },
      { itemNo: 'F', description: 'Kerb, Drain & Footpath',         unit: 'm',   quantity: 0, rate: 0, amount: 0, trade: 'pavement' },
      { itemNo: 'G', description: 'Road Furniture & Signage',       unit: 'Item', quantity: 0, rate: 0, amount: 0, trade: 'signage' },
      { itemNo: 'H', description: 'Utilities — Water Supply',       unit: 'm',   quantity: 0, rate: 0, amount: 0, trade: 'utilities' },
      { itemNo: 'I', description: 'Utilities — Sewerage & Sanitary',unit: 'm',   quantity: 0, rate: 0, amount: 0, trade: 'utilities' },
      { itemNo: 'J', description: 'Landscaping & Reinstatement',    unit: 'm²',  quantity: 0, rate: 0, amount: 0, trade: 'external' },
    ];
  }

  if (projectType === 'industrial') {
    base.push(
      { itemNo: 'M', description: 'Industrial Flooring — Hardener / Epoxy', unit: 'm²', quantity: 0, rate: 0, amount: 0, trade: 'finishes' },
      { itemNo: 'N', description: 'Loading Bay & Dock Equipment',            unit: 'Item', quantity: 0, rate: 0, amount: 0, trade: 'special' },
      { itemNo: 'O', description: 'Fire Protection System',                  unit: 'Item', quantity: 1, rate: 0, amount: 0, trade: 'mep' },
    );
  }

  return base;
}

async function generateAiBoq(
  aiService: IConstructionAiService,
  projectType: string,
  scope: string | undefined,
  floorArea: number | undefined,
  currency: string,
): Promise<BOQLineItem[]> {
  const systemPrompt = `You are a Quantity Surveyor (QS) assistant. Generate a preliminary Bill of Quantities (BOQ) template in JSON format for a ${projectType} construction project.

Return ONLY a valid JSON array of BOQ line items. Each item must have:
  - itemNo: string (e.g. "A", "A1", "B", "B1")
  - description: string (work description)
  - unit: string (m², m³, m, ton, Item, etc.)
  - quantity: number (use 0 if unknown — this is a template)
  - rate: number (use 0 — rates to be filled in later)
  - amount: number (use 0 — to be computed qty × rate)
  - trade: string (preliminaries | earthworks | structural | masonry | roofing | joinery | finishes | mep | external | drainage | pavement | utilities | special)

Generate 15-20 realistic line items for a Malaysian construction project. Use MYR. Return ONLY the JSON array.`;

  const userPrompt = [
    `Project type: ${projectType}`,
    scope ? `Scope: ${scope}` : null,
    floorArea ? `Floor area: ${floorArea} m²` : null,
    `Currency: ${currency}`,
  ].filter(Boolean).join('\n');

  const response = await aiService.complete({
    systemPrompt,
    userPrompt,
    maxTokens: 2000,
  });

  // Extract JSON array from the AI response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('AI response did not contain a valid JSON array');
  }

  const parsed = JSON.parse(jsonMatch[0]) as BOQLineItem[];
  return parsed;
}

// ── Node implementation ───────────────────────────────────────────────────────

export async function realGenerateBoq(
  ctx: NodeContext,
  resourceService?: IConstructionResourceService,
  aiService?: IConstructionAiService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const projectResourceId = (inp['projectResourceId'] ?? cfg['projectResourceId']) as string | undefined;
  const projectType       = (inp['projectType']       ?? cfg['projectType'])       as string | undefined;
  const scope             = (inp['scope']             ?? cfg['scope'])             as string | undefined;
  const floorArea         = (inp['floorArea']         ?? cfg['floorArea'])         as number | undefined;
  const currency          = (inp['currency']          ?? cfg['currency'])          as string | undefined ?? 'MYR';
  const useAi             = (inp['useAi']             ?? cfg['useAi'])             as boolean | undefined ?? false;
  const projectId         = (inp['projectId']         ?? cfg['projectId'])         as string | undefined;

  if (!projectResourceId) return err('construction.generate_boq: projectResourceId is required');
  if (!projectType)       return err('construction.generate_boq: projectType is required');
  if (!ctx.organizationId) return err('construction.generate_boq: organizationId missing from context');
  if (!resourceService)   return err('construction.generate_boq: resourceService not injected');

  const VALID_PROJECT_TYPES = ['residential', 'commercial', 'industrial', 'infrastructure'];
  if (!VALID_PROJECT_TYPES.includes(projectType)) {
    return err(
      `construction.generate_boq: invalid projectType "${projectType}". ` +
      `Must be one of: ${VALID_PROJECT_TYPES.join(', ')}`,
    );
  }

  // Generate line items
  let lineItems: BOQLineItem[];
  let generatedBy: 'ai' | 'template' = 'template';
  let aiModel: string | undefined;

  if (useAi && aiService) {
    try {
      ctx.logger.info('[construction.generate_boq] Generating BOQ with AI assistance...');
      lineItems   = await generateAiBoq(aiService, projectType, scope, floorArea, currency);
      generatedBy = 'ai';
      aiModel     = 'gpt-4o';
      ctx.logger.info(`[construction.generate_boq] AI generated ${lineItems.length} line items`);
    } catch (aiErr) {
      ctx.logger.warn(
        `[construction.generate_boq] AI generation failed (${String(aiErr)}), falling back to template`,
      );
      lineItems = getTemplateSections(projectType);
    }
  } else {
    if (useAi && !aiService) {
      ctx.logger.warn('[construction.generate_boq] useAi=true but aiService not injected — using template');
    }
    lineItems = getTemplateSections(projectType);
  }

  const totalValue = lineItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const sections   = [...new Set(lineItems.map((i) => i.trade).filter(Boolean))] as string[];
  const now        = new Date().toISOString();
  const label      = `BOQ — ${projectType.charAt(0).toUpperCase() + projectType.slice(1)} Project`;

  const data: BOQData = {
    projectResourceId,
    projectType,
    ...(scope      ? { scope }      : {}),
    ...(floorArea  ? { floorArea }  : {}),
    currency,
    totalValue,
    itemCount:   lineItems.length,
    sections,
    lineItems,
    generatedBy,
    generatedAt: now,
    ...(aiModel  ? { aiModel }  : {}),
  };

  const resource = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'boq',
    name:      label,
    data:      data as unknown as Record<string, unknown>,
    parentId:  projectResourceId,
    ...(projectId ? { projectId } : {}),
    createdBy: ctx.userId,
  });

  ctx.logger.info(
    `[construction.generate_boq] BOQ "${label}" created ` +
    `(id=${resource.id}, items=${lineItems.length}, generatedBy=${generatedBy})`,
  );

  return {
    status: 'success',
    outputs: {
      boqId:       resource.id,
      boqState:    resource.state,
      totalValue,
      itemCount:   lineItems.length,
    },
  };
}
