import { Controller, Get } from '@nestjs/common';
import type { ApiResponse } from '@lados/shared-types';

interface HealthData {
  status: string;
  version: string;
  timestamp: string;
  sprint: string;
}

/**
 * Health check endpoint.
 *
 * GET /api/v1/health
 * → { success: true, data: { status: 'ok', version: '0.1.0', ... }, error: null }
 *
 * S1-003 — Sprint 1 foundation.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): ApiResponse<HealthData> {
    return {
      success: true,
      data: {
        status: 'ok',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        sprint: 'Sprint 1 — Monorepo Skeleton',
      },
      error: null,
    };
  }
}
