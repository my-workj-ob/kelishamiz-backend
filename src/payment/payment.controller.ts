import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  UseGuards,
  Req,
  NotFoundException,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreatePaymentDto, TopUpDto, WebhookDto } from './dto/payme.dto';
import { ProfileService } from './../profile/profile.service';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express'; // req obyekti uchun

// Payme xato kodlari uchun enum
enum PaymeErrorCodes {
  Unauthorized = -32504,
  SystemError = -32000, // Umumiy tizim xatosi
}

@ApiTags('Payments') // Swaggerda "Payments" bo‘limi sifatida ko‘rinadi
@ApiBearerAuth()
@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);
  private readonly merchantId: string;
  private readonly apiKey: string;

  constructor(
    private paymentService: PaymentService,
    private profileService: ProfileService,
    private readonly configService: ConfigService, // Inject qilingan
  ) {
    // ConfigService orqali muhit o'zgaruvchilaridan qiymatlarni oling
    this.merchantId = this.configService.get<string>(
      'PAYME_MERCHANT_ID',
      '683c3f4c70e3dcbc596bd119',
    );
    this.apiKey = this.configService.get<string>(
      'PAYME_API_KEY',
      'asot9Zhnv23Knw3x4YwXk%bhQWaNGJSwTxK4',
    );

    // Debug loglar: Ishlab chiqishda foydali, lekin ishlab chiqarishda o'chirilishi kerak
    this.logger.log(
      `Initialized PaymentController with Merchant ID: ${this.merchantId}`,
    );
    this.logger.log(
      `Initialized PaymentController with API Key: ${this.apiKey.substring(0, 5)}...`,
    );
  }

  @Get('balance/:userId')
  @ApiOperation({
    summary: 'Foydalanuvchi balansini olish',
    description: 'Foydalanuvchining umumiy balansini hisoblaydi',
  })
  @ApiResponse({ status: 200, description: 'Balans', type: Number })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi' })
  async getBalance(@Param('userId') userId: number): Promise<number> {
    const existUser = await this.profileService.findByUser(userId);
    if (!existUser) {
      // NotFoundException NestJSning o'rnatilgan exception classidir,
      // bu avtomatik ravishda HTTP 404 javobini qaytaradi.
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }
    return this.paymentService.getBalance(userId);
  }
  @UseGuards(AuthGuard('jwt'))
  @Post('create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Yangi to‘lov yaratish',
    description: 'Payme to‘lov linkini generatsiya qiladi',
  })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({ status: 200, description: 'To‘lov linki', type: String })
  @ApiResponse({ status: 400, description: 'Noto‘g‘ri so‘rov' })
  async createPayment(
    @Body() body: CreatePaymentDto,
    @Req() req: any, // req.user.userId'ga kirish uchun any turi ishlatilgan
  ): Promise<string> {
    const user_id = req.user.userId as number;

    if (!user_id) {
      throw new NotFoundException(
        'Autentifikatsiya qilingan foydalanuvchi topilmadi.',
      );
    }

    return this.paymentService.createPayment(user_id, body);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() data: WebhookDto,
    @Req() req: Request,
  ): Promise<any> {
    // ===== FULL DEBUG LOGGING =====
    this.logger.log('=== WEBHOOK REQUEST DEBUG START ===');
    this.logger.log(`Request Method: ${req.method}`);
    this.logger.log(`Request URL: ${req.url}`);
    this.logger.log(`Request Headers:`, JSON.stringify(req.headers, null, 2));
    this.logger.log(`Request Body:`, JSON.stringify(data, null, 2));
    this.logger.log(`Raw Headers Object:`, req.headers);

    // Check for different header variations
    const authHeaders = [
      req.headers['authorization'],
      req.headers['Authorization'],
      req.headers['AUTHORIZATION'],
    ];

    this.logger.log(`Authorization header variations:`, authHeaders);
    this.logger.log('=== WEBHOOK REQUEST DEBUG END ===');

    const authHeader =
      req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader) {
      this.logger.error('❌ NO AUTHORIZATION HEADER FOUND');
      this.logger.error('Available headers:', Object.keys(req.headers));

      return {
        jsonrpc: '2.0',
        id: data.id,
        error: {
          code: PaymeErrorCodes.Unauthorized,
          message: 'Unauthorized',
          data: 'Authorization header is missing.',
        },
      };
    }

    this.logger.log(`✅ Authorization header found: ${authHeader}`);

    if (typeof authHeader !== 'string' || !authHeader.startsWith('Basic ')) {
      this.logger.error(`❌ Invalid auth header format: ${authHeader}`);
      return {
        jsonrpc: '2.0',
        id: data.id,
        error: {
          code: PaymeErrorCodes.Unauthorized,
          message: 'Unauthorized',
          data: 'Authorization header must start with "Basic ".',
        },
      };
    }

    const base64Credentials = authHeader.split(' ')[1];
    this.logger.log(`Base64 credentials: ${base64Credentials}`);

    let credentials;
    try {
      credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
      this.logger.log(`Decoded credentials: ${credentials}`);
    } catch (e) {
      this.logger.error(`Base64 decode error:`, e);
      return {
        jsonrpc: '2.0',
        id: data.id,
        error: {
          code: PaymeErrorCodes.Unauthorized,
          message: 'Unauthorized',
          data: 'Failed to decode credentials.',
        },
      };
    }

    const [receivedId, receivedKey] = credentials.split(':');
    this.logger.log(`Received ID: ${receivedId}`);
    this.logger.log(`Received Key: ${receivedKey ? 'Present' : 'Missing'}`);

    // Environment values
    this.logger.log(`Expected ID: ${this.merchantId}`);
    this.logger.log(`Expected Key length: ${this.apiKey?.length || 0}`);

    const idMatches = receivedId === this.merchantId;
    const keyMatches = receivedKey === this.apiKey;

    this.logger.log(`ID matches: ${idMatches}`);
    this.logger.log(`Key matches: ${keyMatches}`);

    if (!idMatches || !keyMatches) {
      this.logger.error('❌ Credential mismatch!');
      return {
        jsonrpc: '2.0',
        id: data.id,
        error: {
          code: PaymeErrorCodes.Unauthorized,
          message: 'Unauthorized',
          data: 'Invalid merchant ID or API key.',
        },
      };
    }

    this.logger.log('✅ Authentication successful, delegating to service...');

    try {
      const result = await this.paymentService.handleWebhook(data);
      this.logger.log('✅ Service response:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      this.logger.error(`❌ Service error:`, error);
      return {
        jsonrpc: '2.0',
        id: data.id,
        error: {
          code: PaymeErrorCodes.SystemError,
          message: 'Internal system error.',
          data: error.message,
        },
      };
    }
  }

  @Post('top-up-manual')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Foydalanuvchi balansini qo'lda to'ldirish" })
  @ApiResponse({
    status: 200,
    description: "Balans muvaffaqiyatli to'ldirildi.",
  })
  @ApiResponse({ status: 400, description: "Yaroqsiz so'rov ma'lumotlari." })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi.' })
  @ApiResponse({
    status: 500,
    description: 'Serverda ichki xatolik yuz berdi.',
  })
  async topUpUserBalance(@Body() topUpDto: TopUpDto): Promise<any> {
    const { userId, amountInTiyin } = topUpDto;

    if (amountInTiyin <= 0) {
      throw new BadRequestException('Amount must be positive.');
    }

    try {
      // Serviceni chaqiramiz
      const newBalance = await this.paymentService.topUpUserBalance(
        userId,
        amountInTiyin,
      );
      return {
        message: `Foydalanuvchi ${userId} balansiga ${amountInTiyin / 100} so'm qo'shildi. Yangi balans: ${newBalance / 100} so'm.`,
        userId: userId,
        newBalanceInTiyin: newBalance,
        newBalanceInUZS: newBalance / 100, // So'mda qaytarish
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message); // Foydalanuvchi topilmasa 404 qaytarish
      }
      this.logger.error(
        `Error topping up balance:`,
        error.message,
        error.stack,
      );
      throw new BadRequestException(
        `Balansni to'ldirishda xatolik: ${error.message}`,
      );
    }
  }
}
