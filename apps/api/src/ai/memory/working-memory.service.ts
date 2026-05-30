import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { WorkingMemoryState } from '@social-manager/types';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const TTL_SECONDS = 7200;

@Injectable()
export class WorkingMemoryService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(accountId: string, sessionId: string): string {
    return `wm:${accountId}:${sessionId}`;
  }

  async get(
    accountId: string,
    sessionId: string,
  ): Promise<WorkingMemoryState | null> {
    const raw = await this.redis.get(this.key(accountId, sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as WorkingMemoryState;
  }

  async set(
    accountId: string,
    sessionId: string,
    state: WorkingMemoryState,
  ): Promise<void> {
    await this.redis.set(
      this.key(accountId, sessionId),
      JSON.stringify(state),
      'EX',
      TTL_SECONDS,
    );
  }

  async clear(accountId: string, sessionId: string): Promise<void> {
    await this.redis.del(this.key(accountId, sessionId));
  }
}
