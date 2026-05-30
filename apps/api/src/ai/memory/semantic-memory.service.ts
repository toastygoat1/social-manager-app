import { Injectable } from '@nestjs/common';
import type { AiKnowledge } from '@social-manager/database';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SemanticMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getForAccount(accountId: string): Promise<AiKnowledge[]> {
    return this.prisma.aiKnowledge.findMany({
      where: { accountId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async upsert(
    accountId: string,
    category: string,
    fact: string,
    confidence: number,
  ): Promise<void> {
    const existing = await this.prisma.aiKnowledge.findFirst({
      where: { accountId, category, fact },
    });

    if (existing) {
      await this.prisma.aiKnowledge.update({
        where: { id: existing.id },
        data: { confidence },
      });
    } else {
      await this.prisma.aiKnowledge.create({
        data: { accountId, category, fact, confidence },
      });
    }
  }

  buildContextString(knowledge: AiKnowledge[]): string {
    if (!knowledge.length) return '';
    const lines = knowledge.map(
      (k) =>
        `[${k.category}] ${k.fact} (confidence: ${k.confidence.toFixed(2)})`,
    );
    return `Known patterns:\n${lines.join('\n')}`;
  }
}
