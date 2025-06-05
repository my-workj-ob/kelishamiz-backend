import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymeAuthInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];

    const merchantId = this.configService.get<string>('PAYME_MERCHANT_ID');
    const apiKey = this.configService.get<string>('PAYME_API_KEY');

    const expectedAuth =
      'Basic ' + Buffer.from(`Paycom:${apiKey}`).toString('base64');

    console.log('\n===== PAYME AUTH DEBUG =====');
    console.log('merchantId:', merchantId);
    console.log('apiKey:', apiKey);
    console.log('expectedAuth:', expectedAuth);
    console.log('receivedAuthHeader:', authHeader);
    console.log('authHeader matches expected?', authHeader === expectedAuth);
    console.log('=============================\n');

    // ❗ Agar noto‘g‘ri bo‘lsa, xatoni JSON-RPC 200 formatida qaytaramiz
    if (!authHeader || authHeader !== expectedAuth) {
      const jsonRpcError = {
        jsonrpc: '2.0',
        error: {
          code: -32504,
          message: {
            uz: 'Avtorizatsiya xatosi',
            ru: 'Ошибка авторизации',
            en: 'Authorization error',
          },
        },
        id: req.body?.id ?? null,
      };

      // ❗ NestJS Response obyektidan foydalanib, 200 statusda jo‘natamiz
      const res = context.switchToHttp().getResponse();
      res.status(200).json(jsonRpcError);
      return throwError(() => null); // ✅ Interceptor ni to‘xtatish
    }

    return next.handle();
  }
}
