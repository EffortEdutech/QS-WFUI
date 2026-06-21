import { Controller, Get, UseGuards } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { ApiResponse } from '@lados/shared-types';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface AuthUserPayload {
  id: string;
  email: string | undefined;
  role: string | undefined;
  createdAt: string | undefined;
  lastSignInAt: string | undefined;
}

/**
 * AuthController
 *
 * GET /api/v1/auth/me — returns the authenticated user's profile.
 * This is the primary endpoint used by the frontend to verify
 * that a Supabase session is valid against our API.
 */
@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(SupabaseJwtGuard)
  getMe(@CurrentUser() user: User): ApiResponse<AuthUserPayload> {
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
      },
      error: null,
    };
  }
}
