"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWorkflow = validateWorkflow;
exports.isValidWorkflow = isValidWorkflow;
function validateWorkflow(json) {
    const errors = [];
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
        return { valid: false, errors: [{ field: 'root', message: 'Must be a JSON object' }] };
    }
    const doc = json;
    if (!Array.isArray(doc['nodes'])) {
        errors.push({ field: 'nodes', message: 'Must be an array' });
    }
    else {
        const nodeIds = new Set();
        doc['nodes'].forEach((node, i) => {
            const n = node;
            if (!n['id'])
                errors.push({ field: `nodes[${i}].id`, message: 'Required' });
            else
                nodeIds.add(n['id']);
            if (!n['type'])
                errors.push({ field: `nodes[${i}].type`, message: 'Required' });
            if (!n['position'] || typeof n['position'] !== 'object') {
                errors.push({ field: `nodes[${i}].position`, message: 'Required {x, y} object' });
            }
        });
        if (!Array.isArray(doc['connections'])) {
            errors.push({ field: 'connections', message: 'Must be an array' });
        }
        else {
            doc['connections'].forEach((conn, i) => {
                const c = conn;
                if (!c['id'])
                    errors.push({ field: `connections[${i}].id`, message: 'Required' });
                if (!c['sourceNodeId'])
                    errors.push({ field: `connections[${i}].sourceNodeId`, message: 'Required' });
                if (!c['targetNodeId'])
                    errors.push({ field: `connections[${i}].targetNodeId`, message: 'Required' });
                if (!c['sourcePortId'])
                    errors.push({ field: `connections[${i}].sourcePortId`, message: 'Required' });
                if (!c['targetPortId'])
                    errors.push({ field: `connections[${i}].targetPortId`, message: 'Required' });
                if (c['sourceNodeId'] && !nodeIds.has(c['sourceNodeId'])) {
                    errors.push({
                        field: `connections[${i}].sourceNodeId`,
                        message: `Node "${String(c['sourceNodeId'])}" not found in nodes[]`,
                    });
                }
                if (c['targetNodeId'] && !nodeIds.has(c['targetNodeId'])) {
                    errors.push({
                        field: `connections[${i}].targetNodeId`,
                        message: `Node "${String(c['targetNodeId'])}" not found in nodes[]`,
                    });
                }
            });
        }
    }
    return { valid: errors.length === 0, errors };
}
function isValidWorkflow(json) {
    return validateWorkflow(json).valid;
}
//# sourceMappingURL=validate.js.map