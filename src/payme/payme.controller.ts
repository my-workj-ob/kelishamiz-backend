import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  HttpCode,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PaymeService } from './payme.service';
import { PaymeAuthInterceptor } from './auth.interceptor';

@UseInterceptors(PaymeAuthInterceptor)
@Controller('payme')
export class PaymeController {
  constructor(private readonly paymeService: PaymeService) {}

  @Post()
  @HttpCode(200)
  async handlePaymeRequest(@Body() body: any, @Res() res: Response) {
    const { method, params, id } = body;

    let response;

    switch (method) {
      case 'CheckPerformTransaction':
        response = await this.paymeService.checkPerformTransaction(params, id);
        break;
      case 'CreateTransaction':
        response = await this.paymeService.createTransaction(params);
        break;
      case 'PerformTransaction':
        response = await this.paymeService.performTransaction(params, id);
        break;
      case 'CancelTransaction':
        response = await this.paymeService.cancelTransaction(params, id);
        break;
      case 'CheckTransaction': // bu metodni ham qo'shing
        return this.paymeService.checkTransaction(params, id);
      default:
        response = {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: {
              uz: 'Metod topilmadi',
              ru: 'Метод не найден',
              en: 'Method not found',
            },
          },
          id,
        };
    }

    res.status(200).json(response);
  }
}
