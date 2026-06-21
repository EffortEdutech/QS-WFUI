"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manifest = exports.PACK_VERSION = exports.PACK_ID = void 0;
exports.resolveNode = resolveNode;
const document_upload_file_1 = require("./nodes/document-upload-file");
const document_read_excel_1 = require("./nodes/document-read-excel");
exports.PACK_ID = 'document-pack';
exports.PACK_VERSION = '0.2.0';
exports.manifest = {
    id: exports.PACK_ID,
    version: exports.PACK_VERSION,
    displayName: 'Document Pack',
    description: 'Document business capabilities — Excel reading, file upload, PDF generation',
    author: 'Lados Platform',
    nodes: [
        'document.upload_file',
        'document.read_excel',
    ],
};
function resolveNode(services) {
    const { fileService, libraryService, documentService } = services;
    const nodes = {
        'document.upload_file': (ctx) => (0, document_upload_file_1.realUploadFile)(ctx),
        'document.read_excel': (ctx) => (0, document_read_excel_1.realReadExcel)(ctx, fileService, libraryService, documentService),
    };
    return (nodeType) => nodes[nodeType] ?? null;
}
//# sourceMappingURL=index.js.map