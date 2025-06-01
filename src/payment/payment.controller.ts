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
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreatePaymentDto, WebhookDto } from './dto/payme.dto';
import { ProfileService } from 'src/profile/profile.service';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@ApiTags('Payments') // Swaggerda "Payments" bo‘limi sifatida ko‘rinadi
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
    this.merchantId = this.configService.get<string>('PAYME_MERCHANT_ID') ?? '';
    this.apiKey = this.configService.get<string>('PAYME_API_KEY') ?? ''; // Shu yerda API_KEY olinadi
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
    if (existUser) {
      throw new Error('Foydalanuvchi ID kiritilmagan');
    }
    return this.paymentService.getBalance(userId);
  }

  @ApiBearerAuth()
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
    @Req() req: any,
  ): Promise<string> {
    const user_id = req.user.userId as number;

    if (!user_id) {
      throw new NotFoundException('Foydalanuvchi ID kiritilmagan');
    }

    return this.paymentService.createPayment(user_id, body);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Payme webhook so‘rovlarni qayta ishlash',
    description: 'Payme dan kelgan webhook so‘rovlarini boshqaradi',
  })
  @ApiBody({ type: WebhookDto })
  @ApiResponse({
    status: 200,
    description: 'Webhook muvaffaqiyatli qayta ishlandi',
  })
  @ApiResponse({ status: 400, description: 'Noto‘g‘ri webhook so‘rovi' })
  async handleWebhook(
    @Body() data: WebhookDto,
    @Req() req: Request,
  ): Promise<any> {
    const authHeader = req.headers['authorization'];
    console.log(this.merchantId, this.apiKey);
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      this.logger.warn('Webhook: Missing or invalid Authorization header.')
      console.log(this.merchantId, this.apiKey);;
      throw new UnauthorizedException('Unauthorized'); // Yoki Payme ning -32504 xato kodi
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString(
      'utf8',
    );
    const [id, key] = credentials.split(':');

    // Bu yerda sizning merchantId va apiKey o'zgaruvchilaringiz Payme'dan olingan
    // Sandbox kalitlariga mos kelishi kerak.
    console.log(this.merchantId, this.apiKey);
    this.logger.log(
      `Webhook: Received credentials - ID: ${id}, Key: ${key}`,
    );
    this.logger.log(
      `Webhook: Configured credentials - Merchant ID: ${this.merchantId}, API Key: ${this.apiKey}`,
    );
    
    
    if (id !== this.merchantId || key !== this.apiKey) {
      this.logger.error(
        `Webhook: Invalid credentials. Provided ID: ${id}, Key: ${key}`,
      );
      throw new UnauthorizedException('Unauthorized'); // Yoki Payme ning -32504 xato kodi
    }
    // ... qolgan logika
  }
}
