import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.url;

    const rawPaths = [
      '/webhook',
      '/callback',
      '/payment/notify',
      '/auth/check-phone',
    ];

    return next.handle().pipe(
      map((data: unknown) => {
        if (typeof data === 'object' && data !== null && 'success' in data) {
          return data as Record<string, unknown>;
        }

        if (rawPaths.includes(path)) {
          return data;
        }

        return {
          success: true,
          message: 'Request successful',
          content: data,
        };
      }),
    );
  }
}
