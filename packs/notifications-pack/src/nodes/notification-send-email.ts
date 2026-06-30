/**
 * notification.send_email
 *
 * Sends an email to one or more recipients via the injected EmailService.
 * EmailService uses SMTP (Nodemailer). If SMTP_HOST is not configured the
 * service logs the email and returns sent=false (graceful degradation).
 *
 * Inputs (prefer node inputs; fall back to config):
 *   to        — recipient(s) comma-separated or array (required)
 *   subject   — email subject (required)
 *   body      — plain-text body (required if html not provided)
 *   html      — HTML body (optional; overrides body when both provided)
 *   from      — sender override (optional)
 *   replyTo   — reply-to address (optional)
 *   cc        — CC address(es) comma-separated (optional)
 *
 * Outputs:
 *   sent        — boolean
 *   messageId   — SMTP message ID or null
 *   recipients  — resolved to[] as array
 *
 * Phase 10
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IEmailService } from '../types';

function toArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

export async function realSendEmail(
  ctx: NodeContext,
  emailService?: IEmailService,
): Promise<NodeExecuteResult> {
  if (!emailService) {
    return {
      status: 'failure',
      outputs: { sent: false, messageId: null, recipients: [] },
      error: { code: 'NO_SERVICE', message: 'EmailService not injected' },
    };
  }

  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const to      = inp['to']      ?? cfg['to'];
  const subject = (inp['subject'] ?? cfg['subject']) as string | undefined;
  const body    = (inp['body']    ?? cfg['body'])    as string | undefined;
  const html    = (inp['html']    ?? cfg['html'])    as string | undefined;
  const from    = (inp['from']    ?? cfg['from'])    as string | undefined;
  const replyTo = (inp['replyTo'] ?? cfg['replyTo']) as string | undefined;
  const cc      = inp['cc']      ?? cfg['cc'];

  const recipients = toArray(to);

  if (!recipients.length) {
    return {
      status: 'failure',
      outputs: { sent: false, messageId: null, recipients: [] },
      error: { code: 'MISSING_INPUT', message: 'notification.send_email: to is required' },
    };
  }
  if (!subject) {
    return {
      status: 'failure',
      outputs: { sent: false, messageId: null, recipients },
      error: { code: 'MISSING_INPUT', message: 'notification.send_email: subject is required' },
    };
  }
  if (!body && !html) {
    return {
      status: 'failure',
      outputs: { sent: false, messageId: null, recipients },
      error: { code: 'MISSING_INPUT', message: 'notification.send_email: body or html is required' },
    };
  }

  ctx.logger.info(
    `notification.send_email → ${recipients.join(', ')} | subject: "${subject}"`,
  );

  const result = await emailService.sendEmail({
    to:      recipients,
    subject,
    text:    body,
    html,
    from,
    replyTo,
    cc:      toArray(cc),
  });

  if (!result.sent) {
    ctx.logger.warn(`notification.send_email: delivery failed — ${result.error ?? 'unknown error'}`);
  }

  return {
    status:  result.sent ? 'success' : 'failure',
    outputs: {
      sent:       result.sent,
      messageId:  result.messageId ?? null,
      recipients,
    },
    ...(result.sent ? {} : {
      error: { code: 'EMAIL_FAILED', message: result.error ?? 'Email delivery failed' },
    }),
    summary: result.sent
      ? `Email sent to ${recipients.join(', ')}: "${subject}"`
      : `Email failed: ${result.error}`,
  };
}
