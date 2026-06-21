import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiResponse } from '@lados/shared-types';

/**
 * Global HTTP exception filter.
 * Converts all exceptions to the standard ApiResponse envelope.
 *
 * { success: false, data: null, error: { code, message } }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = Array.isArray(resp['message'])
          ? (resp['message'] as string[]).join(', ')
          : String(resp['message'] ?? message);
      }

      code = HttpStatus[status] ?? code;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body: ApiResponse<null> = {
      success: false,
      data: null,
      error: {
        code,
        message,
        details: {
          path: request.url,
          method: request.method,
          timestamp: new Date().toISOString(),
        },
      },
    };

    response.status(status).json(body);
  }
}
