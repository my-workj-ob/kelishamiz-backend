import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transaction/transaction.entity';
import { User } from './../auth/entities/user.entity';

@Injectable()
export class PaymeService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // 1. CheckPerformTransaction
  async checkPerformTransaction(params: any, id: string | number) {
    const user = await this.userRepo.findOne({
      where: { id: params.account.user_id },
    });

    if (!user) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -31050,
          message: {
            uz: 'Foydalanuvchi topilmadi',
            ru: 'Пользователь не найден',
            en: 'User not found',
          },
          data: 'user_id',
        },
        id,
      };
    }

    return {
      jsonrpc: '2.0',
      result: {
        allow: true,
      },
      id,
    };
  }

  // 2. CreateTransaction
  async createTransaction(params: any) {
    const existingByPaymeId = await this.transactionRepo.findOne({
      where: { paymeTransactionId: params.id },
    });

    // Agar mavjud bo‘lsa, qaytariladi
    if (existingByPaymeId) {
      return {
        jsonrpc: '2.0',
        result: {
          create_time: existingByPaymeId.createdAt.getTime(),
          transaction: existingByPaymeId.id.toString(),
          state: this.getTransactionState(existingByPaymeId.status),
        },
        id: params.id,
      };
    }

    // Agar boshqa `pending` transaction mavjud bo‘lsa
    const existingPending = await this.transactionRepo.findOne({
      where: {
        user: { id: params.account.user_id },
        status: 'pending',
      },
    });

    if (existingPending) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -31099,
          message: {
            uz: 'Avvalgi tranzaksiya hali yakunlanmagan',
            ru: 'Предыдущая транзакция еще не завершена',
            en: 'Previous transaction is still pending',
          },
          data: 'Transaction already exists and is pending',
        },
        id: params.id,
      };
    }

    const newTransaction = this.transactionRepo.create({
      user: { id: params.account.user_id },
      paymeTransactionId: params.id,
      amount: params.amount,
      status: 'pending',
    });

    await this.transactionRepo.save(newTransaction);

    return {
      jsonrpc: '2.0',
      result: {
        create_time: newTransaction.createdAt.getTime(),
        transaction: newTransaction.id.toString(),
        state: 1,
      },
      id: params.id,
    };
  }

  // 3. CheckTransaction
  async checkTransaction(params: any, id: number | string) {
    const transaction = await this.transactionRepo.findOne({
      where: { paymeTransactionId: params.id },
    });

    if (!transaction) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -31003,
          message: {
            uz: 'Tranzaksiya topilmadi',
            ru: 'Транзакция не найдена',
            en: 'Transaction not found',
          },
        },
        id,
      };
    }

    return {
      jsonrpc: '2.0',
      result: {
        create_time: transaction.createdAt.getTime(),
        perform_time:
          transaction.status === 'success'
            ? transaction.updatedAt.getTime()
            : null,
        cancel_time:
          transaction.status === 'failed'
            ? transaction.updatedAt.getTime()
            : null,
        transaction: transaction.id.toString(),
        state: this.getTransactionState(transaction.status),
        reason: null,
      },
      id,
    };
  }

  // 4. PerformTransaction
  async performTransaction(params: any, id: string | number) {
    const transaction = await this.transactionRepo.findOne({
      where: { paymeTransactionId: params.id },
      relations: ['user'],
    });

    if (!transaction) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -31003,
          message: {
            uz: 'Tranzaksiya topilmadi',
            ru: 'Транзакция не найдена',
            en: 'Transaction not found',
          },
        },
        id,
      };
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

    if (transaction.status !== 'pending') {
      return {
        jsonrpc: '2.0',
        error: {
          code: -31008,
          message: {
            uz: 'Tranzaksiya bajarib bo‘lmaydi',
            ru: 'Невозможно выполнить транзакцию',
            en: 'Cannot perform transaction',
          },
        },
        id,
      };
    }

    transaction.status = 'success';
    await this.transactionRepo.save(transaction);

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

  // 5. CancelTransaction
  async cancelTransaction(params: any, id: string | number) {
    const transaction = await this.transactionRepo.findOne({
      where: { paymeTransactionId: params.id },
    });

    if (!transaction) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -31003,
          message: {
            uz: 'Tranzaksiya topilmadi',
            ru: 'Транзакция не найдена',
            en: 'Transaction not found',
          },
        },
        id,
      };
    }

    if (transaction.status === 'success') {
      return {
        jsonrpc: '2.0',
        error: {
          code: -31007,
          message: {
            uz: 'Tranzaksiyani bekor qilib bo‘lmaydi',
            ru: 'Невозможно отменить транзакцию',
            en: 'Cannot cancel transaction',
          },
        },
        id,
      };
    }

    transaction.status = 'failed';
    await this.transactionRepo.save(transaction);

    return {
      jsonrpc: '2.0',
      result: {
        transaction: transaction.id.toString(),
        cancel_time: transaction.updatedAt.getTime(),
        state: -1,
      },
      id,
    };
  }

  private getTransactionState(status: string): number {
    if (status === 'pending') return 1;
    if (status === 'success') return 2;
    if (status === 'failed') return -1;
    return 0;
  }
}
