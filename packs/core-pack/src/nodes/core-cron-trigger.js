"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realCronTrigger = realCronTrigger;
function describeCron(expr) {
    if (!expr)
        return 'Invalid cron expression';
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5)
        return expr;
    const [min, hour, dom, month, dow] = parts;
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (expr === '* * * * *')
        return 'Every minute';
    if (expr.match(/^\d+ \* \* \* \*$/))
        return `Every hour at :${min.padStart(2, '0')}`;
    if (expr.match(/^\d+ \d+ \* \* \*$/))
        return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    if (expr.match(/^\d+ \d+ \* \* \d+$/))
        return `Every ${dowNames[parseInt(dow, 10)] ?? dow} at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    if (dom === '*' && month !== '*')
        return `Monthly (month ${monthNames[parseInt(month, 10)] ?? month}) at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    return `Cron: ${expr}`;
}
async function realCronTrigger(ctx) {
    const cronExpression = (ctx.config['cron_expression'] ?? '').trim();
    const timezone = (ctx.config['timezone'] ?? 'Asia/Kuala_Lumpur').trim();
    const description = (ctx.config['description'] ?? '').trim();
    if (!cronExpression) {
        return {
            status: 'failure',
            outputs: {},
            logs: [],
            error: {
                code: 'MISSING_CRON_EXPRESSION',
                message: 'cron_expression config is required. Example: "0 8 * * 1-5" (weekdays at 08:00).',
            },
        };
    }
    const triggeredAt = new Date().toISOString();
    const readable = describeCron(cronExpression);
    ctx.logger.info(`Cron trigger fired — ${cronExpression} (${timezone})`);
    ctx.logger.info(`Schedule: ${readable}`);
    ctx.logger.info(`Triggered at: ${triggeredAt}`);
    if (description) {
        ctx.logger.info(`Description: ${description}`);
    }
    const summary = description
        ? `Cron triggered: ${description} [${readable}]`
        : `Cron triggered: ${readable}`;
    return {
        status: 'success',
        outputs: {
            triggered_at: triggeredAt,
            cron_expression: cronExpression,
            timezone,
            schedule_label: readable,
        },
        logs: [],
        summary,
    };
}
//# sourceMappingURL=core-cron-trigger.js.map