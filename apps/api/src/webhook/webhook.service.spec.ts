/**
 * PD-2 — WebhookService HMAC signature verification tests.
 * These lock in the current behaviour ahead of the PD-3 hardening work
 * (per-org secrets, reject-on-missing-rawBody).
 */
import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookService } from './webhook.service';

const SECRET = 'test-webhook-secret';

function sign(body: Buffer, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function makeService(secret: string | undefined): WebhookService {
  const config = { get: jest.fn().mockReturnValue(secret) };
  // eventBus and supabase are not touched by verifySignature
  return new WebhookService(config as never, {} as never, {} as never);
}

describe('WebhookService.verifySignature', () => {
  const body = Buffer.from(JSON.stringify({ event: 'invoice.submitted', amount: 100 }));

  it('accepts a valid HMAC-SHA256 signature', () => {
    const svc = makeService(SECRET);
    expect(() => svc.verifySignature(body, sign(body, SECRET))).not.toThrow();
  });

  it('rejects a missing signature header', () => {
    const svc = makeService(SECRET);
    expect(() => svc.verifySignature(body, undefined)).toThrow(UnauthorizedException);
  });

  it('rejects a signature without the sha256= prefix', () => {
    const svc = makeService(SECRET);
    const raw = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    expect(() => svc.verifySignature(body, raw)).toThrow(UnauthorizedException);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const svc = makeService(SECRET);
    expect(() => svc.verifySignature(body, sign(body, 'wrong-secret'))).toThrow(UnauthorizedException);
  });

  it('rejects a signature over a tampered body', () => {
    const svc = makeService(SECRET);
    const tampered = Buffer.from(JSON.stringify({ event: 'invoice.submitted', amount: 999999 }));
    expect(() => svc.verifySignature(tampered, sign(body, SECRET))).toThrow(UnauthorizedException);
  });

  it('rejects signatures of the wrong length (constant-time compare guard)', () => {
    const svc = makeService(SECRET);
    expect(() => svc.verifySignature(body, 'sha256=abcd')).toThrow(UnauthorizedException);
  });

  it('skips verification when WEBHOOK_SECRET is unset (documented dev-only behaviour)', () => {
    // PD-3 will change this to reject in production — this test documents today.
    const svc = makeService(undefined);
    expect(() => svc.verifySignature(body, undefined)).not.toThrow();
  });
});
