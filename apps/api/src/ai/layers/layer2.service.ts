import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { AiSettings } from '@social-manager/database';
import type { FiredRule, PostSignals } from '@social-manager/types';

const LAYER2_SYSTEM_PROMPT = `You are an expert Instagram growth strategist and performance analyst. Your role is to translate raw analytics signals and expert rule findings into clear, actionable explanations for content creators.

Your explanations must:
1. Begin with a concise 1-sentence performance verdict (positive, neutral, or urgent)
2. Reference specific metrics and benchmarks from the signals
3. Explain WHY each fired rule matters for the account's growth
4. Provide 2–3 concrete, prioritized action items
5. Close with a confidence-weighted strategic recommendation

Tone and framing:
- Professional but conversational — like a trusted growth coach
- Never condescending; frame issues as opportunities
- Be specific: mention actual numbers, ratios, and thresholds
- Respect the preferred tone setting if provided

Benchmark context you must apply:
- Saves/reach < 1%: content is not perceived as worth keeping → add evergreen value
- Engagement depth (saves/reach raw ratio) < 0.01: content is not perceived as worth saving → add evergreen value and stronger save CTA
- Engagement depth < 0.03: below average save performance for this portfolio → strengthen content utility and hook structure
- Viral risk with low saves: superficial virality → content is seen but not valued
- Volatile narrative + high risk: unstable account performance → consistency intervention needed
- Food content with < 5% saves/reach: a high-saves niche underperforming → add recipes or step-by-step formats

Format your response as 3–4 paragraphs of plain text. No markdown headers, no bullet lists — flowing prose that creators actually want to read.`;

const LAYER2_CHAT_SYSTEM_PROMPT = `You are Snow AI, a social media assistant inside Social Manager App.

You help users with Instagram strategy, captions, content planning, message replies, and interpreting analytics when analytics context is available.

If the memory/context includes "Current account analytics context from database", treat that as live account data for the selected account. Use it to answer requests for insights, top posts, reach, saves, engagement, and performance. Current database context overrides older chat messages where you may have said analytics were unavailable.

For normal writing, planning, or brainstorming requests, answer directly and helpfully. Do not say you lack performance data unless the user's request specifically requires account metrics.

If the user asks for performance analysis and no analytics context is available, be brief: say you do not have enough metrics for a precise read, then give the best next step such as refreshing insights, clicking Analyze on a post, or sharing reach/saves/engagement. Do not repeat a long generic disclaimer.

If memory context includes prior analysis, use it naturally. Never invent metrics that are not present.

Respond in the user's language. Keep responses concise, practical, and conversational.`;

@Injectable()
export class Layer2Service {
  private readonly logger = new Logger(Layer2Service.name);
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new BadRequestException(
        'OPENAI_API_KEY is required for AI analysis',
      );
    }

    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  async explain(
    signals: PostSignals | null,
    firedRules: FiredRule[],
    aiSettings: AiSettings | null,
    memoryContext: string,
  ): Promise<{ explanation: string; tokensUsed: number }> {
    const model =
      this.config.get<string>('OPENAI_MODEL_LAYER2') ?? 'gpt-4.1-mini';

    const systemParts = [LAYER2_SYSTEM_PROMPT];
    if (aiSettings?.preferredTone) {
      systemParts.push(
        `\nAdopt this tone in your explanation: ${aiSettings.preferredTone}`,
      );
    }
    if (memoryContext) {
      systemParts.push(`\n${memoryContext}`);
    }

    const systemPrompt = systemParts.join('\n');
    const client = this.getClient();

    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0.4,
        max_completion_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: JSON.stringify({ signals, firedRules }),
          },
        ],
      });

      const explanation =
        response.choices[0]?.message?.content ?? 'Analysis complete.';
      const tokensUsed = response.usage?.total_tokens ?? 0;
      return { explanation, tokensUsed };
    } catch (error) {
      this.logger.error(
        `Layer2 explanation failed: ${(error as Error).message}`,
      );
      throw new BadRequestException('Explanation generation failed');
    }
  }

  async chat(
    message: string,
    aiSettings: AiSettings | null,
    memoryContext: string,
  ): Promise<{ reply: string; tokensUsed: number }> {
    const model =
      this.config.get<string>('OPENAI_MODEL_LAYER2') ?? 'gpt-4.1-mini';

    const systemParts = [LAYER2_CHAT_SYSTEM_PROMPT];
    if (aiSettings?.preferredTone) {
      systemParts.push(`\nAdopt this tone: ${aiSettings.preferredTone}`);
    }
    if (aiSettings?.customInstructions) {
      systemParts.push(
        `\nUser custom instructions: ${aiSettings.customInstructions}`,
      );
    }
    if (memoryContext) {
      systemParts.push(`\nRelevant memory/context:\n${memoryContext}`);
    }

    const client = this.getClient();

    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0.5,
        max_completion_tokens: 500,
        messages: [
          { role: 'system', content: systemParts.join('\n') },
          { role: 'user', content: message },
        ],
      });

      const reply =
        response.choices[0]?.message?.content ??
        'I can help with captions, planning, replies, or post analysis.';
      const tokensUsed = response.usage?.total_tokens ?? 0;
      return { reply, tokensUsed };
    } catch (error) {
      this.logger.error(`Layer2 chat failed: ${(error as Error).message}`);
      throw new BadRequestException('AI chat response failed');
    }
  }
}
