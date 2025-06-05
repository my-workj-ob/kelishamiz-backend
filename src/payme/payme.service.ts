import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transaction/transaction.entity'; // Yo'lni tekshiring
import { User } from './../auth/entities/user.entity'; // Yo'lni tekshiring

@Injectable()
export class PaymeService {
  private readonly logger = new Logger(PaymeService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  /**
   * Payme API'dan kelgan so'rovlarni asosiy qabul qiluvchi metod.
   * @param body Payme so'rovining JSON tanasi
   * @returns JSON-RPC formatidagi javob
   */
  async handlePaymeRequest(body: any): Promise<any> {
    const { method, params, id } = body;
    this.logger.debug(
      `[handlePaymeRequest] Received method: ${method}, Params: ${JSON.stringify(params)}, ID: ${id}`,
    );

    try {
      switch (method) {
        case 'CheckPerformTransaction':
          return await this.checkPerformTransaction(params, id);
        case 'CreateTransaction':
          return await this.createTransaction(params, id);
        case 'PerformTransaction':
          return await this.performTransaction(params, id);
        case 'CancelTransaction':
          return await this.cancelTransaction(params, id);
        case 'CheckTransaction':
          return await this.checkTransaction(params, id);
        case 'GetStatement':
          this.logger.warn(
            `[handlePaymeRequest] GetStatement method is not implemented.`,
          );
          return this.createErrorResponse(id, -32601, {
            uz: 'Metod mavjud emas',
            ru: 'Метод не существует',
            en: 'Method not found',
          });
        default:
          this.logger.warn(`[handlePaymeRequest] Unknown method: ${method}`);
          return this.createErrorResponse(id, -32601, {
            uz: 'Metod mavjud emas',
            ru: 'Метод не существует',
            en: 'Method not found',
          });
      }
    } catch (error) {
      this.logger.error(
        `[handlePaymeRequest] Error processing method ${method}: ${error.message}`,
        error.stack,
      );
      return this.createErrorResponse(id, -32400, {
        uz: error.message || 'Nomaʼlum xatolik',
        ru: error.message || 'Неизвестная ошибка',
        en: error.message || 'Unknown error',
      });
    }
  }

  /**
   * Tranzaksiyani bajarishdan oldin tekshirish.
   */
  async checkPerformTransaction(
    params: any,
    id: string | number,
  ): Promise<any> {
    this.logger.debug(
      `[CheckPerformTransaction] Request received. Params: ${JSON.stringify(params)}, ID: ${id}`,
    );

    const userId = params.account?.user_id;

    // ✅ userId ni intga aylantirish va NaN bo'lsa xato qaytarish
    const parsedUserId = userId ? parseInt(userId, 10) : NaN;
    if (isNaN(parsedUserId)) {
      this.logger.error(
        `[CheckPerformTransaction] Invalid or missing user_id in account parameters: ${userId}`,
      );
      return this.createErrorResponse(
        id,
        -31001,
        {
          uz: 'Noto‘g‘ri hisob maʼlumotlari (foydalanuvchi IDsi xato)',
          ru: 'Неверные данные счета (неверный ID пользователя)',
          en: 'Invalid account data (invalid user ID)',
        },
        'account',
      );
    }

    const userFindStartTime = Date.now();
    const user = await this.userRepo.findOne({
      where: { id: parsedUserId }, // ✅ Parse qilingan userId'ni ishlatish
    });
    const userFindEndTime = Date.now();
    this.logger.debug(
      `[CheckPerformTransaction] User find took ${userFindEndTime - userFindStartTime}ms.`,
    );

    if (!user) {
      this.logger.warn(
        `[CheckPerformTransaction] User with ID ${parsedUserId} not found.`,
      );
      return this.createErrorResponse(
        id,
        -31050,
        {
          uz: 'Foydalanuvchi topilmadi',
          ru: 'Пользователь не найден',
          en: 'User not found',
        },
        'user_id',
      );
    }

    const minAmount = 1000;
    const maxAmount = 10000000;
    if (params.amount < minAmount || params.amount > maxAmount) {
      this.logger.warn(
        `[CheckPerformTransaction] Invalid amount: ${params.amount}. User ID: ${parsedUserId}`,
      );
      return this.createErrorResponse(
        id,
        -31001,
        {
          uz: 'Noto‘g‘ri summa',
          ru: 'Неверная сумма',
          en: 'Invalid amount',
        },
        'amount',
      );
    }

    this.logger.debug(
      `[CheckPerformTransaction] User found: ${user.id}. Returning allow: true.`,
    );
    return {
      jsonrpc: '2.0',
      result: {
        allow: true,
      },
      id,
    };
  }

  /**
   * Yangi tranzaksiyani yaratish.
   */
  async createTransaction(params: any, id: string | number): Promise<any> {
    this.logger.debug(
      `[CreateTransaction] Params: ${JSON.stringify(params)}, ID: ${id}`,
    );

    const existing = await this.transactionRepo.findOne({
      where: { paymeTransactionId: params.id },
      relations: ['user'],
    });

    if (existing) {
      const state = this.getTransactionState(existing.status);

      // Payme spetsifikatsiyasi bo'yicha idempotensiya:
      // Agar tranzaksiya allaqachon mavjud bo'lsa
      // va uning holati 1 (pending) bo'lsa, xuddi shu natijani qaytaramiz.
      // Agar holati 2 (success) yoki -1/-2 (cancelled) bo'lsa, xato qaytaramiz.
      if (state === 1) {
        this.logger.debug(
          `[CreateTransaction] Transaction ${params.id} already exists and is pending. Returning existing result.`,
        );
        return {
          jsonrpc: '2.0',
          result: {
            create_time: existing.createdAt.getTime(),
            transaction: existing.id.toString(),
            state,
          },
          id,
        };
      } else {
        this.logger.warn(
          `[CreateTransaction] Transaction ${params.id} already exists with status ${existing.status}. Returning -31008.`,
        );
        return this.createErrorResponse(
          id,
          -31008, // Transaction already exists and is finalized
          {
            uz: 'Tranzaksiya allaqachon mavjud va yakunlangan',
            ru: 'Транзакция уже существует и завершена',
            en: 'Transaction already exists and is finalized',
          },
          'transaction',
        );
      }
    }

    // Foydalanuvchini tekshiramiz
    const userId = params.account?.user_id;
    const parsedUserId = userId ? parseInt(userId, 10) : NaN;
    if (isNaN(parsedUserId)) {
      this.logger.error(
        `[CreateTransaction] Invalid or missing user_id in account parameters: ${userId}`,
      );
      return this.createErrorResponse(
        id,
        -31001,
        {
          uz: 'Noto‘g‘ri hisob maʼlumotlari (foydalanuvchi IDsi xato)',
          ru: 'Неверные данные счета (неверный ID пользователя)',
          en: 'Invalid account data (invalid user ID)',
        },
        'account',
      );
    }

    const user = await this.userRepo.findOne({ where: { id: parsedUserId } }); // ✅ Parse qilingan userId'ni ishlatish
    if (!user) {
      this.logger.warn(
        `[CreateTransaction] User with ID ${parsedUserId} not found. Returning -31050.`,
      );
      return this.createErrorResponse(
        id,
        -31050,
        {
          uz: 'Foydalanuvchi topilmadi',
          ru: 'Пользователь не найден',
          en: 'User not found',
        },
        'user_id',
      );
    }

    const newTx = this.transactionRepo.create({
      userId: user.id, // User entiti obyekti emas, balki to'g'ridan-to'g'ri IDni saqlash afzalroq agar DB sxemasida shunday bo'lsa
      // Agar Transaction entitingizda `user: User` (relation) va `userId: number` (foreign key column) ikkalasi ham bo'lsa,
      // va siz user obyektini biriktirmoqchi bo'lsangiz:
      // user: user,
      // Bu holda `userId: user.id` yozish shart emas TypeORM avtomatik ravishda foreign keyni to'ldiradi.
      // Lekin agar Transaction entitingizda faqat `userId` ustuni bo'lsa va `user: User` relationi bo'lmasa,
      // u holda `userId: user.id` to'g'ri.
      paymeTransactionId: params.id,
      amount: params.amount,
      status: 'pending',
      paymeTime: params.time ? new Date(params.time).toISOString() : undefined,
      paymeTimeMs: params.time || undefined,
    });

    const saveStartTime = Date.now();
    await this.transactionRepo.save(newTx);
    const saveEndTime = Date.now();
    this.logger.debug(
      `[CreateTransaction] New transaction saved in ${saveEndTime - saveStartTime}ms. ID: ${newTx.id}`,
    );

    return {
      jsonrpc: '2.0',
      result: {
        create_time: newTx.createdAt.getTime(),
        transaction: newTx.id.toString(),
        state: 1,
      },
      id,
    };
  }

  /**
   * Tranzaksiya holatini tekshirish.
   */
  async checkTransaction(params: any, id: string | number): Promise<any> {
    const startTime = Date.now();

    this.logger.debug(
      `[CheckTransaction] Request received. Params: ${JSON.stringify(params)}, ID: ${id}`,
    );

    try {
      const transactionFindStart = Date.now();
      const transaction = await this.transactionRepo.findOne({
        where: { paymeTransactionId: params.id },
      });
      const transactionFindEnd = Date.now();

      this.logger.debug(
        `[CheckTransaction] Transaction find took ${transactionFindEnd - transactionFindStart}ms.`,
      );

      if (!transaction) {
        this.logger.warn(
          `[CheckTransaction] Transaction with Payme ID ${params.id} not found.`,
        );
        return {
          jsonrpc: '2.0',
          error: {
            code: -31003,
            message: {
              uz: 'Tranzaksiya topilmadi',
              ru: 'Транзакция не найдена',
              en: 'Transaction not found',
            },
            data: 'transaction',
          },
          id,
        };
      }

      const state = this.getTransactionState(transaction.status);

      const response = {
        jsonrpc: '2.0',
        result: {
          create_time: transaction.createdAt.getTime(),
          perform_time:
            transaction.status === 'success'
              ? transaction.updatedAt.getTime()
              : 0,
          cancel_time: [
            'failed',
            'cancelled',
            'cancelled_with_revert',
          ].includes(transaction.status)
            ? transaction.updatedAt.getTime()
            : 0,
          transaction: transaction.id.toString(),
          state,
          reason: transaction.reason ?? null,
        },
        id,
      };

      const endTime = Date.now();
      this.logger.debug(
        `[CheckTransaction] Completed in ${endTime - startTime}ms. Responding with: ${JSON.stringify(response)}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `[CheckTransaction] Internal error: ${error.message}`,
        error.stack,
      );
      return {
        jsonrpc: '2.0',
        error: {
          code: -32400,
          message: {
            uz: 'Ichki server xatosi',
            ru: 'Внутренняя ошибка сервера',
            en: 'Internal server error',
          },
          data: 'server',
        },
        id,
      };
    }
  }

  /**
   * Tranzaksiyani yakunlash va foydalanuvchi balansini yangilash.
   */
  async performTransaction(params: any, id: string | number): Promise<any> {
    this.logger.debug(
      `[PerformTransaction] Request received. Payme ID: ${params.id}, ID: ${id}`,
    );

    const transactionFindStartTime = Date.now();
    const transaction = await this.transactionRepo.findOne({
      where: { paymeTransactionId: params.id },
      relations: ['user'],
    });
    const transactionFindEndTime = Date.now();
    this.logger.debug(
      `[PerformTransaction] Transaction find took ${transactionFindEndTime - transactionFindStartTime}ms.`,
    );

    if (!transaction) {
      this.logger.warn(
        `[PerformTransaction] Transaction with Payme ID ${params.id} not found.`,
      );
      return this.createErrorResponse(
        id,
        -31003,
        {
          uz: 'Tranzaksiya topilmadi',
          ru: 'Транзакция не найдена',
          en: 'Transaction not found',
        },
        'transaction',
      );
    }

    if (transaction.status === 'success') {
      this.logger.debug(
        `[PerformTransaction] Transaction ${params.id} already successful. Returning existing state.`,
      );
      return {
        jsonrpc: '2.0',
        result: {
          transaction: transaction.id.toString(),
          perform_time: transaction.updatedAt.getTime(),
          state: 2,
        },
        id,
      };
    }

    if (
      transaction.status === 'failed' ||
      transaction.status === 'cancelled' ||
      transaction.status === 'cancelled_with_revert'
    ) {
      this.logger.error(
        `[PerformTransaction] Transaction ${params.id} cannot be performed, current status: ${transaction.status}`,
      );
      return this.createErrorResponse(
        id,
        -31008,
        {
          uz: 'Tranzaksiya bajarib bo‘lmaydi',
          ru: 'Невозможно выполнить транзакцию',
          en: 'Cannot perform transaction',
        },
        'transaction',
      );
    }

    const amountInSom = transaction.amount / 100;

    // Balans yangilanishidan oldin foydalanuvchi mavjudligini tekshirish
    if (!transaction.user) {
      this.logger.error(
        `[PerformTransaction] User relation not loaded for transaction ${params.id}.`,
      );
      return this.createErrorResponse(
        id,
        -32400, // Internal error
        {
          uz: 'Foydalanuvchi maʼlumotlari yuklanmadi',
          ru: 'Данные пользователя не загружены',
          en: 'User data not loaded',
        },
        'internal_error',
      );
    }

    transaction.user.balance =
      parseFloat(transaction.user.balance.toString()) + amountInSom;
    this.logger.debug(
      `[PerformTransaction] User ${transaction.user.id} balance updated. Old: ${transaction.user.balance - amountInSom}, New: ${transaction.user.balance}`,
    );

    transaction.status = 'success';

    const saveStartTime = Date.now();
    await this.transactionRepo.save(transaction);
    await this.userRepo.save(transaction.user);
    const saveEndTime = Date.now();
    this.logger.debug(
      `[PerformTransaction] Transaction and user balance saved in ${saveEndTime - saveStartTime}ms.`,
    );

    return {
      jsonrpc: '2.0',
      result: {
        transaction: transaction.id.toString(),
        perform_time: transaction.updatedAt.getTime(),
        state: 2,
      },
      id,
    };
  }

  /**
   * Tranzaksiyani bekor qilish.
   */
  async cancelTransaction(params: any, id: string | number): Promise<any> {
    this.logger.debug(
      `[CancelTransaction] Request received. Payme ID: ${params.id}, ID: ${id}`,
    );

    const transaction = await this.transactionRepo.findOne({
      where: { paymeTransactionId: params.id },
      relations: ['user'],
    });

    if (!transaction) {
      this.logger.warn(
        `[CancelTransaction] Transaction with Payme ID ${params.id} not found.`,
      );
      return this.createErrorResponse(
        id,
        -31003,
        {
          uz: 'Tranzaksiya topilmadi',
          ru: 'Транзакция не найдена',
          en: 'Transaction not found',
        },
        'transaction',
      );
    }

    if (
      transaction.status === 'failed' ||
      transaction.status === 'cancelled' ||
      transaction.status === 'cancelled_with_revert'
    ) {
      this.logger.debug(
        `[CancelTransaction] Transaction ${params.id} already cancelled/failed. State: ${this.getTransactionState(transaction.status)}`,
      );
      return {
        jsonrpc: '2.0',
        result: {
          transaction: transaction.id.toString(),
          cancel_time: transaction.updatedAt.getTime(),
          state: this.getTransactionState(transaction.status),
        },
        id,
      };
    }

    let newState: number; // Use newState instead of immediately assigning -1

    if (transaction.status === 'success') {
      // Only attempt to revert balance if it was previously successful
      if (!transaction.user) {
        this.logger.error(
          `[CancelTransaction] User relation not loaded for transaction ${params.id}. Cannot revert balance.`,
        );
        return this.createErrorResponse(
          id,
          -32400, // Internal error
          {
            uz: 'Foydalanuvchi maʼlumotlari yuklanmadi. Balansni qaytarib bo‘lmadi.',
            ru: 'Данные пользователя не загружены. Не удалось отменить баланс.',
            en: 'User data not loaded. Could not revert balance.',
          },
          'internal_error',
        );
      }
      const amountInSom = transaction.amount / 100;
      transaction.user.balance =
        parseFloat(transaction.user.balance.toString()) - amountInSom;
      this.logger.debug(
        `[CancelTransaction] User ${transaction.user.id} balance reverted. Old: ${transaction.user.balance + amountInSom}, New: ${transaction.user.balance}`,
      );
      await this.userRepo.save(transaction.user);
      newState = -2; // Cancelled with revert
      this.logger.warn(
        `[CancelTransaction] Transaction ${params.id} was successful, but cancelled and balance reverted.`,
      );
    } else {
      // If pending, just set to failed/cancelled without revert
      newState = -1; // Cancelled without revert
      this.logger.debug(
        `[CancelTransaction] Transaction ${params.id} pending status changed to failed.`,
      );
    }

    transaction.status = newState === -2 ? 'cancelled_with_revert' : 'failed';
    transaction.reason = params.reason || null;
    const cancelSaveStartTime = Date.now();
    await this.transactionRepo.save(transaction);
    const cancelSaveEndTime = Date.now();
    this.logger.debug(
      `[CancelTransaction] Transaction ${params.id} status updated in ${cancelSaveEndTime - cancelSaveStartTime}ms. New state: ${newState}`,
    );

    return {
      jsonrpc: '2.0',
      result: {
        transaction: transaction.id.toString(),
        cancel_time: transaction.updatedAt.getTime(),
        state: newState,
      },
      id,
    };
  }

  /**
   * Tranzaksiya holatini Payme kodiga o'tkazuvchi yordamchi funksiya.
   */
  private getTransactionState(status: string): number {
    switch (status) {
      case 'pending':
        return 1;
      case 'success':
        return 2;
      case 'failed':
      case 'cancelled':
      case 'cancelled_with_revert':
        return -1; // Payme API specifies -1 for cancelled, -2 for cancelled with revert. Adjust if your specific Payme spec uses -2.
      default:
        return 0; // Noma'lum holat
    }
  }

  /**
   * JSON-RPC xato javobini yaratish yordamchi funksiyasi.
   */
  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: { uz: string; ru: string; en: string },
    data?: string,
  ): any {
    const errorResponse: any = {
      jsonrpc: '2.0',
      error: {
        code,
        message,
      },
      id,
    };
    if (data) {
      errorResponse.error.data = data;
    }
    return errorResponse;
  }
}
