import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
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
    this.logger.log(
      `Received Payme webhook in service: Method=${method}, ID=${id}`,
    );

    // Centralized helper for creating error responses for Payme RPC format
    const createErrorResponse = (
      code: PaymeErrorCodes,
      message: string,
      additionalInfo?: object,
    ) => {
      this.logger.error(
        `Payme Service Error (ID: ${id}, Method: ${method}): Code=${code}, Message=${message}`,
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
          if (
            !params.account ||
            !params.account.order_id ||
            typeof params.amount === 'undefined' ||
            typeof params.amount !== 'number' // Ensure amount is a number
          ) {
            return createErrorResponse(
              PaymeErrorCodes.InvalidParams,
              'Invalid params: order_id or amount missing/invalid for CheckPerformTransaction.',
              { receivedParams: params },
            );
          }

          const orderIdCheck = params.account.order_id;
          const amountCheck = params.amount;

          const paymentCheck = await this.paymentRepository.findOne({
            where: { id: orderIdCheck },
          });

          // Check if payment exists, amount matches, and status is pending (as expected before creating a transaction)
          if (
            !paymentCheck ||
            paymentCheck.amount_in_tiyin !== amountCheck ||
            paymentCheck.status !== PaymentStatus.Pending
          ) {
            this.logger.warn(
              `CheckPerformTransaction: Payment not found, amount mismatch, or invalid status for orderId: ${orderIdCheck}. Current status: ${paymentCheck?.status || 'N/A'}.`,
            );
            return createErrorResponse(
              PaymeErrorCodes.TransactionNotFound, // Payme's generic code for "Order not found or invalid amount/service"
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
            !params.id ||
            typeof params.time === 'undefined' ||
            typeof params.time !== 'number' ||
            typeof params.amount === 'undefined' ||
            typeof params.amount !== 'number'
          ) {
            return createErrorResponse(
              PaymeErrorCodes.InvalidParams,
              'Missing or invalid required parameters for CreateTransaction.',
              { receivedParams: params },
            );
          }

          const account = params.account;
          const paymeTransactionId = params.id;
          const transactionTime = params.time;
          const amount = params.amount;

          // Account parametrlarini tekshirish
          let orderId: number | undefined;
          let userId: number | undefined;

          if (account.order_id) {
            orderId = parseInt(account.order_id.toString());
          } else if (account.user_id) {
            userId = parseInt(account.user_id.toString());
          } else {
            return createErrorResponse(
              PaymeErrorCodes.InvalidParams,
              'Invalid account: Neither order_id nor user_id provided.',
              { receivedAccount: account },
            );
          }

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            let paymentCreate: Payment | null = null;

            if (orderId) {
              paymentCreate = await queryRunner.manager.findOne(Payment, {
                where: { id: orderId.toString() },
                lock: { mode: 'pessimistic_write' },
              });
            } else if (userId) {
              paymentCreate = await queryRunner.manager.findOne(Payment, {
                where: {
                  user_id: userId,
                  amount_in_tiyin: amount,
                  status: PaymentStatus.Pending,
                },
                lock: { mode: 'pessimistic_write' },
              });
            }

            if (!paymentCreate) {
              await queryRunner.rollbackTransaction();
              return createErrorResponse(
                PaymeErrorCodes.TransactionNotFound,
                'Order not found.',
                { orderId: orderId, userId: userId },
              );
            }

            // --- Existing transaction check ---
            const existingTransaction = await queryRunner.manager.findOne(
              Payment,
              {
                where: { payme_transaction_id: paymeTransactionId },
              },
            );

            if (existingTransaction) {
              await queryRunner.rollbackTransaction();
              this.logger.log(
                `CreateTransaction: Transaction ${paymeTransactionId} already exists. Returning existing details.`,
              );
              return {
                id: id,
                result: {
                  create_time: existingTransaction.created_at.getTime(),
                  transaction: paymeTransactionId,
                  state:
                    existingTransaction.status === PaymentStatus.Completed
                      ? 2
                      : 1,
                },
              };
            }

            // --- State validation ---
            if (paymentCreate.status !== PaymentStatus.Pending) {
              await queryRunner.rollbackTransaction();
              return createErrorResponse(
                PaymeErrorCodes.InvalidState,
                'Payment is not in pending state.',
                {
                  orderId: orderId,
                  userId: userId,
                  currentStatus: paymentCreate.status,
                },
              );
            }

            // Update payment
            paymentCreate.payme_transaction_id = paymeTransactionId;
            paymentCreate.status = PaymentStatus.Created;
            paymentCreate.created_at = new Date(transactionTime);

            await queryRunner.manager.save(paymentCreate);
            await queryRunner.commitTransaction();

            this.logger.log(
              `Payment ${paymentCreate.id} status updated to 'Created'. Payme Transaction ID: ${paymeTransactionId}`,
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
              `Error during CreateTransaction: ${error.message}`,
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
          if (
            !params.id ||
            typeof params.time === 'undefined' ||
            typeof params.time !== 'number'
          ) {
            return createErrorResponse(
              PaymeErrorCodes.InvalidParams,
              'Missing or invalid required parameters for PerformTransaction.',
              { receivedParams: params },
            );
          }

          const paymeTransactionIdPerform = params.id;
          const transactionPerformTime = params.time;

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            // Find payment and lock it
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

            // --- Idempotency Check ---
            if (
              paymentPerform.status === PaymentStatus.Completed ||
              paymentPerform.status === PaymentStatus.ToppedUp
            ) {
              this.logger.log(
                `PerformTransaction: Transaction ${paymeTransactionIdPerform} already completed.`,
              );
              await queryRunner.rollbackTransaction(); // No changes needed, safe rollback
              return {
                id: id,
                result: {
                  // Use the actual completion time if you store a `performed_at` column
                  perform_time: paymentPerform.created_at.getTime(),
                  transaction: paymeTransactionIdPerform,
                  state: 2, // Completed
                },
              };
            }

            // --- State Validation ---
            if (paymentPerform.status !== PaymentStatus.Created) {
              this.logger.warn(
                `PerformTransaction: Invalid state for transaction ${paymeTransactionIdPerform}. Current status: ${paymentPerform.status}. Expected '${PaymentStatus.Created}'.`,
              );
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

            // Update payment status to completed
            paymentPerform.status = PaymentStatus.Completed; // Or PaymentStatus.ToppedUp
            // Consider adding a `performed_at` timestamp here: paymentPerform.performed_at = new Date(transactionPerformTime);
            await queryRunner.manager.save(paymentPerform);

            this.logger.log(
              `Payment ${paymentPerform.id} status updated to '${PaymentStatus.Completed}'.`,
            );

            // --- CRITICAL: Update User Balance within the same transaction ---
            if (paymentPerform.user_id) {
              const user = await queryRunner.manager.findOne(User, {
                where: { id: paymentPerform.user_id },
                lock: { mode: 'pessimistic_write' },
              });

              if (!user) {
                // This indicates a severe data inconsistency if user_id is present but user record is missing.
                throw new Error(
                  `User not found for payment ${paymentPerform.id} (user_id: ${paymentPerform.user_id}). Balance update failed.`,
                );
              }

              if (typeof user.balance === 'number') {
                user.balance += paymentPerform.amount; // Ensure `paymentPerform.amount` is in the correct unit (e.g., UZS)
              } else {
                // This indicates a data type issue with the user's balance
                throw new Error(
                  `User balance is not a number for user ID: ${paymentPerform.user_id}. Cannot update balance.`,
                );
              }

              await queryRunner.manager.save(user); // Save updated user balance
              this.logger.log(
                `Balance for user ${paymentPerform.user_id} increased by ${paymentPerform.amount}. New balance: ${user.balance}.`,
              );
            } else {
              this.logger.warn(
                `PerformTransaction: user_id is missing for payment ${paymentPerform.id}. Balance not updated. This might be expected for non-user-related payments.`,
              );
              // If user_id is always expected for top-ups, consider this an error and throw.
            }

            await queryRunner.commitTransaction(); // Commit all changes if successful

            return {
              id: id,
              result: {
                perform_time: transactionPerformTime,
                transaction: paymeTransactionIdPerform,
                state: 2, // Completed
              },
            };
          } catch (error) {
            await queryRunner.rollbackTransaction(); // Rollback on any error
            this.logger.error(
              `Error during PerformTransaction for Payme ID: ${paymeTransactionIdPerform}.`,
              error.stack,
            );
            return createErrorResponse(
              PaymeErrorCodes.SystemError,
              'System error during transaction performance.',
              {
                message: error.message,
                paymeTransactionId: paymeTransactionIdPerform,
              },
            );
          } finally {
            await queryRunner.release(); // Always release the query runner
          }
        }

        case 'CancelTransaction': {
          // --- Input Validation for CancelTransaction ---
          if (
            !params.id ||
            typeof params.reason === 'undefined' ||
            typeof params.reason !== 'number' // Reason should be an integer
          ) {
            return createErrorResponse(
              PaymeErrorCodes.InvalidParams,
              'Missing or invalid required parameters for CancelTransaction.',
              { receivedParams: params },
            );
          }

          const paymeTransactionIdCancel = params.id;
          const reasonCode = params.reason; // Payme sends an integer code

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            // Find payment and lock it
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

            // --- Idempotency Check for Cancellation ---
            if (
              paymentCancel.status === PaymentStatus.Withdrawn ||
              paymentCancel.status === PaymentStatus.Review ||
              paymentCancel.status === PaymentStatus.Cancelled
            ) {
              this.logger.log(
                `CancelTransaction: Transaction ${paymeTransactionIdCancel} already in a cancelled/review state. Returning current state.`,
              );
              await queryRunner.rollbackTransaction(); // No changes needed
              newStateForCancel =
                paymentCancel.status === PaymentStatus.Withdrawn ? -2 : -1;
              return {
                id: id,
                result: {
                  cancel_time: Date.now(), // Or `paymentCancel.cancelled_at.getTime()` if you store it
                  transaction: paymeTransactionIdCancel,
                  state: newStateForCancel,
                },
              };
            }

            // --- Handle Cancellation Logic based on current status ---
            if (
              paymentCancel.status === PaymentStatus.Completed ||
              paymentCancel.status === PaymentStatus.ToppedUp
            ) {
              newStateForCancel = -2; // Cancelled after completion
              paymentCancel.status = PaymentStatus.Withdrawn; // Update payment status

              // --- CRITICAL: Deduct balance if it was previously topped up ---
              if (
                paymentCancel.user_id &&
                paymentCancel.transaction_type === 'in'
              ) {
                const user = await queryRunner.manager.findOne(User, {
                  where: { id: paymentCancel.user_id },
                  lock: { mode: 'pessimistic_write' },
                });

                if (!user) {
                  throw new Error(
                    `User not found for payment ${paymentCancel.id} during cancellation (user_id: ${paymentCancel.user_id}). Balance deduction failed.`,
                  );
                }

                if (typeof user.balance === 'number') {
                  // Ensure sufficient balance for deduction to prevent negative balance
                  if (user.balance < paymentCancel.amount) {
                    this.logger.error(
                      `CancelTransaction: Insufficient user balance (${user.balance}) to deduct ${paymentCancel.amount} for user ${paymentCancel.user_id}.`,
                    );
                    throw new Error(
                      'Insufficient balance to perform cancellation (deduction).',
                    );
                  }
                  user.balance -= paymentCancel.amount; // Deduct the amount
                } else {
                  throw new Error(
                    `User balance is not a number for user ID: ${paymentCancel.user_id}. Cannot deduct balance.`,
                  );
                }
                await queryRunner.manager.save(user); // Save updated user balance
                this.logger.log(
                  `Balance for user ${paymentCancel.user_id} decreased by ${paymentCancel.amount} due to cancellation. New balance: ${user.balance}.`,
                );
              } else {
                this.logger.warn(
                  `CancelTransaction: No balance adjustment needed for payment ${paymentCancel.id} (user_id: ${paymentCancel.user_id}, type: ${paymentCancel.transaction_type}). This payment might not involve a user balance top-up.`,
                );
              }
            } else if (
              paymentCancel.status === PaymentStatus.Created ||
              paymentCancel.status === PaymentStatus.Pending
            ) {
              // If transaction was created or pending, simply cancel it without balance deduction
              newStateForCancel = -1; // Cancelled before completion
              paymentCancel.status = PaymentStatus.Cancelled; // Or PaymentStatus.Review based on your system
            } else {
              // Any other unhandled status for cancellation (e.g., already refunded via another channel)
              this.logger.warn(
                `CancelTransaction: Attempted to cancel transaction ${paymeTransactionIdCancel} in unexpected state: ${paymentCancel.status}.`,
              );
              await queryRunner.rollbackTransaction();
              return createErrorResponse(
                PaymeErrorCodes.InvalidState,
                'Transaction cannot be cancelled: invalid state for cancellation.',
                {
                  paymeTransactionId: paymeTransactionIdCancel,
                  currentStatus: paymentCancel.status,
                  reasonCode: reasonCode,
                },
              );
            }

            paymentCancel.reason = String(reasonCode); // Store the reason code
            // paymentCancel.cancelled_at = new Date(); // You might want to store the cancellation timestamp
            await queryRunner.manager.save(paymentCancel); // Save updated payment status

            await queryRunner.commitTransaction(); // Commit all changes

            this.logger.log(
              `Payment ${paymentCancel.id} status updated to '${paymentCancel.status}' due to cancellation (Payme ID: ${paymeTransactionIdCancel}).`,
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
            await queryRunner.rollbackTransaction(); // Rollback on error
            this.logger.error(
              `Error during CancelTransaction for Payme ID: ${paymeTransactionIdCancel}.`,
              error.stack,
            );
            return createErrorResponse(
              PaymeErrorCodes.SystemError,
              'System error during transaction cancellation.',
              {
                message: error.message,
                paymeTransactionId: paymeTransactionIdCancel,
              },
            );
          } finally {
            await queryRunner.release(); // Always release the query runner
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

          let state = 0; // Default state (unknown, though we found it)
          let performTime = 0;
          let cancelTime = 0;

          // Map internal statuses to Payme's expected state values
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
            // Use the stored completion time if available, otherwise creation time
            performTime = paymentCheckStatus.created_at.getTime(); // Assuming created_at serves as perform_time if separate not exists
            // Or better: paymentCheckStatus.performed_at?.getTime() || paymentCheckStatus.created_at.getTime();
          } else if (paymentCheckStatus.status === PaymentStatus.Withdrawn) {
            state = -2; // Cancelled after completion
            cancelTime = Date.now(); // Or `paymentCheckStatus.cancelled_at?.getTime()` if you store it
          } else if (
            paymentCheckStatus.status === PaymentStatus.Cancelled ||
            paymentCheckStatus.status === PaymentStatus.Review
          ) {
            state = -1; // Cancelled before completion or under review
            cancelTime = Date.now(); // Or `paymentCheckStatus.cancelled_at?.getTime()`
          }
          // Ensure all possible `paymentCheckStatus.status` values map to a Payme `state`.

          return {
            id: id,
            result: {
              create_time: paymentCheckStatus.created_at.getTime(),
              perform_time: performTime,
              cancel_time: cancelTime,
              transaction: paymeTransactionIdCheck,
              state: state,
              reason:
                paymentCheckStatus.reason !== null
                  ? Number(paymentCheckStatus.reason)
                  : null, // Ensure reason is returned as number if it's stored as string
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
        `An unexpected error occurred in PaymeWebhookService for method ${method} (ID: ${id}):`,
        error.stack,
      );
      return createErrorResponse(
        PaymeErrorCodes.SystemError,
        'An unexpected internal system error occurred.',
        { message: error.message },
      );
    }
  }

  async topUpUserBalance(
    userId: number,
    amountInTiyin: number,
  ): Promise<number> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Foydalanuvchini topish va qulflash (konkurentlik muammolarini oldini olish uchun)
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' }, // Yozish uchun qulflash
      });

      if (!user) {
        throw new NotFoundException(`Foydalanuvchi ID ${userId} topilmadi.`);
      }

      // 2. Balansni yangilash
      user.balance += amountInTiyin / 100; // Tiyinlarni so'mga o'girib qo'shish

      await queryRunner.manager.save(user);

      // 3. To'lov yozuvini yaratish (agar kerak bo'lsa)
      // Bu qism Payme orqali kelmagan, balki ichki to'ldirish bo'lgani uchun
      // oddiy Payment yozuvini yaratishingiz mumkin.
      const payment = new Payment();
      payment.user_id = user.id;
      payment.amount_in_tiyin = amountInTiyin;
      payment.status = PaymentStatus.Completed; // To'g'ridan-to'g'ri completed
      payment.transaction_type = 'in'; // Kiruvchi to'lov
      payment.created_at = new Date();
      payment.updated_at = new Date();
      // payment.payme_transaction_id = 'MANUAL_TOPUP_' + Date.now(); // Agar Payme ID ga o'xshash unique ID kerak bo'lsa
      // payment.reason = 'Manual balance top-up'; // Sabab

      await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction(); // Tranzaksiyani yakunlash

      this.logger.log(
        `Foydalanuvchi ${userId} balansiga ${amountInTiyin / 100} so'm qo'shildi. Yangi balans: ${user.balance} so'm.`,
      );

      return user.balance * 100; // Yangi balansni tiyinlarda qaytarish
    } catch (error) {
      await queryRunner.rollbackTransaction(); // Xato bo'lsa, tranzaksiyani orqaga qaytarish
      this.logger.error(
        `Error topping up balance for user ${userId}:`,
        error.message,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error; // controllerda tutish uchun
      }
      throw new InternalServerErrorException(
        `Balansni to'ldirishda ichki xatolik yuz berdi: ${error.message}`,
      );
    } finally {
      await queryRunner.release(); // QueryRunner'ni bo'shatish
    }
  }
}
