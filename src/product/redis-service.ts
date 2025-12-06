import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  }

  async acquireLock(key: string, ttl = 2000): Promise<boolean> {
    const res = await this.client.set(key, 'locked', 'PX', ttl, 'NX');
    return res === 'OK';
  }

  async releaseLock(key: string) {
    try {
      await this.client.del(key);
    } catch (e) {
    }
  }

  async quit() {
    await this.client.quit();
  }

  onModuleDestroy() {
    this.quit();
  }
}
