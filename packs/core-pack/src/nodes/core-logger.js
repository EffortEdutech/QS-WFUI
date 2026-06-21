"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realLogger = realLogger;
async function realLogger(ctx) {
    const message = ctx.config['message'] ?? 'Checkpoint reached';
    const level = ctx.config['level'] ?? 'info';
    const data = ctx.inputs;
    const logFn = ctx.logger[level] ?? ctx.logger.info;
    logFn(`${message}`);
    if (Object.keys(data).length > 0) {
        ctx.logger.info(`Data snapshot: ${JSON.stringify(data).slice(0, 500)}`);
    }
    return {
        status: 'success',
        outputs: {
            logged: true,
            message,
            level,
            logged_at: new Date().toISOString(),
        },
        logs: [],
        summary: `Logged: "${message}"`,
    };
}
//# sourceMappingURL=core-logger.js.map