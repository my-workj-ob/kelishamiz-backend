import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transaction/transaction.entity';
import { User } from './../auth/entities/user.entity';
import Redis from 'ioredis';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class PaymeService {
  private readonly logger = new Logger(PaymeService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * Main handler for Payme API requests.
   * @param body JSON-RPC request body
   * @returns JSON-RPC response
   */
  async handlePaymeRequest(body: any): Promise<any> {
    const { method, params, id } = body;
    this.logger.debug(
      `[handlePaymeRequest] Received method: ${method}, Params: ${JSON.stringify(params)}, ID: ${id}`,
    );

    try {
      switch (method) {
        case 'CheckPerformTransaction':
          return this.checkPerformTransaction(params, id);
        case 'CreateTransaction':
          return this.createTransaction(params, id);
        case 'PerformTransaction':
          return this.performTransaction(params, id);
        case 'CancelTransaction':
          return this.cancelTransaction(params, id);
        case 'CheckTransaction':
          return this.checkTransaction(params, id);
        case 'GetStatement':
          return this.createErrorResponse(id, -32601, {
            uz: 'Metod mavjud emas',
            ru: 'Метод не существует',
            en: 'Method not found',
          });
        default:
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
   * Validate transaction before performing.
   */
  async checkPerformTransaction(
    params: any,
    id: string | number,
  ): Promise<any> {
    const startTime = Date.now();
    const userId = this.parseUserId(params.account?.user_id, id);
    if (!userId) {
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

    const user = await this.findUserById(userId, id);
    if (!user) {
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

    const isValidAmount = this.validateAmount(params.amount, id);
    if (!isValidAmount) {
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

    const pendingTransaction = await this.transactionRepo.findOne({
      where: { userId, status: 'pending' },
      select: ['id'],
    });
    this.logger.debug(
      `[CheckPerformTransaction] DB query took ${Date.now() - startTime}ms`,
    );

    if (pendingTransaction) {
      this.logger.warn(
        `[CheckPerformTransaction] User ${userId} has a pending transaction: ${pendingTransaction.id}`,
      );
      return this.createErrorResponse(
        id,
        -31099,
        {
          uz: 'Hisobda kutilayotgan tranzaksiya mavjud',
          ru: 'На счете есть ожидающая транзакция',
          en: 'Account has a pending transaction',
        },
        'account',
      );
    }

    return {
      jsonrpc: '2.0',
      result: { allow: true },
      id,
    };
  }
  /**
   * Create a new transaction.
   */
  async createTransaction(params: any, id: string | number): Promise<any> {
    const startTime = Date.now();
    this.logger.debug(`[CreateTransaction] ID: ${id}`);

    const existingTransaction = await this.transactionRepo.findOne({
      where: { paymeTransactionId: params.id },
      select: ['id', 'status', 'createdAt'],
      relations: ['user'],
    });
    this.logger.debug(
      `[CreateTransaction] Existing transaction check took ${Date.now() - startTime}ms`,
    );

    if (existingTransaction) {
      return this.handleExistingTransaction(existingTransaction, id);
    }

    const userId = this.parseUserId(params.account?.user_id, id);
    if (!userId) {
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

    const pendingTransaction = await this.transactionRepo.findOne({
      where: { userId, status: 'pending' },
      select: ['id'],
    });

    if (pendingTransaction) {
      this.logger.warn(
        `[CreateTransaction] User ${userId} has a pending transaction: ${pendingTransaction.id}`,
      );
      return this.createErrorResponse(
        id,
        -31099,
        {
          uz: 'Hisobda kutilayotgan tranzaksiya mavjud',
          ru: 'На счете есть ожидающая транзакция',
          en: 'Account has a pending transaction',
        },
        'account',
      );
    }

    const user = await this.findUserById(userId, id);
    if (!user) {
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

    const isValidAmount = this.validateAmount(params.amount, id);
    if (!isValidAmount) {
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

    // ok

    const checkResult = await this.checkPerformTransaction(params, id);
    if (checkResult.error) {
      return checkResult;
    }

    const newTransaction = this.transactionRepo.create({
      userId: user.id,
      user,
      paymeTransactionId: params.id,
      amount: params.amount,
      status: 'pending',
      paymeTime: params.time ? new Date(params.time).toISOString() : undefined,
      paymeTimeMs: params.time ? params.time.toString() : undefined,
    });

    const saveStart = Date.now();
    await this.transactionRepo.save(newTransaction);
    this.logger.debug(
      `[CreateTransaction] Transaction ${newTransaction.id} saved in ${Date.now() - saveStart}ms`,
    );

    return {
      jsonrpc: '2.0',
      result: {
        create_time: newTransaction.paymeTimeMs
          ? parseInt(newTransaction.paymeTimeMs)
          : newTransaction.createdAt.getTime(),
        transaction: newTransaction.id.toString(),
        state: 1,
      },
      id,
    };
  }

  /**
   * Check transaction status.
   */
  async checkTransaction(params: any, id: string | number): Promise<any> {
    const cacheKey = `transaction:${params.id}`;
    let transaction: Transaction | null = null;

    const startTime = Date.now();
    const cached = await this.cacheManager.get<string>(cacheKey);
    if (cached) {
      transaction = JSON.parse(cached) as Transaction;
      this.logger.debug(`[CheckTransaction] Cache hit for ${cacheKey}`);
    }

    if (!transaction) {
      transaction = await this.transactionRepo.findOne({
        where: { paymeTransactionId: params.id },
        select: [
          'id',
          'status',
          'createdAt',
          'updatedAt',
          'reason',
          'paymeTimeMs',
        ],
      });
      const queryTime = Date.now() - startTime;

      if (transaction) {
        await this.cacheManager.set(cacheKey, JSON.stringify(transaction), 300);
        this.logger.debug(
          `[CheckTransaction] Cached transaction ${params.id} in ${queryTime}ms`,
        );
      } else {
        this.logger.warn(
          `[CheckTransaction] Transaction with Payme ID ${params.id} not found`,
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
    }

    const state = this.getTransactionState(transaction.status);
    const response = {
      jsonrpc: '2.0',
      result: {
        create_time: transaction.paymeTimeMs
          ? parseInt(transaction.paymeTimeMs)
          : transaction.createdAt.getTime(),
        perform_time:
          transaction.status === 'success'
            ? transaction.updatedAt.getTime()
            : 0,
        cancel_time: ['failed', 'cancelled', 'cancelled_with_revert'].includes(
          transaction.status,
        )
          ? transaction.updatedAt.getTime()
          : 0,
        transaction: transaction.id.toString(),
        state,
        reason: transaction.reason ?? null,
      },
      id,
    };

    this.logger.debug(
      `[CheckTransaction] Response sent in ${Date.now() - startTime}ms`,
    );
    return response;
  }
  /**
   * Perform transaction and update user balance.
   */
  async performTransaction(params: any, id: string | number): Promise<any> {
    const startTime = Date.now();
    const transaction = await this.transactionRepo.findOne({
      where: { paymeTransactionId: params.id },
      relations: ['user'],
      select: ['id', 'status', 'amount', 'updatedAt'],
    });
    this.logger.debug(
      `[PerformTransaction] DB query took ${Date.now() - startTime}ms`,
    );

    if (!transaction) {
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
      ['failed', 'cancelled', 'cancelled_with_revert'].includes(
        transaction.status,
      )
    ) {
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

    if (!transaction.user) {
      this.logger.error(
        `[PerformTransaction] User not found for transaction ${params.id}`,
      );
      return this.createErrorResponse(
        id,
        -32400,
        {
          uz: 'Foydalanuvchi maʼlumotlari yuklanmadi',
          ru: 'Данные пользователя не загружены',
          en: 'User data not loaded',
        },
        'internal_error',
      );
    }

    transaction.user.balance += transaction.amount / 100;
    transaction.status = 'success';

    const saveStart = Date.now();
    await Promise.all([
      this.transactionRepo.save(transaction),
      this.userRepo.save(transaction.user),
    ]);
    this.logger.debug(
      `[PerformTransaction] Save took ${Date.now() - saveStart}ms`,
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
   * Cancel transaction and optionally revert user balance.
   */
  async cancelTransaction(params: any, id: string | number): Promise<any> {
    const startTime = Date.now();
    const transaction = await this.transactionRepo.findOne({
      where: { paymeTransactionId: params.id },
      relations: ['user'],
      select: ['id', 'status', 'amount', 'updatedAt', 'reason'],
    });
    this.logger.debug(
      `[CancelTransaction] DB query took ${Date.now() - startTime}ms`,
    );

    if (!transaction) {
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
      ['failed', 'cancelled', 'cancelled_with_revert'].includes(
        transaction.status,
      )
    ) {
      return this.createResponse(id, {
        transaction: transaction.id.toString(),
        cancel_time: transaction.updatedAt.getTime(),
        state: this.getTransactionState(transaction.status),
      });
    }

    if (transaction.status === 'success') {
      if (!transaction.user) {
        this.logger.error(
          `[CancelTransaction] User not found for transaction ${params.id}`,
        );
        return this.createErrorResponse(
          id,
          -32400,
          {
            uz: 'Foydalanuvchi maʼlumotlari yuklanmadi',
            ru: 'Данные пользователя не загружены',
            en: 'User data not loaded',
          },
          'internal_error',
        );
      }
      transaction.user.balance -= transaction.amount / 100;
      await this.userRepo.save(transaction.user);
      transaction.status = 'cancelled_with_revert';
    } else {
      transaction.status = 'failed';
    }

    transaction.reason = params.reason || null;
    const saveStart = Date.now();
    await this.transactionRepo.save(transaction);
    this.logger.debug(
      `[CancelTransaction] Save took ${Date.now() - saveStart}ms`,
    );

    return this.createResponse(id, {
      transaction: transaction.id.toString(),
      cancel_time: transaction.updatedAt.getTime(),
      state: this.getTransactionState(transaction.status),
    });
  }

  private parseUserId(userId: any, id: string | number): number | null {
    const parsedUserId = userId ? parseInt(userId, 10) : NaN;
    if (isNaN(parsedUserId)) {
      this.logger.error(`[parseUserId] Invalid or missing user_id: ${userId}`);
      return null;
    }
    return parsedUserId;
  }

  /**
   * Helper to find user by ID with caching.
   */
  private async findUserById(
    userId: number,
    id: string | number,
  ): Promise<User | null> {
    const cacheKey = `user:${userId}`;
    let user = await this.cacheManager.get<User>(cacheKey);
    if (!user) {
      user = await this.userRepo.findOne({
        where: { id: userId },
        select: ['id', 'balance'],
      });
      if (user) {
        await this.cacheManager.set(cacheKey, user, 300);
      }
    }
    if (!user) {
      this.logger.warn(`[findUserById] User with ID ${userId} not found`);
      return null;
    }
    return user;
  }

  /**
   * Helper to validate transaction amount.
   */
  private validateAmount(amount: number, id: string | number): boolean {
    const minAmount = 1000;
    const maxAmount = 10000000;
    if (amount < minAmount || amount > maxAmount) {
      this.logger.warn(`[validateAmount] Invalid amount: ${amount}`);
      return false;
    }
    return true;
  }

  /**
   * Helper to handle existing transactions.
   */
  private handleExistingTransaction(
    transaction: Transaction,
    id: string | number,
  ): any {
    const state = this.getTransactionState(transaction.status);
    if (state === 1) {
      return this.createResponse(id, {
        create_time: transaction.createdAt.getTime(),
        transaction: transaction.id.toString(),
        state,
      });
    }
    return this.createErrorResponse(
      id,
      -31008,
      {
        uz: 'Tranzaksiya allaqachon mavjud va yakunlangan',
        ru: 'Транзакция уже существует и завершена',
        en: 'Transaction already exists and is finalized',
      },
      'transaction',
    );
  }

  /**
   * Helper to map transaction status to Payme state.
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
        return -1;
      default:
        return 0;
    }
  }

  /**
   * Helper to create JSON-RPC success response.
   */
  private createResponse(id: string | number | null, result: any): any {
    return {
      jsonrpc: '2.0',
      result,
      id,
    };
  }

  /**
   * Helper to create JSON-RPC error response.
   */
  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: { uz: string; ru: string; en: string },
    data?: string,
  ): any {
    const errorResponse: any = {
      jsonrpc: '2.0',
      error: { code, message },
      id,
    };
    if (data) {
      errorResponse.error.data = data;
    }
    return errorResponse;
  }
}
