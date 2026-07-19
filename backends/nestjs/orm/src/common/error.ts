// Ерөнхий error хэлбэржүүлэлт — contract-т заасан ErrorResponse-той таарна.

import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';

export type ErrorCode =
  | 'validation_error'
  | 'invalid_token'
  | 'forbidden'
  | 'not_found'
  | 'internal'
  | 'conflict';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, code, message } = this.classify(exception);

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status).json(message ? { error: code, message } : { error: code });
  }

  private classify(exception: unknown): { status: number; code: ErrorCode; message?: string } {
    if (exception instanceof BadRequestException) {
      return { status: 400, code: 'validation_error', message: this.pickMessage(exception) };
    }
    if (exception instanceof UnauthorizedException) {
      return { status: 401, code: 'invalid_token', message: this.pickMessage(exception) };
    }
    if (exception instanceof ForbiddenException) {
      return { status: 403, code: 'forbidden', message: this.pickMessage(exception) };
    }
    if (exception instanceof NotFoundException) {
      return { status: 404, code: 'not_found', message: this.pickMessage(exception) };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code: ErrorCode = status === HttpStatus.CONFLICT ? 'conflict' : 'internal';
      return { status, code, message: this.pickMessage(exception) };
    }
    return { status: 500, code: 'internal' };
  }

  private pickMessage(exception: HttpException): string | undefined {
    const payload = exception.getResponse();
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const m = (payload as { message: unknown }).message;
      if (typeof m === 'string') return m;
      if (Array.isArray(m) && m.length > 0) return m.join('; ');
    }
    return exception.message;
  }
}
