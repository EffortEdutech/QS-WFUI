"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseNode = void 0;
class BaseNode {
    validate(ctx) {
        const manifest = this.getManifest();
        const issues = [];
        for (const field of manifest.configSchema) {
            if (field.required) {
                const value = ctx.config[field.key];
                const missing = value === undefined ||
                    value === null ||
                    (typeof value === 'string' && value.trim() === '');
                if (missing) {
                    issues.push({
                        field: field.key,
                        severity: 'error',
                        message: `"${field.label}" is required`,
                    });
                }
            }
        }
        return { valid: issues.length === 0, issues };
    }
    onSuccess(_ctx, _result) {
    }
    onFailure(_ctx, _error) {
    }
    destroy() {
    }
    success(outputs, summary) {
        return { status: 'success', outputs, summary };
    }
    failure(code, message, details) {
        return {
            status: 'failure',
            outputs: {},
            error: { code, message, details },
        };
    }
    pendingApproval(outputs, request) {
        return {
            status: 'pending_approval',
            outputs,
            approvalRequest: request,
        };
    }
}
exports.BaseNode = BaseNode;
//# sourceMappingURL=base-node.js.map