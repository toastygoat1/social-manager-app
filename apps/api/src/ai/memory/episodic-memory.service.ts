import { Injectable } from '@nestjs/common';
import {
  ChatbotMessageRole,
  type ChatbotMessage,
} from '@social-manager/database';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class EpisodicMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async saveMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    tokensUsed?: number,
  ): Promise<void> {
    await this.prisma.chatbotMessage.create({
      data: {
        sessionId,
        role:
          role === 'user'
            ? ChatbotMessageRole.USER
            : ChatbotMessageRole.ASSISTANT,
        content,
        tokensUsed: tokensUsed ?? null,
      },
    });
  }

  async getRecentMessages(
    sessionId: string,
    limit = 8,
  ): Promise<ChatbotMessage[]> {
    return this.prisma.chatbotMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.prisma.chatbotSession.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });
  }

  buildContextString(messages: ChatbotMessage[]): string {
    if (!messages.length) return '';
    const lines = [...messages].reverse().map((m) => {
      const speaker = m.role === ChatbotMessageRole.USER ? 'User' : 'Assistant';
      return `${speaker}: ${m.content}`;
    });
    return `Recent conversation:\n${lines.join('\n')}`;
  }
}
