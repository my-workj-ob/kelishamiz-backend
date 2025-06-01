import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'payme_transaction ID',
    example: 'trans123', // Misolni ham stringga o'zgartiring
    required: false,
  })
  payme_transaction_id: string; // number o'rniga string

  @ApiProperty({
    description: 'E‘lon ID',
    example: 456, // Misolni numberga o'zgartiring
    required: false,
  })
  announcement_id: number; // Endi bu ham number

  @ApiProperty({
    description: 'Profil ID',
    example: 789, // Misolni numberga o'zgartiring
    required: false,
  })
  profile_id: number; // Endi bu ham number

  @ApiProperty({ description: 'To‘lov summasi (so‘m)', example: 100000 })
  amount: number;

  @ApiProperty({
    description: 'To‘lov turi',
    example: 'balance_topup',
    enum: ['balance_topup', 'premium_announcement'],
  })
  transaction_type: string;

  @ApiProperty({
    description: 'Kimdan (manba hisobi)',
    example: '90 117 90 90',
    required: false,
  })
  from_account?: string;

  @ApiProperty({
    description: 'Kimga (qabul qiluvchi hisobi)',
    example: '90 117 90 90',
    required: false,
  })
  to_account?: string;

  @ApiProperty({
    description: 'Qaytish URL si',
    example: 'https://your-site.com/success',
    required: false,
  })
  callback_url?: string;

  @ApiProperty({
    description: 'To‘lov holati', // Bu yerda xato ketgan, status ikkinchi marta DTO'da bor. Birini o'chirish kerak.
    example: 'pending',
    enum: [
      'pending',
      'created',
      'completed',
      'topped_up',
      'withdrawn',
      'review',
    ],
    required: false, // Bu maydon service tomonidan o'rnatiladi, DTO'da majburiy emas.
  })
  status?:
    | 'pending'
    | 'created'
    | 'completed'
    | 'topped_up'
    | 'withdrawn'
    | 'review';

  @ApiProperty({
    description: 'To‘lov usuli',
    example: 'payme_card',
    enum: ['payme_card', 'click_uzcard', 'humo'],
    required: false,
  })
  payment_method?: 'payme_card' | 'click_uzcard' | 'humo';
}
export class WebhookDto {
  id: string; // Add the 'id' property to match the usage in the controller
  // Define other properties here
  @ApiProperty({
    description: 'Payme metod nomi',
    example: 'CheckPerformTransaction',
    enum: [
      'CheckPerformTransaction',
      'CreateTransaction',
      'PerformTransaction',
    ],
  })
  method: string;

  @ApiProperty({
    description: 'Payme so‘rov parametrlari',
    type: 'object',
    additionalProperties: true,
    example: {
      account: { order_id: 'uuid-1234-5678' },
      amount: 1000000, // tiyinda
      transaction: 'trans123',
    },
  })
  params: any;
}
