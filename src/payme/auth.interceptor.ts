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

    const merchantId =
      this.configService.get<string>('PAYME_MERCHANT_ID') ||
      '683c3f4c70e3dcbc596bd119';
    const apiKey =
      this.configService.get<string>('PAYME_API_KEY') ||
      'asot9Zhnv23Knw3x4YwXk%bhQWaNGJSwTxK4';

    const expectedAuth =
      'Basic ' + Buffer.from(`Paycom:${apiKey}`).toString('base64');

    console.log('\n===== PAYME AUTH DEBUG =====');
    console.log('merchantId:', merchantId);
    console.log('apiKey:', apiKey);
    console.log('expectedAuth:', expectedAuth);
    console.log('receivedAuthHeader:', authHeader);
    console.log('authHeader matches expected?', authHeader === expectedAuth);
    console.log('=============================\n');

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

      const res = context.switchToHttp().getResponse();
      res.status(200).json(jsonRpcError);
      return throwError(() => null); 
    }

    return next.handle();
  }
}
