"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realCondition = realCondition;
function evaluateExpression(expression, inputValue) {
    const raw = expression.trim();
    const operators = ['!=', '>=', '<=', '>', '<', '==', '!includes', 'includes'];
    let matchedOp = null;
    let lhsStr = '';
    let rhsStr = '';
    for (const op of operators) {
        const idx = raw.indexOf(op);
        if (idx === -1)
            continue;
        lhsStr = raw.slice(0, idx).trim();
        rhsStr = raw.slice(idx + op.length).trim();
        if (lhsStr.toLowerCase() === 'value') {
            matchedOp = op;
            break;
        }
    }
    if (!matchedOp) {
        throw new Error(`Condition expression "${expression}" could not be parsed. ` +
            `Expected: value <op> <literal>  where op is one of: >=, <=, >, <, ==, !=, includes, !includes, == null, != null`);
    }
    const rhs = parseLiteral(rhsStr);
    const lhs = inputValue;
    return compare(lhs, matchedOp, rhs);
}
function parseLiteral(raw) {
    if (raw === 'null' || raw === 'undefined')
        return null;
    if (raw === 'true')
        return true;
    if (raw === 'false')
        return false;
    const num = Number(raw);
    if (!isNaN(num) && raw !== '')
        return num;
    if ((raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))) {
        return raw.slice(1, -1);
    }
    return raw;
}
function compare(lhs, op, rhs) {
    switch (op) {
        case '==':
            if (rhs === null)
                return lhs == null;
            return String(lhs).toLowerCase() === String(rhs).toLowerCase();
        case '!=':
            if (rhs === null)
                return lhs != null;
            return String(lhs).toLowerCase() !== String(rhs).toLowerCase();
        case '>': return Number(lhs) > Number(rhs);
        case '<': return Number(lhs) < Number(rhs);
        case '>=': return Number(lhs) >= Number(rhs);
        case '<=': return Number(lhs) <= Number(rhs);
        case 'includes':
            return String(lhs ?? '').toLowerCase().includes(String(rhs).toLowerCase());
        case '!includes':
            return !String(lhs ?? '').toLowerCase().includes(String(rhs).toLowerCase());
        default:
            throw new Error(`Unknown operator: ${op}`);
    }
}
async function realCondition(ctx) {
    const expression = ctx.config['expression'] ?? '';
    if (!expression.trim()) {
        return {
            status: 'failure',
            outputs: {},
            summary: 'Condition node has no expression configured.',
            logs: ['ERROR: expression config is empty'],
        };
    }
    const inputValue = ctx.inputs?.['value'] ??
        (ctx.inputs ? Object.values(ctx.inputs)[0] : undefined);
    let result;
    try {
        result = evaluateExpression(expression, inputValue);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
            status: 'failure',
            outputs: {},
            summary: msg,
            logs: [`ERROR: ${msg}`],
        };
    }
    const activePath = result ? 'true_path' : 'false_path';
    return {
        status: 'success',
        outputs: {
            true_path: result ? inputValue : null,
            false_path: result ? null : inputValue,
        },
        summary: `Condition "${expression}" → ${result ? 'TRUE' : 'FALSE'} (routing to ${activePath})`,
        logs: [
            `Expression: ${expression}`,
            `Input value: ${JSON.stringify(inputValue)}`,
            `Result: ${result} → ${activePath}`,
        ],
    };
}
//# sourceMappingURL=workflow-condition.js.map