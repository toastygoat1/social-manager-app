import { Test } from '@nestjs/testing';
import { ExpertEngineService } from './engine.service.js';
import type { PostSignals } from '@social-manager/types';

function makeSignals(overrides: Partial<PostSignals> = {}): PostSignals {
  return {
    postId: 'post-1',
    overallSentiment: 'neutral',
    sentimentScore: 0.5,
    dominantEmotion: 'curiosity',
    aspectBreakdown: {
      contentQuality: 0.6,
      postingTiming: 0.5,
      audienceReach: 0.5,
      engagementDepth: 0.5,
    },
    topThemes: [],
    narrativeShift: 'stable',
    strategicSignals: {
      riskLevel: 'low',
      opportunity: null,
      urgency: 'low',
      viralRisk: false,
    },
    bestAction: 'keep posting',
    confidence: 0.8,
    ...overrides,
  };
}

describe('ExpertEngineService', () => {
  let service: ExpertEngineService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ExpertEngineService],
    }).compile();
    service = module.get(ExpertEngineService);
  });

  it('R006 fires when both R001 and R003 fire together', () => {
    // engagementDepth 0.015:
    //   below 0.03  → triggers R001 (UNDERPERFORMING)
    //   below 0.02  → triggers R003 when viralRisk=true (VIRAL_BUT_HOLLOW)
    //   R001 + R003 together → triggers R006 (CRITICAL_INTERVENTION_NEEDED)
    const signals = makeSignals({
      aspectBreakdown: {
        contentQuality: 0.6,
        postingTiming: 0.5,
        audienceReach: 0.5,
        engagementDepth: 0.015,
      },
      strategicSignals: {
        riskLevel: 'medium',
        opportunity: null,
        urgency: 'high',
        viralRisk: true,
      },
    });

    const fired = service.run(signals);

    expect(fired.some((r) => r.ruleId === 'R001')).toBe(true);
    expect(fired.some((r) => r.ruleId === 'R003')).toBe(true);
    expect(fired.some((r) => r.ruleId === 'R006')).toBe(true);
    expect(
      fired.find((r) => r.ruleId === 'R006')?.conclusion,
    ).toBe('CRITICAL_INTERVENTION_NEEDED');
  });

  it('R006 does not fire when only R001 fires without R003', () => {
    // engagementDepth 0.02: below 0.03 (R001 fires) but viralRisk=false (R003 does not fire)
    const signals = makeSignals({
      aspectBreakdown: {
        contentQuality: 0.6,
        postingTiming: 0.5,
        audienceReach: 0.5,
        engagementDepth: 0.02,
      },
      strategicSignals: {
        riskLevel: 'low',
        opportunity: null,
        urgency: 'low',
        viralRisk: false,
      },
    });

    const fired = service.run(signals);

    expect(fired.some((r) => r.ruleId === 'R001')).toBe(true);
    expect(fired.some((r) => r.ruleId === 'R003')).toBe(false);
    expect(fired.some((r) => r.ruleId === 'R006')).toBe(false);
  });
});
