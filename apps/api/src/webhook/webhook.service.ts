/**
 * WebhookService — Phase 5 (Event-Driven Triggers)
 *
 * Handles HMAC-SHA256 signature verification for inbound webhooks.
 *
 * Signature format (compatible with GitHub, Stripe, and most modern webhook senders):
 *   X-Lados-Signature: sha256=<hex>
 *
 * The shared secret is read from the WEBHOOK_SECRET env var.
 * If the env var is not set, signature verification is SKIPPED and a warning is
 * logged — useful for local dev but should never be the case in production.
 *
 * After verification, the service publishes a synthetic event of type
 * 'webhook.<path>' to the EventBus. Any workflow that was published with a
 * WebhookTrigger for that path will have a matching subscription and will be
 * triggered automatically via dispatchSubscriptions().
 *
 * AI guardrail: webhook delivery triggers a workflow run but never directly
 * approves, certifies, releases payment, or creates a final commercial fact.
 * Those actions still require a core.human_approval node within the triggered workflow.
 */

import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EventBusService } from '../event-bus/event-bus.service';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly config:   ConfigService,
    private readonly eventBus: EventBusService,
    private readonly supabase: SupabaseService,
  ) {}

  // ── HMAC verification ─────────────────────────────────────────────────────

  /**
   * Verify the X-Lados-Signature header against the raw request body.
   *
   * @param rawBody  The raw Buffer body from the request (must NOT be JSON.parsed first)
   * @param signature  Value of X-Lados-Signature header, e.g. 'sha256=abc123…'
   * @throws UnauthorizedException if the signature is missing or invalid
   */
  verifySignature(rawBody: Buffer, signature: string | undefined): void {
    const secret = this.config.get<string>('WEBHOOK_SECRET');

    if (!secret) {
      this.logger.warn(
        'WEBHOOK_SECRET is not set — skipping signature verification (unsafe for production)',
      );
      return;
    }

    if (!signature) {
      throw new UnauthorizedException('Missing X-Lados-Signature header');
    }

    const prefix = 'sha256=';
    if (!signature.startsWith(prefix)) {
      throw new UnauthorizedException('X-Lados-Signature must be prefixed with "sha256="');
    }

    const provided = signature.slice(prefix.length);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const providedBuf = Buffer.from(provided,  'hex');
    const expectedBuf = Buffer.from(expected,  'hex');

    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  // ── Delivery ──────────────────────────────────────────────────────────────

  /**
   * Process an authenticated webhook delivery.
   *
   * 1. Verify the org exists.
   * 2. Publish a synthetic 'webhook.<path>' event to the EventBus.
   * 3. EventBus dispatchSubscriptions() fires any matching workflow subscriptions.
   *
   * @returns The published event id (or null on EventBus failure — non-fatal)
   */
  async deliver(params: {
    orgId:   string;
    path:    string;
    payload: Record<string, unknown>;
  }): Promise<{ received: boolean; eventId: string | null }> {
    const { orgId, path, payload } = params;

    // Validate the org exists
    const { data: org } = await this.supabase.admin
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .maybeSingle();

    if (!org) {
      throw new BadRequestException(`Organization ${orgId} not found`);
    }

    const eventType = `webhook.${path}`;

    const event = await this.eventBus.publish({
      orgId,
      type:       eventType,
      sourceType: 'system',
      sourceId:   path,
      actorId:    'webhook',
      payload,
    });

    this.logger.log(
      `Webhook delivered: ${eventType} → org ${orgId} (event=${event?.id ?? 'null'})`,
    );

    return { received: true, eventId: event?.id ?? null };
  }
}
