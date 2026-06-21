"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWorkflow = parseWorkflow;
exports.serializeWorkflow = serializeWorkflow;
const validate_1 = require("./validate");
function parseWorkflow(raw) {
    const json = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const result = (0, validate_1.validateWorkflow)(json);
    if (!result.valid) {
        const summary = result.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
        throw new Error(`Invalid Workflow JSON — ${summary}`);
    }
    return json;
}
function serializeWorkflow(def) {
    const stamped = {
        ...def,
        workflow: {
            ...def.workflow,
            updatedAt: new Date().toISOString(),
        },
    };
    return JSON.stringify(stamped, null, 2);
}
//# sourceMappingURL=serialization.js.map