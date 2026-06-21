"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manifest = exports.PACK_VERSION = exports.PACK_ID = void 0;
exports.resolveNode = resolveNode;
const qs_read_boq_1 = require("./nodes/qs-read-boq");
const qs_clean_boq_1 = require("./nodes/qs-clean-boq");
const qs_classify_trade_1 = require("./nodes/qs-classify-trade");
const qs_split_work_package_1 = require("./nodes/qs-split-work-package");
exports.PACK_ID = 'qs-pack';
exports.PACK_VERSION = '0.2.0';
exports.manifest = {
    id: exports.PACK_ID,
    version: exports.PACK_VERSION,
    displayName: 'QS Pack',
    description: 'Quantity Surveying — BOQ reading, trade classification, cost plans, RFQ splitting, rate analysis',
    author: 'Lados Platform',
    nodes: [
        'qs.read_boq',
        'qs.clean_boq',
        'qs.classify_trade',
        'qs.split_work_package',
    ],
};
/**
 * Returns the real executor for a qs-pack node type, or null if unknown.
 */
function resolveNode(services) {
    const { aiService } = services;
    const nodes = {
        'qs.read_boq': (ctx) => (0, qs_read_boq_1.realReadBoq)(ctx),
        'qs.clean_boq': (ctx) => (0, qs_clean_boq_1.realCleanBoq)(ctx),
        'qs.classify_trade': (ctx) => (0, qs_classify_trade_1.realClassifyTrade)(ctx, aiService),
        'qs.split_work_package': (ctx) => (0, qs_split_work_package_1.realSplitWorkPackage)(ctx),
    };
    return (nodeType) => nodes[nodeType] ?? null;
}
//# sourceMappingURL=index.js.map