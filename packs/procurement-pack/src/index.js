"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manifest = exports.PACK_VERSION = exports.PACK_ID = void 0;
exports.resolveNode = resolveNode;
const procurement_generate_rfq_1 = require("./nodes/procurement-generate-rfq");
const procurement_generate_po_1 = require("./nodes/procurement-generate-po");
exports.PACK_ID = 'procurement-pack';
exports.PACK_VERSION = '0.2.0';
exports.manifest = {
    id: exports.PACK_ID,
    version: exports.PACK_VERSION,
    displayName: 'Procurement Pack',
    description: 'Procurement capabilities — RFQ generation, quotation collection, Purchase Orders',
    author: 'Lados Platform',
    nodes: [
        'procurement.generate_rfq',
        'procurement.generate_po',
    ],
};
function resolveNode(services) {
    const { libraryService } = services;
    const nodes = {
        'procurement.generate_rfq': (ctx) => (0, procurement_generate_rfq_1.realGenerateRfq)(ctx, libraryService),
        'procurement.generate_po': (ctx) => (0, procurement_generate_po_1.realGeneratePo)(ctx, libraryService),
    };
    return (nodeType) => nodes[nodeType] ?? null;
}
//# sourceMappingURL=index.js.map