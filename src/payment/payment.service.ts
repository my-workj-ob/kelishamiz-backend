import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import axios from 'axios'; // Agar hali ham ishlatilsa
import { Payment } from './entities/payme.entity';
import { User } from './../auth/entities/user.entity';
import { CreatePaymentDto } from './dto/payme.dto';
import { Logger } from '@nestjs/common'; // Logger qo'shish

enum PaymeErrorCodes {
  InvalidParams = -31050,
  TransactionNotFound = -31003,
  InvalidState = -31008,
  MethodNotFound = -32601,
  SystemError = -32400, // Custom error code for internal system issues
}
enum PaymentStatus {
  Pending = 'pending',
  Created = 'created',
  Completed = 'completed',
  ToppedUp = 'topped_up', // Assuming this is a valid status for balance top-ups
  Withdrawn = 'withdrawn', // When cancelled after completion
  Review = 'review', // When cancelled before completion or for other reasons
  Cancelled = 'cancelled', // A general cancellation status if 'review' isn't specific enough
}

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
    private readonly dataSource: DataSource,
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
      status: PaymentStatus.Pending,
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
      where: { user_id: userId, status: PaymentStatus.Completed }, // Faqat "completed" to'lovlarni hisoblash
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

    // Centralized helper for creating error responses
    const createErrorResponse = (
      code: PaymeErrorCodes,
      message: string,
      additionalInfo?: object,
    ) => {
      this.logger.error(
        `Payme Webhook Error (ID: ${id}, Method: ${method}): Code=${code}, Message=${message}`,
        additionalInfo,
      );
      return {
        id: id,
        error: {
          code: code,
          message: message,
          ...(additionalInfo && { data: additionalInfo }), // Include additional debug info
        },
      };
    };

    // --- Input Validation: Check essential top-level parameters ---
    if (!method || !id || typeof params !== 'object' || params === null) {
      return createErrorResponse(
        PaymeErrorCodes.InvalidParams,
        'Invalid request structure: Missing method, ID, or params.',
        { receivedData: data },
      );
    }

    try {
      switch (method) {
        case 'CheckPerformTransaction': {
          // --- Input Validation for CheckPerformTransaction ---
          if (
            !params.account ||
            !params.account.order_id ||
            typeof params.amount === 'undefined'
          ) {
            return createErrorResponse(
              PaymeErrorCodes.InvalidParams,
              'Invalid params: order_id or amount missing for CheckPerformTransaction.',
              { receivedParams: params },
            );
          }

          const orderIdCheck = params.account.order_id;
          const amountCheck = params.amount;

          const paymentCheck = await this.paymentRepository.findOne({
            where: { id: orderIdCheck },
          });

          if (
            !paymentCheck ||
            paymentCheck.amount_in_tiyin !== amountCheck ||
            paymentCheck.status !== PaymentStatus.Pending // Only allow pending payments to be checked
          ) {
            this.logger.warn(
              `CheckPerformTransaction: Payment not found, amount mismatch, or invalid status for orderId: ${orderIdCheck}. Current status: ${paymentCheck?.status}`,
            );
            return createErrorResponse(
              PaymeErrorCodes.TransactionNotFound, // Using a generic code as per Payme spec for this case
              'Order not found or invalid amount/status.',
              {
                orderId: orderIdCheck,
                expectedAmount: amountCheck,
                foundPayment: paymentCheck
                  ? {
                      id: paymentCheck.id,
                      amount_in_tiyin: paymentCheck.amount_in_tiyin,
                      status: paymentCheck.status,
                    }
                  : null,
              },
            );
          }
          return {
            id: id,
            result: { allow: true },
          };
        }

        case 'CreateTransaction': {
          // --- Input Validation for CreateTransaction ---
          if (
            !params.account ||
            !params.account.order_id ||
            !params.id ||
            typeof params.time === 'undefined'
          ) {
            return createErrorResponse(
              PaymeErrorCodes.InvalidParams,
              'Missing required parameters for CreateTransaction.',
              { receivedParams: params },
            );
          }

          const orderIdCreate = params.account.order_id;
          const paymeTransactionId = params.id;
          const transactionTime = params.time; // Unix timestamp in milliseconds

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            const paymentCreate = await queryRunner.manager.findOne(
              Payment, // Use the entity class directly
              {
                where: { id: orderIdCreate },
                lock: { mode: 'pessimistic_write' }, // Apply pessimistic write lock
              },
            );

            if (!paymentCreate) {
              await queryRunner.rollbackTransaction();
              return createErrorResponse(
                PaymeErrorCodes.TransactionNotFound,
                'Order not found.',
                { orderId: orderIdCreate },
              );
            }

            if (paymentCreate.status !== PaymentStatus.Pending) {
              // Handle idempotency: If the same Payme transaction ID is sent again, return success
              if (paymentCreate.payme_transaction_id === paymeTransactionId) {
                this.logger.log(
                  `CreateTransaction: Duplicate request for existing transaction ${paymeTransactionId}. Returning existing details.`,
                );
                await queryRunner.rollbackTransaction(); // No changes made, so rollback is safe
                return {
                  id: id,
                  result: {
                    create_time: paymentCreate.created_at.getTime(),
                    transaction: paymentCreate.payme_transaction_id,
                    state:
                      paymentCreate.status === PaymentStatus.Completed ||
                      paymentCreate.status === PaymentStatus.ToppedUp
                        ? 2
                        : 1, // Payme state: 1 for created, 2 for completed
                  },
                };
              } else {
                // Payment is not pending and Payme transaction ID doesn't match
                await queryRunner.rollbackTransaction();
                return createErrorResponse(
                  PaymeErrorCodes.InvalidState,
                  'Unable to create transaction: Invalid state for payment.',
                  {
                    orderId: orderIdCreate,
                    currentStatus: paymentCreate.status,
                    paymeTransactionId: paymeTransactionId,
                  },
                );
              }
            }

            paymentCreate.payme_transaction_id = paymeTransactionId;
            paymentCreate.status = PaymentStatus.Created;
            paymentCreate.created_at = new Date(transactionTime); // Payme `time` is milliseconds

            await queryRunner.manager.save(paymentCreate);
            await queryRunner.commitTransaction();

            this.logger.log(
              `Payment ${orderIdCreate} status updated to '${PaymentStatus.Created}'. Payme Transaction ID: ${paymeTransactionId}`,
            );

            return {
              id: id,
              result: {
                create_time: transactionTime,
                transaction: paymeTransactionId,
                state: 1, // Created
              },
            };
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
              `Error during CreateTransaction for orderId: ${orderIdCreate}`,
              error.stack,
            );
            return createErrorResponse(
              PaymeErrorCodes.SystemError,
              'System error during transaction creation.',
              { message: error.message },
            );
          } finally {
            await queryRunner.release();
          }
        }

        case 'PerformTransaction': {
          // --- Input Validation for PerformTransaction ---
          if (!params.id || typeof params.time === 'undefined') {
            return createErrorResponse(
              PaymeErrorCodes.InvalidParams,
              'Missing required parameters for PerformTransaction.',
              { receivedParams: params },
            );
          }

          const paymeTransactionIdPerform = params.id;
          const transactionPerformTime = params.time;

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            const paymentPerform = await queryRunner.manager.findOne(Payment, {
              where: { payme_transaction_id: paymeTransactionIdPerform },
              lock: { mode: 'pessimistic_write' },
            });

            if (!paymentPerform) {
              await queryRunner.rollbackTransaction();
              return createErrorResponse(
                PaymeErrorCodes.TransactionNotFound,
                'Transaction not found.',
                { paymeTransactionId: paymeTransactionIdPerform },
              );
            }

            if (
              paymentPerform.status === PaymentStatus.Completed ||
              paymentPerform.status === PaymentStatus.ToppedUp
            ) {
              this.logger.log(
                `PerformTransaction: Transaction ${paymeTransactionIdPerform} already completed.`,
              );
              await queryRunner.rollbackTransaction(); // No changes, safe rollback
              return {
                id: id,
                result: {
                  perform_time: paymentPerform.created_at.getTime(), // Use actual created time or stored perform_time
                  transaction: paymeTransactionIdPerform,
                  state: 2, // Completed
                },
              };
            }

            if (paymentPerform.status !== PaymentStatus.Created) {
              await queryRunner.rollbackTransaction();
              return createErrorResponse(
                PaymeErrorCodes.InvalidState,
                'Transaction cannot be performed: invalid state.',
                {
                  paymeTransactionId: paymeTransactionIdPerform,
                  currentStatus: paymentPerform.status,
                },
              );
            }

            // Update payment status
            paymentPerform.status = PaymentStatus.Completed; // Or PaymentStatus.ToppedUp
            // You might want to save a `performed_at` timestamp here if different from `created_at`
            // paymentPerform.performed_at = new Date(transactionPerformTime);
            await queryRunner.manager.save(paymentPerform);

            this.logger.log(
              `Payment ${paymentPerform.id} status updated to '${PaymentStatus.Completed}'.`,
            );

            // --- CRITICAL: Update User Balance within the same transaction ---
            if (paymentPerform.user_id) {
              const user = await this.userRepository.findOne({
                where: { id: paymentPerform.user_id },
              });

              if (!user) {
                // This is a data inconsistency if a user_id is present but the user doesn't exist.
                throw new Error(
                  `User not found for payment ${paymentPerform.id} (user_id: ${paymentPerform.user_id}). Balance update failed.`,
                );
              }
              if (!user) throw new Error('User not found');

              if (typeof user.balance === 'number') {
                user.balance += paymentPerform.amount;
              } else {
                throw new Error(
                  `User balance is not a number for user ID: ${paymentPerform.user_id}.`,
                );
              }

              await queryRunner.manager.save(user);
              this.logger.log(
                `Balance for user ${paymentPerform.user_id} increased by ${paymentPerform.amount}.`,
              );
            } else {
              this.logger.warn(
                `PerformTransaction: user_id is missing for payment ${paymentPerform.id}. Balance not updated.`,
              );
              // Decide if this should be an error returned to Payme based on your business logic.
              // If user_id is mandatory for all top-ups, then throw an error.
            }

            await queryRunner.commitTransaction();

            return {
              id: id,
              result: {
                perform_time: transactionPerformTime,
                transaction: paymeTransactionIdPerform,
                state: 2,
              },
            };
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
              `Error during PerformTransaction for Payme ID: ${paymeTransactionIdPerform}`,
              error.stack,
            );
            return createErrorResponse(
              PaymeErrorCodes.SystemError,
              'System error during transaction performance.',
              { message: error.message },
            );
          } finally {
            await queryRunner.release();
          }
        }

        case 'CancelTransaction': {
          // --- Input Validation for CancelTransaction ---
          if (!params.id || typeof params.reason === 'undefined') {
            return createErrorResponse(
              PaymeErrorCodes.InvalidParams,
              'Missing required parameters for CancelTransaction.',
              { receivedParams: params },
            );
          }

          const paymeTransactionIdCancel = params.id;
          const reasonCode = params.reason; // Payme sends an integer code

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            const paymentCancel = await queryRunner.manager.findOne(Payment, {
              where: { payme_transaction_id: paymeTransactionIdCancel },
              lock: { mode: 'pessimistic_write' },
            });

            if (!paymentCancel) {
              await queryRunner.rollbackTransaction();
              return createErrorResponse(
                PaymeErrorCodes.TransactionNotFound,
                'Transaction not found.',
                { paymeTransactionId: paymeTransactionIdCancel },
              );
            }

            let newStateForCancel: number; // Payme state for cancellation

            // Idempotency: If already cancelled/withdrawn, just return its current state
            if (
              paymentCancel.status === PaymentStatus.Withdrawn ||
              paymentCancel.status === PaymentStatus.Review
            ) {
              this.logger.log(
                `CancelTransaction: Transaction ${paymeTransactionIdCancel} already in a cancelled/review state.`,
              );
              await queryRunner.rollbackTransaction(); // No changes, safe rollback
              newStateForCancel =
                paymentCancel.status === PaymentStatus.Withdrawn ? -2 : -1;
              return {
                id: id,
                result: {
                  cancel_time: Date.now(), // Or paymentCancel.cancelled_at.getTime() if stored
                  transaction: paymeTransactionIdCancel,
                  state: newStateForCancel,
                },
              };
            }

            if (
              paymentCancel.status === PaymentStatus.Completed ||
              paymentCancel.status === PaymentStatus.ToppedUp
            ) {
              newStateForCancel = -2; // Cancelled after completion
              paymentCancel.status = PaymentStatus.Withdrawn;

              // --- CRITICAL: Deduct balance if it was previously topped up ---
              if (
                paymentCancel.user_id &&
                paymentCancel.transaction_type === 'in'
              ) {
                const user = await this.userRepository.findOne({
                  where: { id: paymentCancel.user_id },
                });

                if (!user) {
                  throw new Error(
                    `User not found for payment ${paymentCancel.id} during cancellation (user_id: ${paymentCancel.user_id}).`,
                  );
                }

                if (typeof user.balance === 'number') {
                  // Ensure amount is in the correct currency unit (e.g., UZS)
                  if (user.balance < paymentCancel.amount) {
                    this.logger.error(
                      `CancelTransaction: Insufficient user balance (${user.balance}) to deduct ${paymentCancel.amount} for user ${paymentCancel.user_id}.`,
                    );
                    // This is a serious issue; decide if it should result in a system error or partial success
                    // For now, we'll throw to indicate a critical failure.
                    throw new Error(
                      'Insufficient balance to cancel transaction.',
                    );
                  }
                  user.balance -= paymentCancel.amount;
                } else {
                  throw new Error(
                    `User balance is not a number for user ID: ${paymentCancel.user_id}.`,
                  );
                }
                await queryRunner.manager.save(user);
                this.logger.log(
                  `Balance for user ${paymentCancel.user_id} decreased by ${paymentCancel.amount} due to cancellation.`,
                );
              } else {
                this.logger.warn(
                  `CancelTransaction: No balance adjustment needed for payment ${paymentCancel.id} (user_id: ${paymentCancel.user_id}, type: ${paymentCancel.transaction_type}).`,
                );
              }
            } else if (
              paymentCancel.status === PaymentStatus.Created ||
              paymentCancel.status === PaymentStatus.Pending
            ) {
              // If transaction was created or pending, simply cancel it
              newStateForCancel = -1; // Cancelled before completion
              paymentCancel.status = PaymentStatus.Cancelled; // Or PaymentStatus.Review
            } else {
              // Any other status that shouldn't be cancelled (e.g., already refunded by other means)
              await queryRunner.rollbackTransaction();
              return createErrorResponse(
                PaymeErrorCodes.InvalidState,
                'Transaction cannot be cancelled: invalid state.',
                {
                  paymeTransactionId: paymeTransactionIdCancel,
                  currentStatus: paymentCancel.status,
                },
              );
            }

            paymentCancel.reason = String(reasonCode); // Store the reason code
            // paymentCancel.cancelled_at = new Date(); // Store cancellation time
            await queryRunner.manager.save(paymentCancel);

            await queryRunner.commitTransaction();

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
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
              `Error during CancelTransaction for Payme ID: ${paymeTransactionIdCancel}`,
              error.stack,
            );
            return createErrorResponse(
              PaymeErrorCodes.SystemError,
              'System error during transaction cancellation.',
              { message: error.message },
            );
          } finally {
            await queryRunner.release();
          }
        }

        case 'CheckTransaction': {
          // --- Input Validation for CheckTransaction ---
          if (!params.id) {
            return createErrorResponse(
              PaymeErrorCodes.InvalidParams,
              'Missing required parameter: transaction ID for CheckTransaction.',
              { receivedParams: params },
            );
          }

          const paymeTransactionIdCheck = params.id;

          const paymentCheckStatus = await this.paymentRepository.findOne({
            where: { payme_transaction_id: paymeTransactionIdCheck },
          });

          if (!paymentCheckStatus) {
            return createErrorResponse(
              PaymeErrorCodes.TransactionNotFound,
              'Transaction not found.',
              { paymeTransactionId: paymeTransactionIdCheck },
            );
          }

          let state = 0; // Default: Unknown/Not found (though we found it, but no match to Payme state yet)
          let performTime = 0;
          let cancelTime = 0;

          if (
            paymentCheckStatus.status === PaymentStatus.Created ||
            paymentCheckStatus.status === PaymentStatus.Pending
          ) {
            state = 1; // Created
          } else if (
            paymentCheckStatus.status === PaymentStatus.Completed ||
            paymentCheckStatus.status === PaymentStatus.ToppedUp
          ) {
            state = 2; // Completed
            // Use the actual completion time if stored, otherwise creation time
            performTime = paymentCheckStatus.created_at.getTime(); // Assuming created_at serves as perform_time if separate not exists
            // Or better: paymentCheckStatus.performed_at?.getTime() || 0;
          } else if (
            paymentCheckStatus.status === PaymentStatus.Withdrawn // Cancelled after completion
          ) {
            state = -2;
            cancelTime = Date.now(); // Or paymentCheckStatus.cancelled_at?.getTime() || 0;
          } else if (
            paymentCheckStatus.status === PaymentStatus.Cancelled || // Cancelled before completion
            paymentCheckStatus.status === PaymentStatus.Review // Or any other review state
          ) {
            state = -1;
            cancelTime = Date.now(); // Or paymentCheckStatus.cancelled_at?.getTime() || 0;
          }
          // Note: Payme's `state` values are strict. Ensure your internal statuses map correctly.

          return {
            id: id,
            result: {
              create_time: paymentCheckStatus.created_at.getTime(),
              perform_time: performTime,
              cancel_time: cancelTime,
              transaction: paymeTransactionIdCheck,
              state: state,
              reason: paymentCheckStatus.reason || null, // Ensure reason is stored as string/number and retrieved
            },
          };
        }

        default:
          return createErrorResponse(
            PaymeErrorCodes.MethodNotFound,
            `Unknown method received: ${method}.`,
            { receivedMethod: method },
          );
      }
    } catch (error) {
      // Catch any unexpected errors that were not caught by specific method handlers
      this.logger.error(
        `An unexpected error occurred in handleWebhook for method ${method} (ID: ${id}):`,
        error.stack,
      );
      return createErrorResponse(
        PaymeErrorCodes.SystemError,
        'An unexpected internal system error occurred.',
        { message: error.message },
      );
    }
  }
}
