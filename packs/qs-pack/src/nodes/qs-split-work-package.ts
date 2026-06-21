/**
 * Real implementation: qs.split_work_package
 *
 * Groups classified BOQ items by trade into discrete work packages,
 * ready for individual RFQ generation.
 *
 * Input (from qs.classify_trade):
 *   ctx.inputs['classified_items'] — ClassifiedItem[]
 *   ctx.inputs['currency']         — 'MYR' | 'USD' | etc.
 *
 * Sprint 9 (S9-003)
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { ClassifiedItem, TradeCategory } from './qs-classify-trade';

export interface WorkPackage {
  trade: TradeCategory;
  label: string;             // Human-readable e.g. "Mechanical Works"
  item_count: number;
  line_item_count: number;   // excluding section headers
  subtotal: number;
  currency: string;
  items: ClassifiedItem[];
}

// Pretty-print trade names for document headings
const TRADE_LABELS: Record<TradeCategory, string> = {
  civil:         'Civil Works',
  structural:    'Structural Works',
  mechanical:    'Mechanical & HVAC Works',
  electrical:    'Electrical Works',
  plumbing:      'Plumbing & Sanitary Works',
  finishing:     'Finishes & Internal Works',
  external:      'External & Landscape Works',
  preliminaries: 'Preliminary & General Items',
  others:        'Miscellaneous Works',
};

export async function realSplitWorkPackage(
  ctx: NodeContext,
): Promise<NodeExecuteResult> {
  const classifiedItems = ctx.inputs['classified_items'] as ClassifiedItem[] | undefined;
  const currency = (ctx.inputs['currency'] as string | undefined) ?? 'MYR';

  if (!classifiedItems || classifiedItems.length === 0) {
    return {
      status: 'failure',
      outputs: {},
      logs: [],
      error: {
        code: 'NO_CLASSIFIED_ITEMS',
        message: 'No classified items provided. Connect a Classify Trade node before Split Work Package.',
      },
    };
  }

  const maxItemsPerPackage = Number(ctx.config['max_items_per_package'] ?? 50);

  ctx.logger.info(`Splitting ${classifiedItems.length} items into work packages...`);

  // Group by trade, preserving insertion order (section headers interleaved naturally)
  const grouped: Map<TradeCategory, ClassifiedItem[]> = new Map();

  for (const item of classifiedItems) {
    // Skip pure section headers (classified_by === 'section') from work packages
    // They provide no pricing data — the trade grouping supersedes them
    if (item.classified_by === 'section') continue;

    const trade = item.trade;
    if (!grouped.has(trade)) grouped.set(trade, []);
    grouped.get(trade)!.push(item);
  }

  // Build work packages, sorted by total value descending (highest value first)
  const packages: WorkPackage[] = [];
  for (const [trade, items] of grouped.entries()) {
    if (items.length === 0) continue;

    const subtotal = items.reduce((sum, it) => sum + (it.amount ?? 0), 0);
    const lineItems = items.filter((it) => !it.is_section_header);

    // Enforce max items per package (split if needed — simple head-truncation for MVP)
    const cappedItems = items.slice(0, maxItemsPerPackage);
    if (items.length > maxItemsPerPackage) {
      ctx.logger.warn(
        `Trade "${trade}" has ${items.length} items — truncated to ${maxItemsPerPackage} per config`,
      );
    }

    packages.push({
      trade,
      label: TRADE_LABELS[trade] ?? trade,
      item_count: cappedItems.length,
      line_item_count: lineItems.length,
      subtotal,
      currency,
      items: cappedItems,
    });
  }

  // Sort by subtotal descending so highest-value packages come first
  packages.sort((a, b) => b.subtotal - a.subtotal);

  const grandTotal = packages.reduce((sum, pkg) => sum + pkg.subtotal, 0);

  ctx.logger.info(
    `Split into ${packages.length} work packages. Grand total: ${currency} ${grandTotal.toLocaleString()}`,
  );

  return {
    status: 'success',
    outputs: {
      work_packages: packages,
      package_count: packages.length,
      currency,
      grand_total: grandTotal,
    },
    logs: [],
    summary: `${packages.length} work packages, grand total ${currency} ${grandTotal.toLocaleString()}`,
  };
}
