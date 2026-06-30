/**
 * Notifications Pack — Type Catalogue (Phase 10)
 *
 * Service interfaces and data shapes for the Notifications Pack.
 * These are domain interfaces satisfied by NestJS services via structural
 * (duck) typing — no NestJS imports in this pack.
 *
 * Three channels:
 *   notification.send_email    — SMTP email (via EmailService)
 *   notification.send_sms      — SMS (via SmsService stub)
 *   notification.send_in_app   — In-app notification (via NotificationService)
 */

// ── NotificationType (kept in sync with NotificationService) ─────────────────

export type NotificationType =
  | 'approval_request'
  | 'execution_complete'
  | 'execution_failed'
  | 'data_pack_update'
  | 'quota_warning'
  | 'system';

// ── Email ─────────────────────────────────────────────────────────────────────

export interface EmailPayload {
  /** One or more recipient email addresses */
  to:       string | string[];
  subject:  string;
  /** Plain-text body (required if html not provided) */
  text?:    string;
  /** HTML body (optional; takes precedence over text) */
  html?:    string;
  /** Override sender; defaults to SMTP_FROM env var */
  from?:    string;
  /** Reply-to address */
  replyTo?: string;
  /** CC addresses */
  cc?:      string | string[];
}

export interface EmailResult {
  sent:      boolean;
  messageId: string | null;
  error?:    string;
}

/** Minimal interface — NestJS EmailService satisfies this via duck typing. */
export interface IEmailService {
  sendEmail(payload: EmailPayload): Promise<EmailResult>;
}

// ── SMS ───────────────────────────────────────────────────────────────────────

export interface SmsPayload {
  /** E.164 format e.g. '+60123456789' */
  to:      string;
  message: string;
  /** Override sender ID; defaults to SMS_FROM env var */
  from?:   string;
}

export interface SmsResult {
  sent:      boolean;
  messageId: string | null;
  error?:    string;
}

/** Minimal interface — NestJS SmsService satisfies this via duck typing. */
export interface ISmsService {
  sendSms(payload: SmsPayload): Promise<SmsResult>;
}

// ── In-app ────────────────────────────────────────────────────────────────────

export interface InAppPayload {
  userId:    string;
  title:     string;
  message?:  string;
  type?:     NotificationType;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InAppResult {
  sent:           boolean;
  notificationId: string | null;
  error?:         string;
}

/** Minimal interface — NestJS NotificationService satisfies this via duck typing. */
export interface IInAppNotificationService {
  notify(payload: {
    userId:    string;
    orgId?:    string;
    type:      NotificationType;
    title:     string;
    body?:     string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null>;
}
