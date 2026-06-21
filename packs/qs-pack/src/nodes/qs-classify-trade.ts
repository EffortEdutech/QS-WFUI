/**
 * Real implementation: qs.classify_trade
 *
 * Classifies BOQ line items into standard CIDB trade categories.
 * Uses OpenAI (via IAiService) when configured; falls back to a
 * built-in keyword classifier so the workflow runs without an API key.
 *
 * Security note: AI is advisory only — confidence scores and warnings
 * are surfaced for human review. AI must not approve or certify anything.
 *
 * Phase 2: migrated from apps/api/src/execution/real-nodes/ to qs-pack
 *          NestJS AiService replaced with local IAiService interface.
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { BOQItem, BOQDocument } from './qs-read-boq';

// ── Local AI service interface ─────────────────────────────────────────────────
// NestJS AiService satisfies this via duck typing.

export interface IAiService {
  isConfigured: boolean;
  runCompletion(
    systemPrompt: string,
    userPrompt: string,
    options?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<string>;
}

// ── Trade types ────────────────────────────────────────────────────────────────

export type TradeCategory =
  | 'civil'
  | 'structural'
  | 'mechanical'
  | 'electrical'
  | 'plumbing'
  | 'finishing'
  | 'external'
  | 'preliminaries'
  | 'others';

export interface ClassifiedItem extends BOQItem {
  trade: TradeCategory;
  confidence: number;
  classified_by: 'ai' | 'keyword' | 'section';
}

// ── Keyword classifier ─────────────────────────────────────────────────────────

const TRADE_KEYWORDS: Record<TradeCategory, string[]> = {
  preliminaries: [
    'preliminary', 'prelim', 'site establishment', 'mobiliz', 'demobiliz',
    'insurance', 'performance bond', 'testing commission', 'as-built',
    'site office', 'temporary', 'hoarding', 'project management',
    'site supervision', 'survey', 'setting out', 'contractor preliminaries',
    'site signboard', 'safety', 'scaffolding', 'access road',
  ],
  civil: [
    'earthwork', 'excavat', 'backfill', 'filling', 'grading', 'compaction',
    'piling', 'bored pile', 'driven pile', 'foundation', 'footing',
    'retaining wall', 'drain', 'culvert', 'road', 'pavement', 'kerb',
    'manhole', 'septic tank', 'soakaway', 'site clearing', 'tree felling',
    'topsoil', 'hardcore', 'sub-base', 'aggregate',
  ],
  structural: [
    'reinforced concrete', 'r.c.', 'r/c', 'structural steel', 'steel frame',
    'beam', 'column', 'slab', 'staircase', 'rebar', 'bar bending', 'formwork',
    'shuttering', 'precast', 'prestress', 'composite', 'grout', 'anchor bolt',
    'structural', 'steel purlin', 'truss', 'roof structure',
  ],
  mechanical: [
    'hvac', 'air condition', 'air handling', 'chiller', 'cooling tower',
    'fan coil', 'ductwork', 'duct', 'ventilat', 'exhaust fan', 'fresh air',
    'lift', 'elevator', 'escalator', 'dumbwaiter', 'fire suppression',
    'sprinkler', 'fire hydrant', 'gas supply', 'mechanical',
  ],
  electrical: [
    'electrical', 'power supply', 'main switchboard', 'distribution board',
    'transformer', 'generator', 'ups', 'cabling', 'cable tray', 'conduit',
    'wiring', 'socket', 'switch', 'light', 'luminaire', 'lamp', 'fitting',
    'earthing', 'lightning protection', 'fire alarm', 'pa system',
    'cctv', 'access control', 'data network', 'telecommunication', 'elv',
  ],
  plumbing: [
    'plumbing', 'water supply', 'pipe', 'valve', 'pump', 'water tank',
    'hot water', 'cold water', 'rainwater', 'sewerage', 'sanitary',
    'toilet', 'wc', 'basin', 'sink', 'shower', 'bath', 'urinal',
    'floor trap', 'inspection chamber', 'grease trap', 'water meter',
  ],
  finishing: [
    'plaster', 'render', 'screeding', 'floor finish', 'wall finish',
    'ceiling', 'false ceiling', 'suspended ceiling', 'tile', 'tiling',
    'mosaic', 'marble', 'granite', 'timber floor', 'vinyl', 'carpet',
    'paint', 'painting', 'coating', 'varnish', 'door', 'window',
    'glass', 'glazing', 'aluminium frame', 'curtain wall', 'partition',
    'drylining', 'gypsum board', 'fitting out', 'internal finish',
    'ironmongery', 'hardware', 'skirting', 'architrave',
  ],
  external: [
    'external', 'landscap', 'planting', 'softscape', 'hardscape',
    'fencing', 'gate', 'boundary wall', 'car park', 'parking',
    'footpath', 'walkway', 'paving', 'street furniture', 'signage',
    'swimming pool', 'water feature', 'pergola', 'site drainage',
    'external drain', 'perimeter', 'guard house',
  ],
  others: [],
};

function classifyByKeyword(desc: string): { trade: TradeCategory; confidence: number } {
  const lower = desc.toLowerCase();
  const scores: Partial<Record<TradeCategory, number>> = {};

  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS) as [TradeCategory, string[]][]) {
    if (keywords.length === 0) continue;
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 1;
    }
    if (score > 0) scores[trade] = score;
  }

  const entries = Object.entries(scores) as [TradeCategory, number][];
  if (entries.length === 0) return { trade: 'others', confidence: 0.35 };

  entries.sort((a, b) => b[1] - a[1]);
  const [bestTrade, bestScore] = entries[0]!;
  const confidence = Math.min(0.55 + (bestScore - 1) * 0.08, 0.88);
  return { trade: bestTrade, confidence };
}

// ── AI classifier ──────────────────────────────────────────────────────────────

const AI_SYSTEM_PROMPT = `You are a senior Quantity Surveyor assistant specialising in Malaysian construction cost estimation.
Classify Bill of Quantities (BOQ) items into standard CIDB Malaysia trade categories.
Return ONLY a valid JSON array — no markdown fences, no explanation.
Valid trades: civil, structural, mechanical, electrical, plumbing, finishing, external, preliminaries, others`;

function buildAiUserPrompt(items: Array<{ item_no: string; description: string }>): string {
  const itemLines = items
    .map((it, i) => `${i + 1}. item_no="${it.item_no}" description="${it.description}"`)
    .join('\n');

  return `Classify these BOQ items. Return a JSON array with one object per item:
[{"item_no":"...","description":"...","trade":"civil","confidence":0.95}, ...]

Items:
${itemLines}`;
}

async function classifyWithAi(
  items: Array<{ item_no: string; description: string }>,
  aiService: IAiService,
): Promise<Array<{ item_no: string; trade: TradeCategory; confidence: number }> | null> {
  try {
    const text = await aiService.runCompletion(
      AI_SYSTEM_PROMPT,
      buildAiUserPrompt(items),
      { model: 'gpt-4o-mini', temperature: 0.1, maxTokens: 2048 },
    );

    const cleaned = text.replace(/```(?:json)?/gi, '').trim();
    const parsed = JSON.parse(cleaned) as Array<{
      item_no: string;
      trade: string;
      confidence: number;
    }>;

    if (!Array.isArray(parsed)) return null;

    const VALID_TRADES = new Set<string>([
      'civil', 'structural', 'mechanical', 'electrical', 'plumbing',
      'finishing', 'external', 'preliminaries', 'others',
    ]);

    return parsed.map((r) => ({
      item_no: String(r.item_no ?? ''),
      trade: (VALID_TRADES.has(r.trade) ? r.trade : 'others') as TradeCategory,
      confidence: Math.min(Math.max(Number(r.confidence) || 0.5, 0), 1),
    }));
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

export async function realClassifyTrade(
  ctx: NodeContext,
  aiService: IAiService,
): Promise<NodeExecuteResult> {
  const boqDoc      = ctx.inputs['boq']       as BOQDocument | undefined;
  const directItems = ctx.inputs['boq_items'] as BOQItem[]   | undefined;
  const allItems: BOQItem[] = boqDoc?.items ?? directItems ?? [];

  if (allItems.length === 0) {
    return {
      status: 'failure',
      outputs: {},
      logs: [],
      error: {
        code: 'NO_ITEMS',
        message: 'No BOQ items provided. Connect a Read BOQ node before Classify Trade.',
      },
    };
  }

  const currency            = boqDoc?.currency ?? (ctx.inputs['currency'] as string | undefined) ?? 'MYR';
  const confidenceThreshold = Number(ctx.config['confidence_threshold'] ?? 0.6);
  const useAi               = ctx.config['use_ai'] !== false;

  ctx.logger.info(`Classifying ${allItems.length} BOQ items (AI: ${useAi && aiService.isConfigured})`);

  const lineItems     = allItems.filter((it) => !it.is_section_header);
  const sectionHeaders = allItems.filter((it) => it.is_section_header);

  const classified: ClassifiedItem[] = [];
  const warnings: string[] = [];

  for (const header of sectionHeaders) {
    classified.push({ ...header, trade: 'others', confidence: 1.0, classified_by: 'section' });
  }

  let aiResults: Map<string, { trade: TradeCategory; confidence: number }> | null = null;

  if (useAi && aiService.isConfigured) {
    ctx.logger.info('Using OpenAI for classification...');
    const BATCH_SIZE = 25;
    const allAiResults: Array<{ item_no: string; trade: TradeCategory; confidence: number }> = [];

    for (let i = 0; i < lineItems.length; i += BATCH_SIZE) {
      const batch = lineItems.slice(i, i + BATCH_SIZE).map((it) => ({
        item_no: it.item_no,
        description: it.description,
      }));
      ctx.logger.info(`AI batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} items`);
      const batchResult = await classifyWithAi(batch, aiService);
      if (batchResult) {
        allAiResults.push(...batchResult);
      } else {
        ctx.logger.warn(`AI batch ${Math.floor(i / BATCH_SIZE) + 1} failed — using keyword fallback`);
      }
    }

    if (allAiResults.length > 0) {
      aiResults = new Map(allAiResults.map((r) => [r.item_no, r]));
      ctx.logger.info(`AI classified ${allAiResults.length}/${lineItems.length} items`);
    }
  }

  for (const item of lineItems) {
    const aiResult = aiResults?.get(item.item_no);
    let trade: TradeCategory;
    let confidence: number;
    let classified_by: ClassifiedItem['classified_by'];

    if (aiResult) {
      trade = aiResult.trade;
      confidence = aiResult.confidence;
      classified_by = 'ai';
    } else {
      const kw = classifyByKeyword(item.description);
      trade = kw.trade;
      confidence = kw.confidence;
      classified_by = 'keyword';
    }

    if (confidence < confidenceThreshold) {
      warnings.push(
        `Low confidence (${(confidence * 100).toFixed(0)}%) on "${item.description.slice(0, 60)}" → ${trade}`,
      );
    }

    classified.push({ ...item, trade, confidence, classified_by });
  }

  const tradeSummary: Record<string, { count: number; value: number }> = {};
  for (const item of classified) {
    if (item.is_section_header) continue;
    const t = item.trade;
    if (!tradeSummary[t]) tradeSummary[t] = { count: 0, value: 0 };
    tradeSummary[t].count += 1;
    tradeSummary[t].value += item.amount ?? 0;
  }

  const aiUsed   = aiResults !== null;
  const lineCount = lineItems.length;
  const topTrade  = Object.entries(tradeSummary).sort((a, b) => b[1].value - a[1].value)[0]?.[0] ?? 'others';

  ctx.logger.info(
    `Classification complete — ${lineCount} items, top trade: ${topTrade}, warnings: ${warnings.length}`,
  );

  return {
    status: 'success',
    outputs: {
      classified_items: classified,
      trade_summary:    tradeSummary,
      currency,
      boq_id:           boqDoc?.boq_id ?? null,
      warnings,
      ai_used:          aiUsed,
      item_count:       lineCount,
    },
    logs: [],
    summary: `Classified ${lineCount} items across ${Object.keys(tradeSummary).length} trades${warnings.length > 0 ? ` (${warnings.length} low-confidence)` : ''}`,
  };
}
