"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realCleanBoq = realCleanBoq;
async function realCleanBoq(ctx) {
    const boqDoc = ctx.inputs['boq'];
    const currency = ctx.inputs['currency'];
    const sections = ctx.inputs['sections'];
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
    const removeZeroQty = ctx.config['remove_zero_qty'] !== false; // default true
    const trimDescriptions = ctx.config['trim_descriptions'] !== false; // default true
    let items = boqDoc.items ?? [];
    if (trimDescriptions) {
        items = items.map((it) => ({
            ...it,
            description: it.description?.trim() ?? '',
            unit: it.unit?.trim() ?? '',
        }));
    }
    if (removeZeroQty) {
        const before = items.length;
        items = items.filter((it) => it.is_section_header || it.qty === null || it.qty !== 0);
        const removed = before - items.length;
        if (removed > 0) {
            ctx.logger.info(`Removed ${removed} zero-quantity line items`);
        }
    }
    const cleanItems = items.filter((it) => !it.is_section_header);
    ctx.logger.info(`Clean BOQ: ${cleanItems.length} line items remaining from ${(boqDoc.items ?? []).filter((i) => !i.is_section_header).length} original`);
    const cleanBoq = {
        ...boqDoc,
        items,
        total_items: cleanItems.length,
    };
    return {
        status: 'success',
        outputs: {
            boq: cleanBoq,
            clean_items: cleanItems,
            currency: boqDoc.currency ?? currency ?? 'MYR',
            sections: sections ?? boqDoc.sections ?? [],
            removed_count: (boqDoc.items?.length ?? 0) - items.length,
        },
        logs: [],
        summary: `${cleanItems.length} clean BOQ items`,
    };
}
//# sourceMappingURL=qs-clean-boq.js.map