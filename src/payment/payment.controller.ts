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
import { ProfileService } from './../profile/profile.service';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
// Define specific Payme error codes for clarity
enum PaymeErrorCodes {
  Unauthorized = -32504,
  SystemError = -32000, // Generic system error
}
@ApiTags('Payments') // Swaggerda "Payments" bo‘limi sifatida ko‘rinadi
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
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
    this.merchantId =
      this.configService.get<string>('683c3f4c70e3dcbc596bd119') ??
      '683c3f4c70e3dcbc596bd119';
    this.apiKey =
      this.configService.get<string>('asot9Zhnv23Knw3x4YwXk%bhQWaNGJSwTxK4') ??
      'asot9Zhnv23Knw3x4YwXk%bhQWaNGJSwTxK4'; // Shu yerda API_KEY olinadi
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
      throw new Error('Foydalanuvchi ID kiritilmagan');
    }
    return this.paymentService.getBalance(userId);
  }

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
  @HttpCode(HttpStatus.OK) // Payme expects 200 OK for successful responses (even errors in RPC format)
  @ApiOperation({
    summary: "Payme webhook so'rovlarini qayta ishlash",
    description:
      "Payme'dan kelgan webhook so'rovlarini avtorizatsiya qiladi va boshqaradi.",
  })
  @ApiBody({ type: WebhookDto })
  @ApiResponse({
    status: 200,
    description:
      'Webhook muvaffaqiyatli qayta ishlandi (JSON-RPC javobi qaytariladi).',
  })
  @ApiResponse({
    status: 401,
    description: 'Avtorizatsiya muvaffaqiyatsiz tugadi.',
  }) // Use 401 for HTTP Unauthorized
  async handleWebhook(
    @Body() data: WebhookDto,
    @Req() req: Request, // Request obyektini qabul qilish
  ): Promise<any> {
    // Log Payme'dan kelgan so'rov ID'si va metodi
    this.logger.log(
      `Received Payme webhook request. Method: ${data.method}, ID: ${data.id}`,
    );

    // --- Authentication ---
    const authHeader = req.headers['authorization'];

    // For debugging during development, you can temporarily log configured credentials.
    // Ensure these logs are removed or secured in production environments.
    console.log(
      `DEBUG: Configured Merchant ID: ${this.merchantId}, API Key: ${this.apiKey.substring(0, 5)}...`,
    ); // Log partial API key

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      this.logger.warn(
        `Webhook authentication failed: Missing or invalid Authorization header.`,
      );
      // Return Payme's expected RPC error format for unauthorized access
      return {
        jsonrpc: '2.0',
        id: data.id,
        error: {
          code: PaymeErrorCodes.Unauthorized, // Payme's specific error code for unauthorized
          message: 'Unauthorized',
          data: 'Invalid Authorization header format.',
        },
      };
    }

    const base64Credentials = authHeader.split(' ')[1];
    let credentials;
    try {
      credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    } catch (e) {
      this.logger.error(
        `Webhook authentication failed: Base64 decoding error.`,
        e.stack,
      );
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

    // For debugging received credentials (use with caution in production)
    console.log(
      `DEBUG: Received Credentials - ID: ${receivedId}, Key: ${receivedKey?.substring(0, 5)}...`,
    );

    if (receivedId !== this.merchantId || receivedKey !== this.apiKey) {
      this.logger.error(
        `Webhook authentication failed: Invalid credentials. Provided ID: ${receivedId}, Key: ${receivedKey ? 'Provided' : 'Not Provided'}.`,
      );
      // Return Payme's expected RPC error format for invalid credentials
      return {
        jsonrpc: '2.0',
        id: data.id, // Payme so'rovining ID'si
        error: {
          code: PaymeErrorCodes.Unauthorized,
          message: 'Unauthorized',
          data: 'Invalid merchant ID or API key.',
        },
      };
    }

    // --- Delegate to Service ---
    try {
      // Autentifikatsiya muvaffaqiyatli o'tgandan so'ng, so'rovni service'ga yuboring
      const result = await this.paymentService.handleWebhook(data);
      return result; // Service'dan kelgan JSON-RPC javobini qaytaring
    } catch (error) {
      // Service'dan kelgan istisnolarni Payme kutadigan RPC formatiga o'tkazing
      this.logger.error(
        `Error processing webhook in PaymeWebhookService: ${error.message}`,
        error.stack,
      );

      // Try to extract the specific error code and message from the service layer
      // Assuming service errors are structured similar to: { error: { code, message, data } }
      const errorCode =
        error.response?.error?.code || PaymeErrorCodes.SystemError;
      const errorMessage =
        error.response?.error?.message || 'Internal system error.';
      const errorData = error.response?.error?.data || error.message;

      return {
        jsonrpc: '2.0',
        id: data.id,
        error: {
          code: errorCode,
          message: errorMessage,
          data: errorData,
        },
      };
    }
  }
}
