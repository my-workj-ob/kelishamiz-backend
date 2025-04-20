/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// src/common/interceptors/response.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    return next.handle().pipe(
      map((data: any) => {
        // Agar `success` mavjud bo‘lsa, demak bu xatolik yoki custom response — tegmaslik kerak
        if (typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Aks holda default success:true bilan o‘rash
        return {
          success: true,
          message: 'Request successful',
          ...data,
        };
      }),
    );
  }
}
