"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realUploadFile = realUploadFile;
async function realUploadFile(ctx) {
    const fileId = ctx.inputs['file_id'] ??
        ctx.config['file_id'] ??
        null;
    if (fileId) {
        ctx.logger.info(`Upload node: passing file_id ${fileId}`);
    }
    else {
        ctx.logger.info('Upload node: no file_id in inputs or config — ' +
            'downstream nodes should use library_file_id.');
    }
    return {
        status: 'success',
        outputs: { file_id: fileId ?? '' },
        logs: [],
        summary: fileId ? `File ready: ${fileId}` : 'No upload — using library file',
    };
}
//# sourceMappingURL=document-upload-file.js.map