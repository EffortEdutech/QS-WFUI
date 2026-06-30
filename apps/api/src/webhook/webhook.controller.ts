/**
 * WebhookController — Phase 5 (Event-Driven Triggers)
 *
 * Public endpoint that receives inbound webhook deliveries and turns them into
 * EventBus events → workflow triggers.
 *
 * Route:  POST /api/v1/webhooks/:orgId/:path
 *
 * No JWT auth — the webhook sender authenticates via HMAC-SHA256 signature.
 *
 * Security:
 *   - X-Lados-Signature: sha256=<hex> HMAC-SHA256 over the raw body using WEBHOOK_SECRET
 *   - Org ID validated against the organizations table
 */

import {
  Controller,
  Post,
  Param,
  Headers,
  Req,
  HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhookService } from './webhook.service';

/**
 * WebhookController — no JWT guard.
 * Authentication is via HMAC-SHA256 (X-Lados-Signature header), not Bearer tokens.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * POST /api/v1/webhooks/:orgId/:path
   *
   * Receives a webhook payload, verifies HMAC, and dispatches to matching workflows.
   * Returns 200 immediately — processing is async and non-blocking.
   */
  @Post(':orgId/:path')
  @HttpCode(200)
  async receive(
    @Param('orgId')  orgId: string,
    @Param('path')   path:  string,
    @Headers('x-lados-signature') signature: string | undefined,
    @Req() req: Request,
  ): Promise<{ received: boolean; eventId: string | null }> {
    // rawBody is populated by the raw-body middleware (see main.ts / app bootstrap)
    // Falls back to JSON.stringify if raw body was not buffered
    const rawBody: Buffer = (req as Request & { rawBody?: Buffer }).rawBody
      ?? Buffer.from(JSON.stringify(req.body ?? {}));

    // Verify HMAC signature
    this.webhookService.verifySignature(rawBody, signature);

    // Parse payload (already parsed by NestJS body middleware)
    const payload = (req.body ?? {}) as Record<string, unknown>;

    return this.webhookService.deliver({ orgId, path, payload });
  }
}
