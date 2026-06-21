/**
 * workflow-condition — Sprint 14 (S14-006)
 *
 * Data-driven routing node. Evaluates a user-defined expression against the
 * incoming `value` input and routes to one of two output handles:
 *   true_path  — when the condition is satisfied
 *   false_path — when the condition is not satisfied
 *
 * Supported expression syntax (case-insensitive operators):
 *   value >= 100
 *   value <= 50
 *   value > 0
 *   value < 1000
 *   value == "approved"
 *   value != "rejected"
 *   value == null
 *   value != null
 *   value includes "keyword"
 *   value !includes "keyword"
 *
 * The literal keyword `value` refers to the incoming port value.
 * String comparisons are case-insensitive.
 *
 * Security: expression is evaluated with a hand-rolled parser, NOT eval().
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

// ── Expression Evaluator ──────────────────────────────────────────────────────

type CompareResult = boolean;

/**
 * Parse and evaluate a condition expression.
 * Returns true when the condition is met, false otherwise.
 * Throws if the expression is unparseable.
 */
function evaluateExpression(expression: string, inputValue: unknown): CompareResult {
  const raw = expression.trim();

  // Tokenize: split on first operator occurrence (longest match first)
  const operators = ['!=', '>=', '<=', '>', '<', '==', '!includes', 'includes'];

  let matchedOp: string | null = null;
  let lhsStr = '';
  let rhsStr = '';

  for (const op of operators) {
    const idx = raw.indexOf(op);
    if (idx === -1) continue;

    // Ensure 'includes' doesn't accidentally match '!includes' suffix twice
    // by checking that the left side is recognisably "value"
    lhsStr = raw.slice(0, idx).trim();
    rhsStr = raw.slice(idx + op.length).trim();

    if (lhsStr.toLowerCase() === 'value') {
      matchedOp = op;
      break;
    }
  }

  if (!matchedOp) {
    throw new Error(
      `Condition expression "${expression}" could not be parsed. ` +
      `Expected: value <op> <literal>  where op is one of: >=, <=, >, <, ==, !=, includes, !includes, == null, != null`,
    );
  }

  // Parse RHS literal
  const rhs = parseLiteral(rhsStr);

  // Normalise LHS (always the incoming value)
  const lhs = inputValue;

  return compare(lhs, matchedOp, rhs);
}

/** Convert RHS string token to a typed JS value */
function parseLiteral(raw: string): unknown {
  // null / undefined
  if (raw === 'null' || raw === 'undefined') return null;

  // boolean
  if (raw === 'true')  return true;
  if (raw === 'false') return false;

  // number
  const num = Number(raw);
  if (!isNaN(num) && raw !== '') return num;

  // quoted string (single or double)
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }

  // bare word — treat as string
  return raw;
}

/** Execute the comparison */
function compare(lhs: unknown, op: string, rhs: unknown): boolean {
  switch (op) {
    case '==':
      if (rhs === null) return lhs == null;
      return String(lhs).toLowerCase() === String(rhs).toLowerCase();

    case '!=':
      if (rhs === null) return lhs != null;
      return String(lhs).toLowerCase() !== String(rhs).toLowerCase();

    case '>':  return Number(lhs) > Number(rhs);
    case '<':  return Number(lhs) < Number(rhs);
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

// ── Node Executor ─────────────────────────────────────────────────────────────

export async function realCondition(ctx: NodeContext): Promise<NodeExecuteResult> {
  const expression = (ctx.config['expression'] as string | undefined) ?? '';

  if (!expression.trim()) {
    return {
      status: 'failure',
      outputs: {},
      summary: 'Condition node has no expression configured.',
      logs: ['ERROR: expression config is empty'],
    };
  }

  // Resolve input value — prefer `value` port, fall back to first available input
  const inputValue: unknown =
    ctx.inputs?.['value'] ??
    (ctx.inputs ? Object.values(ctx.inputs)[0] : undefined);

  let result: boolean;
  try {
    result = evaluateExpression(expression, inputValue);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 'failure',
      outputs: {},
      summary: msg,
      logs: [`ERROR: ${msg}`],
    };
  }

  const activePath = result ? 'true_path' : 'false_path';

  // Route to the appropriate output handle — only the active path carries the value
  return {
    status: 'success',
    outputs: {
      true_path:  result ? inputValue : null,
      false_path: result ? null       : inputValue,
    },
    summary: `Condition "${expression}" → ${result ? 'TRUE' : 'FALSE'} (routing to ${activePath})`,
    logs: [
      `Expression: ${expression}`,
      `Input value: ${JSON.stringify(inputValue)}`,
      `Result: ${result} → ${activePath}`,
    ],
  };
}
