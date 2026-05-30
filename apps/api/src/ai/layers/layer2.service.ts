import { Injectable, Logger } from '@nestjs/common';
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
- Engagement depth < 0.3 normalized: audience is browsing, not engaging → strengthen hooks
- Viral risk with low saves: superficial virality → content is seen but not valued
- Volatile narrative + high risk: unstable account performance → consistency intervention needed
- Food content with < 5% saves/reach: a high-saves niche underperforming → add recipes or step-by-step formats

Format your response as 3–4 paragraphs of plain text. No markdown headers, no bullet lists — flowing prose that creators actually want to read.`;

@Injectable()
export class Layer2Service {
  private readonly logger = new Logger(Layer2Service.name);
  private readonly client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
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

    const systemPrompt = systemParts.join('\n');

    try {
      const response = await this.client.chat.completions.create({
        model,
        temperature: 0.4,
        max_completion_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: JSON.stringify({ signals, firedRules, memoryContext }),
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
      return { explanation: 'Analysis complete — explanation generation encountered an issue.', tokensUsed: 0 };
    }
  }
}
