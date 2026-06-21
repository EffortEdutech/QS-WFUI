/**
 * Real implementation: qs.clean_boq
 *
 * Normalises BOQ items — removes zero-quantity lines, trims whitespace,
 * and passes the cleaned BOQ to downstream nodes.
 *
 * Phase 2: migrated from apps/api/src/execution/real-nodes/ to qs-pack
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { BOQDocument, BOQItem } from './qs-read-boq';

export async function realCleanBoq(ctx: NodeContext): Promise<NodeExecuteResult> {
  const boqDoc   = ctx.inputs['boq']       as BOQDocument | undefined;
  const currency = ctx.inputs['currency']  as string | undefined;
  const sections = ctx.inputs['sections']  as string[] | undefined;

  if (!boqDoc) {
    return {
      status: 'failure',
      outputs: {},
      logs: [],
      error: {
        code: 'NO_BOQ',
        message: 'No BOQ provided. Connect a Read BOQ node before Clean BOQ.',
      },
    };
  }

  const removeZeroQty: boolean    = ctx.config['remove_zero_qty'] !== false;     // default true
  const trimDescriptions: boolean = ctx.config['trim_descriptions'] !== false;   // default true

  let items: BOQItem[] = boqDoc.items ?? [];

  if (trimDescriptions) {
    items = items.map((it) => ({
      ...it,
      description: it.description?.trim() ?? '',
      unit:        it.unit?.trim() ?? '',
    }));
  }

  if (removeZeroQty) {
    const before = items.length;
    items = items.filter(
      (it) => it.is_section_header || it.qty === null || it.qty !== 0,
    );
    const removed = before - items.length;
    if (removed > 0) {
      ctx.logger.info(`Removed ${removed} zero-quantity line items`);
    }
  }

  const cleanItems = items.filter((it) => !it.is_section_header);

  ctx.logger.info(
    `Clean BOQ: ${cleanItems.length} line items remaining from ${(boqDoc.items ?? []).filter((i) => !i.is_section_header).length} original`,
  );

  const cleanBoq: BOQDocument = {
    ...boqDoc,
    items,
    total_items: cleanItems.length,
  };

  return {
    status: 'success',
    outputs: {
      boq:           cleanBoq,
      clean_items:   cleanItems,
      currency:      boqDoc.currency ?? currency ?? 'MYR',
      sections:      sections ?? boqDoc.sections ?? [],
      removed_count: (boqDoc.items?.length ?? 0) - items.length,
    },
    logs: [],
    summary: `${cleanItems.length} clean BOQ items`,
  };
}
