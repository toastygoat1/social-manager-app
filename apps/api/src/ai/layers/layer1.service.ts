import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { AiSettings } from '@social-manager/database';
import type { PostSignals } from '@social-manager/types';

const LAYER1_SYSTEM_PROMPT = `You are an Instagram analytics intelligence engine. Your role is to analyze post performance metrics and produce structured signal output.

ENGAGEMENT RATE BENCHMARKS:
- Nano accounts (<10K): 3–8% is healthy; below 2% is poor; above 10% is exceptional
- Micro accounts (10K–100K): 1.5–4% healthy; below 1% poor; above 6% exceptional
- Mid-tier (100K–500K): 0.8–2.5% healthy; below 0.5% poor; above 4% exceptional

SAVES/REACH BENCHMARKS (stored in aspectBreakdown.engagementDepth as raw ratio):
- Excellent: > 0.05 (5% of reach saves the post)
- Good: 0.02–0.05
- Average: 0.01–0.02
- Below average: < 0.01

CONTENT QUALITY SCORES (aspectBreakdown.contentQuality 0–1):
- Caption hooks, CTA presence, hashtag optimization
- Visual coherence and format fit (Reel vs Feed vs Carousel)

POSTING TIMING SCORES (aspectBreakdown.postingTiming 0–1):
- Alignment with peak audience hours
- Consistency with historic high-performance windows

AUDIENCE REACH QUALITY (aspectBreakdown.audienceReach 0–1):
- Ratio of unique accounts reached to followers
- Story-to-feed cross-reach performance

ENGAGEMENT DEPTH (aspectBreakdown.engagementDepth):
- Saves-to-reach ratio as a raw decimal (e.g., 0.008 = 0.8% saves/reach)
- This is NOT a normalized 0–1 score; it is the raw ratio

NARRATIVE CATEGORIES:
- improving: last 3 posts show upward trend
- declining: last 3 posts show downward trend
- stable: variance < 15%
- volatile: variance > 40%

VIRAL RISK: true if reach/impressions ratio > 0.7 AND engagement > 2× account average

DOMINANT EMOTIONS: excitement, trust, anticipation, nostalgia, inspiration, FOMO, curiosity

CATEGORY-SPECIFIC BENCHMARKS (derived from portfolio dataset):
- Fashion: saves/reach avg 0.18 — highest in portfolio, use as save-depth benchmark
- Food: saves/reach avg 0.012 — lowest in portfolio despite reasonable reach; food content
  consistently struggles to earn saves — flag if below 0.05
- Comedy: highest engagement ceiling but highest volatility — single viral posts skew averages;
  do not over-interpret one high-performing Comedy post as a repeatable trend
- Travel: second highest volatility — similar caution as Comedy
- Technology: moderate saves but inconsistent engagement — signals audience interest
  but weak emotional resonance
- All other categories (Beauty, Fitness, Lifestyle, Music, Photography):
  benchmark against portfolio average saves/reach of 0.08

TRAFFIC SOURCE CONTEXT:
- Explore: strongest follower-conversion source — high-reach Explore posts with
  low saves are wasting their best conversion opportunity
- Reels Feed: high reach but lowest follower conversion — prioritize saves over reach
- Home Feed + Hashtags: balanced conversion, ~550 followers gained per post average

You must respond with a valid JSON object matching the PostSignals schema exactly.`;

type PostMetrics = {
  postId: string;
  caption: string | null;
  postType: string;
  likeCount: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  savesCount: number | null;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
  accountUsername: string;
};

@Injectable()
export class Layer1Service {
  private readonly logger = new Logger(Layer1Service.name);
  private readonly client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  async analyze(
    postMetrics: PostMetrics,
    aiSettings: AiSettings | null,
    memoryContext: string,
  ): Promise<{ signals: PostSignals; tokensUsed: number }> {
    const model =
      this.config.get<string>('OPENAI_MODEL_LAYER1') ?? 'gpt-5.4-mini';

    const systemParts = [LAYER1_SYSTEM_PROMPT];
    if (aiSettings?.customInstructions) {
      systemParts.push(
        `\nUser custom instructions: ${aiSettings.customInstructions}`,
      );
    }
    if (aiSettings?.preferredTone) {
      systemParts.push(`\nPreferred tone: ${aiSettings.preferredTone}`);
    }
    if (memoryContext) {
      systemParts.push(`\n${memoryContext}`);
    }

    const systemPrompt = systemParts.join('\n');

    try {
      const response = await this.client.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_completion_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(postMetrics) },
        ],
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) throw new Error('Empty response from Layer1');

      const signals = JSON.parse(raw) as PostSignals;
      const tokensUsed = response.usage?.total_tokens ?? 0;
      return { signals, tokensUsed };
    } catch (error) {
      this.logger.error(`Layer1 analysis failed: ${(error as Error).message}`);
      throw new BadRequestException('Post signal analysis failed');
    }
  }
}
