/**
 * ApiKeyGuard — Phase 6
 *
 * NestJS guard that authenticates requests via API key.
 * Checks the Authorization header for a Bearer token starting with 'lados_'.
 *
 * On success, attaches a synthetic user object to req.user:
 *   {
 *     id:    `apikey:${keyId}`,   // synthetic user ID
 *     orgId: key.org_id,
 *     role:  key.role,
 *     isApiKey: true,
 *   }
 *
 * Used by ApiKeyOrJwtGuard (composite guard) — tried after JWT fails.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyService } from './api-key.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];

    if (!authHeader?.startsWith('Bearer lados_')) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    const rawKey = authHeader.slice('Bearer '.length);
    const keyRecord = await this.apiKeyService.verify(rawKey);

    if (!keyRecord) {
      throw new UnauthorizedException('API key is invalid, expired, or revoked');
    }

    // Attach synthetic user — same shape downstream services expect for orgId / role
    (req as unknown as Record<string, unknown>)['user'] = {
      id:       `apikey:${keyRecord.id}`,
      orgId:    keyRecord.org_id,
      role:     keyRecord.role,
      isApiKey: true,
    };

    return true;
  }
}
