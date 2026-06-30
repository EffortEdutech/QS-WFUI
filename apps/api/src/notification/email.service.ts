/**
 * EmailService — Phase 10
 *
 * Sends emails via SMTP (Nodemailer).
 * Graceful degradation: if SMTP_HOST env var is not set, logs the email
 * and returns { sent: false } — workflows continue without crashing.
 *
 * Configuration (env vars):
 *   SMTP_HOST      — required to enable real delivery
 *   SMTP_PORT      — default 587
 *   SMTP_USER      — SMTP login username
 *   SMTP_PASS      — SMTP login password
 *   SMTP_FROM      — default sender address  e.g. "Lados <noreply@lados.app>"
 *   SMTP_SECURE    — 'true' for TLS port 465 (default false = STARTTLS)
 *
 * Satisfies IEmailService from @lados/notifications-pack via duck typing.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { EmailPayload, EmailResult } from '@lados/notifications-pack';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transporter: any | null = null;
  private smtpEnabled = false;

  async onModuleInit(): Promise<void> {
    const host = process.env['SMTP_HOST'];
    if (!host) {
      this.logger.warn(
        'EmailService: SMTP_HOST not set — email delivery disabled (stub mode). ' +
        'Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable.',
      );
      return;
    }

    try {
      // Dynamic import so the server boots even if nodemailer is not installed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer') as typeof import('nodemailer');

      const port    = parseInt(process.env['SMTP_PORT'] ?? '587', 10);
      const secure  = process.env['SMTP_SECURE'] === 'true';
      const user    = process.env['SMTP_USER'];
      const pass    = process.env['SMTP_PASS'];

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        ...(user && pass ? { auth: { user, pass } } : {}),
      });

      // Verify connection
      await this.transporter.verify();
      this.smtpEnabled = true;
      this.logger.log(`EmailService: SMTP connected — ${host}:${port}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`EmailService: SMTP setup failed (${msg}) — running in stub mode`);
      this.transporter = null;
      this.smtpEnabled = false;
    }
  }

  async sendEmail(payload: EmailPayload): Promise<EmailResult> {
    const { to, subject, text, html, from, replyTo, cc } = payload;
    const defaultFrom = process.env['SMTP_FROM'] ?? 'Lados <noreply@lados.app>';

    if (!this.smtpEnabled || !this.transporter) {
      this.logger.warn(
        `EmailService (stub): [to=${Array.isArray(to) ? to.join(',') : to}] [subject=${subject}]`,
      );
      return { sent: false, messageId: null, error: 'SMTP not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from:    from ?? defaultFrom,
        to:      Array.isArray(to) ? to.join(', ') : to,
        cc:      cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
        replyTo: replyTo ?? undefined,
        subject,
        text:    text ?? undefined,
        html:    html ?? undefined,
      });

      this.logger.log(`EmailService: sent to ${Array.isArray(to) ? to.join(',') : to} — id:${info.messageId}`);

      return {
        sent:      true,
        messageId: info.messageId ?? null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`EmailService: send failed — ${msg}`);
      return { sent: false, messageId: null, error: msg };
    }
  }
}
