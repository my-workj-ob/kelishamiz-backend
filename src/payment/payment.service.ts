import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios'; // Agar hali ham ishlatilsa
import { Payment } from './entities/payme.entity';
import { User } from './../auth/entities/user.entity';
import { CreatePaymentDto } from './dto/payme.dto';
import { Logger } from '@nestjs/common'; // Logger qo'shish

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name); // Logger instansiyasi
  private readonly merchantId: string;
  private readonly apiKey: string; // Controllerda ishlatilsa ham, bu yerda ham e'lon qilish mumkin. Lekin to'lov linki uchun kerak emas.

  constructor(
    private configService: ConfigService,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    // Agar announcement yoki profile repository'lari bilan tekshiruv qilishni istasangiz, ularni ham qo'shing:
    // @InjectRepository(Announcement) private announcementRepository: Repository<Announcement>,
    // @InjectRepository(Profile) private profileRepository: Repository<Profile>,
  ) {
    this.merchantId = this.configService.get<string>('PAYME_MERCHANT_ID') ?? '';
    this.apiKey = this.configService.get<string>('PAYME_API_KEY') ?? '';
  }

  async createPayment(
    user_id: number,
    createPaymentDto: CreatePaymentDto,
  ): Promise<string> {
    const {
      announcement_id,
      profile_id,
      amount,
      transaction_type,
      payment_method,
      callback_url,
      from_account,
      // payme_transaction_id - bu yerda undefined bo'ladi, chunki u Payme tomonidan beriladi
    } = createPaymentDto;

    if (!amount || amount <= 0) {
      this.logger.error('Amount is required and must be positive');
      throw new Error('Amount is required and must be positive');
    }

    const user = await this.userRepository.findOne({
      where: { id: user_id },
    });

    if (!user) {
      this.logger.warn(`User with ID ${user_id} not found.`);
      throw new NotFoundException(`User with ID ${user_id} not found`);
    }

    // ✅ Optional: Check Announcement (if exists)
    // Agar announcement_id berilgan bo'lsa va uni tekshirishni istasangiz:
    if (announcement_id) {
      // Hozirda sizning kodingizda `paymentRepository.query` ishlatilgan.
      // Agar sizda alohida `Announcement` entity va repository bo'lsa, undan foydalanish tavsiya etiladi.
      // Masalan:
      // const announcement = await this.announcementRepository.findOne({ where: { id: announcement_id } });
      // if (!announcement) {
      //   this.logger.warn(`Announcement with ID ${announcement_id} not found.`);
      //   throw new NotFoundException(`Announcement with ID ${announcement_id} not found`);
      // }
      // Agar hali `Announcement` entity'ingiz yo'q bo'lsa va faqat kelajakda ishlatish uchun joylashtirayotgan bo'lsangiz,
      // bu tekshiruvni vaqtincha izohda qoldirish yoki soddaroq tekshirish mumkin.
      // Hozircha sizning original kodingizni qoldiraman, lekin to'g'riroq yondashuv - bu alohida repositorydan foydalanish.
      //   try {
      //     const announcementExists = await this.paymentRepository.query(
      //       `SELECT 1 FROM announcement WHERE id = $1`,
      //       [announcement_id],
      //     );
      //     if (!announcementExists || announcementExists.length === 0) {
      //       this.logger.warn(
      //         `Announcement with ID ${announcement_id} not found via direct query.`,
      //       );
      //       throw new NotFoundException(
      //         `Announcement with ID ${announcement_id} not found`,
      //       );
      //     }
      //   } catch (error) {
      //     this.logger.error(
      //       `Error checking announcement with ID ${announcement_id}: ${error.message}`,
      //     );
      //     throw new Error(`Failed to verify announcement: ${error.message}`);
      //   }
    }

    // ✅ Optional: Check Profile (if exists)
    if (profile_id) {
      // Bu yerda ham `ProfileRepository`dan foydalanish tavsiya etiladi
      try {
        const profileExists = await this.paymentRepository.query(
          `SELECT 1 FROM profile WHERE id = $1`,
          [profile_id],
        );
        if (!profileExists || profileExists.length === 0) {
          this.logger.warn(
            `Profile with ID ${profile_id} not found via direct query.`,
          );
          throw new NotFoundException(
            `Profile with ID ${profile_id} not found`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error checking profile with ID ${profile_id}: ${error.message}`,
        );
        throw new Error(`Failed to verify profile: ${error.message}`);
      }
    }

    // ✅ Prepare payment
    const payment = this.paymentRepository.create({
      user_id: Number(user_id), // Number(user_id) qilish shart emas
      announcement_id: announcement_id ?? null,
      profile_id: profile_id ?? null,
      amount,
      amount_in_tiyin: amount * 100,
      status: 'pending',
      transaction_type: transaction_type === 'balance_topup' ? 'in' : 'out',
      payment_method,
      callback_url,
      from_account,
      payme_transaction_id: '', // Payme tomonidan keladi, boshida null bo'ladi
    });

    await this.paymentRepository.save(payment);
    this.logger.log(
      `Payment created with ID: ${payment.id} for user: ${user_id}`,
    );

    // Balansni yangilash bu yerda to'lov amalga oshirilgandan keyin bo'lishi kerak (ya'ni webhookdan keyin)
    // Hozirda yaratilgandan keyin yangilanayotgan ekan, bu holatga qarab to'g'irlash mumkin.
    // Odatda, balans Payme to'lovni tasdiqlab, 'PerformTransaction' webhookini yuborganda yangilanadi.
    // Hozirgi holatda 'pending' to'lov uchun balansni yangilash mantiqiy emas.
    // Shuning uchun, `await this.updateBalance(user_id);` ni `PerformTransaction` ichiga ko'chiring.
    // Agar bu yerda qoldirilsa, foydalanuvchining balansi to'lov tugallanmasdanoq o'zgaradi.
    // Misol uchun, bu yerda balance ni update qilmasdan, PerformTransaction'da qilish kerak.

    const payLink = await this.generatePayLink(
      payment.id,
      payment.amount_in_tiyin,
      user_id, // `user_id` ni `generatePayLink`ga uzatamiz
      announcement_id, // `announcement_id` ni `generatePayLink`ga uzatamiz
      profile_id, // `profile_id` ni `generatePayLink`ga uzatamiz
    );
    this.logger.log(`Payme link generated: ${payLink}`);
    return payLink;
  }

  // updateBalance metodi avvalgidek qoladi, uning chaqiruv joyini to'g'irlash kerak
  async updateBalance(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      this.logger.error(`User with ID ${userId} not found for balance update.`);
      throw new NotFoundException(
        `User with ID ${userId} not found for balance update.`,
      );
    }
    const balance = await this.getBalance(userId);
    user.balance = balance;
    await this.userRepository.save(user);
    this.logger.log(`User ${userId} balance updated to: ${balance}`);
  }

  async getBalance(userId: number): Promise<number> {
    const payments = await this.paymentRepository.find({
      where: { user_id: userId, status: 'completed' }, // Faqat "completed" to'lovlarni hisoblash
    });
    const totalIn = payments
      .filter((p) => p.transaction_type === 'in')
      .reduce((sum, p) => sum + p.amount, 0);
    const totalOut = payments
      .filter((p) => p.transaction_type === 'out')
      .reduce((sum, p) => sum + p.amount, 0);
    return totalIn - totalOut;
  }
  //

  private async generatePayLink(
    paymentId: string,
    amount: number,
    userId: number, // Yangi parametr
    announcementId?: number, // Yangi parametr
    profileId?: number, // Yangi parametr
  ): Promise<string> {
    const paymeId = this.configService.get<string>('PAYME_MERCHANT_ID');
    // `paymeKey` bu yerda kerak emas, uni o'chirdik.
    const paymeUrl = this.configService.get<string>(
      'PAYME_URL',
      'https://checkout.paycom.uz',
    );
    const returnUrl = this.configService.get<string>(
      'RETURN_URL',
      'https://your-return-url.com',
    );

    // Rekvizitlarni dinamik ravishda qo'shamiz
    let accountParams = `ac.order_id=${paymentId}`; // Asosiy order_id

    // User ID ni qo'shamiz
    accountParams += `;ac.user_id=${userId}`;

    // Agar announcementId mavjud bo'lsa, uni qo'shamiz
    if (announcementId) {
      accountParams += `;ac.announcement_id=${announcementId}`;
    }

    // Agar profileId mavjud bo'lsa, uni qo'shamiz
    if (profileId) {
      accountParams += `;ac.profile_id=${profileId}`;
    }

    // Base64 formatida kodlash
    // Format: MERCHANT_ID;ac.order_id=YOUR_ORDER_ID;ac.user_id=...;ac.announcement_id=...;a=AMOUNT_IN_TIYIN;c=RETURN_URL
    const encoded = Buffer.from(
      `${paymeId};${accountParams};a=${amount};c=${returnUrl}`,
    ).toString('base64');

    return `${paymeUrl}/${encoded}`;
  }

  async handleWebhook(data: any): Promise<any> {
    const { method, params, id } = data;
    this.logger.log(`Received Payme webhook: Method=${method}, ID=${id}`);

    switch (method) {
      case 'CheckPerformTransaction':
        const orderIdCheck = params.account.order_id;
        const amountCheck = params.amount;

        if (!orderIdCheck) {
          this.logger.error(
            'CheckPerformTransaction: order_id is missing in params.account',
          );
          return {
            id: id,
            error: {
              code: -31050,
              message: 'Invalid params: order_id missing',
            },
          };
        }

        const paymentCheck = await this.paymentRepository.findOne({
          where: { id: orderIdCheck },
        });

        if (!paymentCheck || paymentCheck.amount_in_tiyin !== amountCheck) {
          this.logger.warn(
            `CheckPerformTransaction: Payment not found or amount mismatch for orderId: ${orderIdCheck}`,
          );
          return {
            id: id,
            error: {
              code: -31003, // Order not found or invalid amount
              message: 'Order not found or invalid amount',
            },
          };
        }
        return {
          id: id,
          result: { allow: true },
        };

      case 'CreateTransaction':
        const orderIdCreate = params.account.order_id;
        const paymeTransactionId = params.id;
        const transactionTime = params.time;

        if (!orderIdCreate || !paymeTransactionId || !transactionTime) {
          this.logger.error(
            'CreateTransaction: Missing required parameters in webhook.',
          );
          return {
            id: id,
            error: {
              code: -31050,
              message: 'Invalid params: missing required fields',
            },
          };
        }

        const paymentCreate = await this.paymentRepository.findOne({
          where: { id: orderIdCreate },
        });

        if (!paymentCreate) {
          this.logger.warn(
            `CreateTransaction: Payment not found for orderId: ${orderIdCreate}`,
          );
          return {
            id: id,
            error: { code: -31003, message: 'Order not found' },
          };
        }

        if (paymentCreate.status !== 'pending') {
          // Tranzaksiya allaqachon yaratilgan yoki bajarilgan bo'lsa
          if (paymentCreate.payme_transaction_id === paymeTransactionId) {
            // Agar bir xil tranzaksiya ID bilan qayta kelgan bo'lsa, xato emas, tasdiqlaymiz
            this.logger.log(
              `CreateTransaction: Duplicate request for existing transaction ${paymeTransactionId}`,
            );
            return {
              id: id,
              result: {
                create_time: paymentCreate.created_at.getTime(),
                transaction: paymentCreate.payme_transaction_id,
                state: paymentCreate.status === 'completed' ? 2 : 1, // Agar bajarilgan bo'lsa 2, aks holda 1
              },
            };
          } else {
            this.logger.warn(
              `CreateTransaction: Invalid state for payment ${orderIdCreate}. Current status: ${paymentCreate.status}`,
            );
            return {
              id: id,
              error: {
                code: -31008,
                message: 'Unable to create transaction: invalid state',
              },
            };
          }
        }

        paymentCreate.payme_transaction_id = paymeTransactionId;
        paymentCreate.status = 'created';
        // Payme'dan kelgan `time` unix timestamp millisekundlarda, `Date` obyekti uni qabul qiladi
        paymentCreate.created_at = new Date(transactionTime);
        await this.paymentRepository.save(paymentCreate);
        this.logger.log(
          `Payment ${orderIdCreate} status updated to 'created'. Payme Transaction ID: ${paymeTransactionId}`,
        );

        return {
          id: id,
          result: {
            create_time: transactionTime,
            transaction: paymeTransactionId,
            state: 1, // Yaratilgan
          },
        };

      case 'PerformTransaction':
        const paymeTransactionIdPerform = params.id;
        const transactionPerformTime = params.time;

        if (!paymeTransactionIdPerform || !transactionPerformTime) {
          this.logger.error(
            'PerformTransaction: Missing required parameters in webhook.',
          );
          return {
            id: id,
            error: {
              code: -31050,
              message: 'Invalid params: missing required fields',
            },
          };
        }

        const paymentPerform = await this.paymentRepository.findOne({
          where: { payme_transaction_id: paymeTransactionIdPerform },
        });

        if (!paymentPerform) {
          this.logger.warn(
            `PerformTransaction: Payment not found for Payme ID: ${paymeTransactionIdPerform}`,
          );
          return {
            id: id,
            error: { code: -31003, message: 'Transaction not found' },
          };
        }

        if (paymentPerform.status === 'completed') {
          this.logger.log(
            `PerformTransaction: Transaction ${paymeTransactionIdPerform} already completed.`,
          );
          return {
            id: id,
            result: {
              perform_time: transactionPerformTime, // Yoki paymentPerform.created_at.getTime() agar saqlagan bo'lsangiz
              transaction: paymeTransactionIdPerform,
              state: 2, // Bajarilgan
            },
          };
        }

        if (paymentPerform.status !== 'created') {
          this.logger.warn(
            `PerformTransaction: Invalid state for transaction ${paymeTransactionIdPerform}. Current status: ${paymentPerform.status}`,
          );
          return {
            id: id,
            error: {
              code: -31008,
              message: 'Transaction cannot be performed: invalid state',
            },
          };
        }

        paymentPerform.status = 'completed'; // Yoki 'topped_up' agar balansni to'ldirish bo'lsa
        await this.paymentRepository.save(paymentPerform);
        this.logger.log(
          `Payment ${paymentPerform.id} status updated to 'completed'.`,
        );

        // BALANSNI YANGILASH FAQAT SHU YERDA BO'LISHI KERAK!
        if (paymentPerform.user_id) {
          // Agar user_id mavjud bo'lsa
          await this.updateBalance(paymentPerform.user_id);
        } else {
          this.logger.error(
            `PerformTransaction: user_id is missing for payment ${paymentPerform.id}. Balance not updated.`,
          );
          // Bu holatda sizning logikangizga qarab xato qaytarishingiz yoki ogohlantirish berishingiz mumkin.
        }

        return {
          id: id,
          result: {
            perform_time: transactionPerformTime,
            transaction: paymeTransactionIdPerform,
            state: 2, // Bajarilgan
          },
        };

      case 'CancelTransaction':
        const paymeTransactionIdCancel = params.id;
        const reasonCode = params.reason; // Payme hujjatlarida int kod bo'lishi kerak

        if (!paymeTransactionIdCancel || typeof reasonCode === 'undefined') {
          this.logger.error(
            'CancelTransaction: Missing required parameters in webhook.',
          );
          return {
            id: id,
            error: {
              code: -31050,
              message: 'Invalid params: missing required fields',
            },
          };
        }

        const paymentCancel = await this.paymentRepository.findOne({
          where: { payme_transaction_id: paymeTransactionIdCancel },
        });

        if (!paymentCancel) {
          this.logger.warn(
            `CancelTransaction: Payment not found for Payme ID: ${paymeTransactionIdCancel}`,
          );
          return {
            id: id,
            error: { code: -31003, message: 'Transaction not found' },
          };
        }

        let newStateForCancel = -1; // Default -1 (Bekor qilingan)
        if (
          paymentCancel.status === 'completed' ||
          paymentCancel.status === 'topped_up'
        ) {
          newStateForCancel = -2; // 2 - bajarilganidan keyin bekor qilingan
          // Balansdan summani olib tashlash logikasi:
          // Agar balansga pul qo'shilgan bo'lsa, uni qaytarib olish kerak.
          // Misol: user.balance -= paymentCancel.amount
          // Bu juda muhim qadam!
          if (
            paymentCancel.user_id &&
            paymentCancel.transaction_type === 'in'
          ) {
            const user = await this.userRepository.findOne({
              where: { id: paymentCancel.user_id },
            });
            if (user) {
              if (typeof user.balance === 'number') {
                user.balance -= paymentCancel.amount; // Asosiy summa (so'mda)
              } else {
                this.logger.error(
                  `User balance is undefined for user ID: ${paymentCancel.user_id}`,
                );
                throw new Error(
                  `User balance is undefined for user ID: ${paymentCancel.user_id}`,
                );
              }
              await this.userRepository.save(user);
              this.logger.log(
                `Balance for user ${paymentCancel.user_id} decreased by ${paymentCancel.amount} due to cancellation.`,
              );
            }
          }
          paymentCancel.status = 'withdrawn'; // statusni o'zgartirish
        } else {
          paymentCancel.status = 'review'; // Yoki 'cancelled'
        }

        paymentCancel.reason = String(reasonCode); // Payme dan kelgan sabab kodini saqlash
        await this.paymentRepository.save(paymentCancel);
        this.logger.log(
          `Payment ${paymentCancel.id} status updated to '${paymentCancel.status}' due to cancellation.`,
        );

        return {
          id: id,
          result: {
            cancel_time: Date.now(),
            transaction: paymeTransactionIdCancel,
            state: newStateForCancel,
          },
        };

      case 'CheckTransaction':
        const paymeTransactionIdCheck = params.id;

        if (!paymeTransactionIdCheck) {
          this.logger.error(
            'CheckTransaction: Missing required parameters in webhook.',
          );
          return {
            id: id,
            error: {
              code: -31050,
              message: 'Invalid params: transaction ID missing',
            },
          };
        }

        const paymentCheckStatus = await this.paymentRepository.findOne({
          where: { payme_transaction_id: paymeTransactionIdCheck },
        });

        if (!paymentCheckStatus) {
          this.logger.warn(
            `CheckTransaction: Payment not found for Payme ID: ${paymeTransactionIdCheck}`,
          );
          return {
            id: id,
            error: { code: -31003, message: 'Transaction not found' },
          };
        }

        let state = 0; // Default holat (topilmadi yoki boshqa)
        let performTime = 0;
        let cancelTime = 0;

        if (
          paymentCheckStatus.status === 'created' ||
          paymentCheckStatus.status === 'pending'
        ) {
          // Pending ham 1 holat
          state = 1;
        } else if (
          paymentCheckStatus.status === 'completed' ||
          paymentCheckStatus.status === 'topped_up'
        ) {
          state = 2;
          performTime = paymentCheckStatus.created_at.getTime(); // Yoki `performed_at` ustunini saqlang
        } else if (
          paymentCheckStatus.status === 'withdrawn' ||
          paymentCheckStatus.status === 'review'
        ) {
          state = -1; // Yoki -2 agar bajarilganidan keyin bekor qilingan bo'lsa
          cancelTime = Date.now(); // Yoki `cancelled_at` ustunini saqlang
        }
        // Payme hujjatlarida `state` qiymatlari aniq berilgan, ularga amal qiling.

        return {
          id: id,
          result: {
            create_time: paymentCheckStatus.created_at.getTime(),
            perform_time: performTime,
            cancel_time: cancelTime,
            transaction: paymeTransactionIdCheck,
            state: state,
            reason: paymentCheckStatus.reason || null,
          },
        };

      default:
        this.logger.error(`Unknown method received in webhook: ${method}`);
        return {
          id: id,
          error: { code: -32601, message: 'Method not found' },
        };
    }
  }
}
