/**
 * Re-exports ApiResponse from the shared-types package.
 * Import from here inside the api app so we have a single local alias
 * and can swap the source without touching every controller.
 */
export type { ApiResponse, ApiError } from '@lados/shared-types';
