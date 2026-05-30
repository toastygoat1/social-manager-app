import { Injectable } from '@nestjs/common';
import type { AiProcedure } from '@social-manager/database';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ProceduralMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async save(accountId: string, strategy: string): Promise<AiProcedure> {
    return this.prisma.aiProcedure.create({
      data: { accountId, strategy },
    });
  }

  async resolveOutcome(
    id: string,
    outcome: string,
    engagementDelta: number,
    savesDelta: number,
  ): Promise<void> {
    await this.prisma.aiProcedure.update({
      where: { id },
      data: { outcome, engagementDelta, savesDelta, resolvedAt: new Date() },
    });
  }

  async getSuccessful(accountId: string): Promise<AiProcedure[]> {
    return this.prisma.aiProcedure.findMany({
      where: {
        accountId,
        outcome: { not: null },
      },
      orderBy: { savesDelta: 'desc' },
    });
  }

  buildContextString(procedures: AiProcedure[]): string {
    if (!procedures.length) return '';
    const lines = procedures.map((p) => {
      const delta =
        p.savesDelta !== null
          ? ` (saves delta: ${p.savesDelta > 0 ? '+' : ''}${p.savesDelta})`
          : '';
      return `Strategy: ${p.strategy} → ${p.outcome ?? 'pending'}${delta}`;
    });
    return `Past strategies:\n${lines.join('\n')}`;
  }
}
