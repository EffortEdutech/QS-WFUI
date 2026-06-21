"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realReadBoq = realReadBoq;
// ── Column name synonyms ──────────────────────────────────────────────────────
const ITEM_NO_KEYS = ['item_no', 'item', 'no', 'ref', 'item_number', 'number'];
const DESC_KEYS = ['description', 'desc', 'work_description', 'item_description', 'details'];
const UNIT_KEYS = ['unit', 'uom', 'units'];
const QTY_KEYS = ['quantity', 'qty', 'amount_qty'];
const RATE_KEYS = ['rate', 'rate_(rm)', 'rate_rm', 'unit_rate', 'rate_(myr)'];
const AMOUNT_KEYS = ['amount', 'amount_(rm)', 'amount_rm', 'total', 'total_amount', 'sum'];
function findKey(headers, synonyms) {
    for (const h of headers) {
        if (synonyms.includes(h))
            return h;
    }
    // Partial match
    for (const h of headers) {
        if (synonyms.some((s) => h.includes(s)))
            return h;
    }
    return null;
}
/**
 * Resolves a config column spec to the actual row key.
 * Supports:
 *   - Excel column letter: "A" → hdrs[0], "B" → hdrs[1], etc.
 *   - Key name directly:   "item_no" → "item_no" (if it exists in hdrs)
 */
function resolveColConfig(spec, hdrs) {
    const s = spec.trim();
    // Single letter A-Z (case-insensitive) → positional
    if (/^[A-Za-z]$/.test(s)) {
        const idx = s.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, ...
        return hdrs[idx] ?? null;
    }
    // Otherwise treat as the key name
    const lower = s.toLowerCase();
    return hdrs.includes(lower) ? lower : null;
}
function toNumber(val) {
    if (val === null || val === undefined || val === '')
        return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
}
function isSection(item) {
    // A section header has no unit, qty, rate — or item_no ends without a decimal
    if (item.unit || item.qty || item.rate)
        return false;
    if (!item.item_no || !/^\d/.test(item.item_no))
        return true;
    if (item.description && !item.item_no.includes('.'))
        return true;
    return false;
}
// ── Main ──────────────────────────────────────────────────────────────────────
async function realReadBoq(ctx) {
    // Expect rows from document.read_excel in inputs
    const rows = ctx.inputs['rows'];
    const headers = ctx.inputs['headers'];
    const fileId = ctx.inputs['file_id'];
    if (!rows || rows.length === 0) {
        return {
            status: 'failure',
            outputs: {},
            logs: [],
            error: {
                code: 'NO_ROWS',
                message: 'No rows provided. Connect a Read Excel node before this node.',
            },
        };
    }
    ctx.logger.info(`Processing ${rows.length} rows...`);
    const currency = ctx.config['currency'] ?? 'MYR';
    // Auto-detect columns from config overrides or header synonyms
    const hdrs = headers ?? Object.keys(rows[0] ?? {}).filter((k) => k !== 'row');
    const colItemNo = ctx.config['item_col']
        ? resolveColConfig(ctx.config['item_col'], hdrs)
        : findKey(hdrs, ITEM_NO_KEYS);
    const colDesc = ctx.config['desc_col']
        ? resolveColConfig(ctx.config['desc_col'], hdrs)
        : findKey(hdrs, DESC_KEYS);
    const colUnit = ctx.config['unit_col']
        ? resolveColConfig(ctx.config['unit_col'], hdrs)
        : findKey(hdrs, UNIT_KEYS);
    const colQty = ctx.config['qty_col']
        ? resolveColConfig(ctx.config['qty_col'], hdrs)
        : findKey(hdrs, QTY_KEYS);
    const colRate = ctx.config['rate_col']
        ? resolveColConfig(ctx.config['rate_col'], hdrs)
        : findKey(hdrs, RATE_KEYS);
    const colAmt = ctx.config['amount_col']
        ? resolveColConfig(ctx.config['amount_col'], hdrs)
        : findKey(hdrs, AMOUNT_KEYS);
    ctx.logger.info(`Column mapping — item_no: ${colItemNo}, desc: ${colDesc}, unit: ${colUnit}, qty: ${colQty}, rate: ${colRate}, amount: ${colAmt}`);
    const items = [];
    const sections = [];
    let totalValue = 0;
    for (const row of rows) {
        const itemNo = colItemNo ? String(row[colItemNo] ?? '').trim() : '';
        const desc = colDesc ? String(row[colDesc] ?? '').trim() : '';
        const unit = colUnit ? String(row[colUnit] ?? '').trim() : '';
        const qty = colQty ? toNumber(row[colQty]) : null;
        const rate = colRate ? toNumber(row[colRate]) : null;
        const amt = colAmt ? toNumber(row[colAmt]) : null;
        // Skip completely empty rows
        if (!itemNo && !desc)
            continue;
        // Skip pure summary/total rows (e.g. "TOTAL (MYR)")
        if (!itemNo && desc.toUpperCase().startsWith('TOTAL'))
            continue;
        const isSectionHeader = isSection({ item_no: itemNo, description: desc, unit, qty, rate });
        if (isSectionHeader && desc) {
            sections.push(desc);
        }
        // Compute amount if missing but qty and rate available
        const computedAmt = amt ?? (qty !== null && rate !== null ? qty * rate : null);
        if (computedAmt)
            totalValue += computedAmt;
        items.push({
            item_no: itemNo,
            description: desc,
            unit,
            qty,
            rate,
            amount: computedAmt,
            is_section_header: isSectionHeader,
        });
    }
    const lineItems = items.filter((i) => !i.is_section_header);
    ctx.logger.info(`BOQ parsed: ${lineItems.length} line items, ${sections.length} sections, total ${currency} ${totalValue.toFixed(2)}`);
    const boqDoc = {
        boq_id: `boq-${Date.now()}`,
        source_file_id: fileId ?? null,
        currency,
        total_items: lineItems.length,
        section_count: sections.length,
        total_value: totalValue,
        items,
        sections,
    };
    return {
        status: 'success',
        outputs: {
            boq: boqDoc,
            total_items: lineItems.length,
            total_value: totalValue,
            currency,
            sections,
        },
        logs: [],
        summary: `BOQ: ${lineItems.length} items, ${currency} ${totalValue.toLocaleString()}`,
    };
}
//# sourceMappingURL=qs-read-boq.js.map