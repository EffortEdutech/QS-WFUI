/**
 * notification.send_sms
 *
 * Sends an SMS to a phone number via the injected SmsService.
 * In Phase 10 the SmsService is a log-only stub (no external SMS provider
 * is configured). Wire a real provider (Twilio, MSG91, etc.) in SmsService
 * by setting the appropriate env vars.
 *
 * Inputs:
 *   to       — E.164 phone number e.g. '+60123456789' (required)
 *   message  — SMS text body (required; max 160 chars per segment)
 *   from     — sender ID override (optional)
 *
 * Outputs:
 *   sent        — boolean
 *   messageId   — provider message ID or null
 *   to          — resolved recipient number
 *
 * Phase 10
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { ISmsService } from '../types';

export async function realSendSms(
  ctx: NodeContext,
  smsService?: ISmsService,
): Promise<NodeExecuteResult> {
  if (!smsService) {
    return {
      status: 'failure',
      outputs: { sent: false, messageId: null, to: null },
      error: { code: 'NO_SERVICE', message: 'SmsService not injected' },
    };
  }

  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const to      = (inp['to']      ?? cfg['to'])      as string | undefined;
  const message = (inp['message'] ?? cfg['message']) as string | undefined;
  const from    = (inp['from']    ?? cfg['from'])    as string | undefined;

  if (!to) {
    return {
      status: 'failure',
      outputs: { sent: false, messageId: null, to: null },
      error: { code: 'MISSING_INPUT', message: 'notification.send_sms: to is required' },
    };
  }
  if (!message) {
    return {
      status: 'failure',
      outputs: { sent: false, messageId: null, to },
      error: { code: 'MISSING_INPUT', message: 'notification.send_sms: message is required' },
    };
  }

  ctx.logger.info(`notification.send_sms → ${to} | message length: ${message.length}`);

  if (message.length > 160) {
    ctx.logger.warn(`notification.send_sms: message exceeds 160 chars (${message.length}) — will be split by carrier`);
  }

  const result = await smsService.sendSms({ to, message, from });

  if (!result.sent) {
    ctx.logger.warn(`notification.send_sms: delivery failed — ${result.error ?? 'unknown error'}`);
  }

  return {
    status:  result.sent ? 'success' : 'failure',
    outputs: {
      sent:      result.sent,
      messageId: result.messageId ?? null,
      to,
    },
    ...(result.sent ? {} : {
      error: { code: 'SMS_FAILED', message: result.error ?? 'SMS delivery failed' },
    }),
    summary: result.sent ? `SMS sent to ${to}` : `SMS failed to ${to}: ${result.error}`,
  };
}
