import { describe, it, expect } from '@jest/globals';
import { evaluateRules, evaluateStoryRules } from './rules.js';
import type { PostSignals, StorySignals } from '@social-manager/types';

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

describe('evaluateRules', () => {
  it('fires no rules when metrics are healthy', () => {
    const signals = makeSignals();
    expect(evaluateRules(signals)).toHaveLength(0);
  });

  it('R001 fires when engagementDepth < 0.03', () => {
    const signals = makeSignals({
      aspectBreakdown: {
        contentQuality: 0.6,
        postingTiming: 0.5,
        audienceReach: 0.5,
        engagementDepth: 0.02,
      },
    });
    const fired = evaluateRules(signals);
    expect(fired.some((r) => r.ruleId === 'R001')).toBe(true);
  });

  it('R001 does not fire when engagementDepth >= 0.03', () => {
    const signals = makeSignals({
      aspectBreakdown: {
        contentQuality: 0.6,
        postingTiming: 0.5,
        audienceReach: 0.5,
        engagementDepth: 0.03,
      },
    });
    const fired = evaluateRules(signals);
    expect(fired.some((r) => r.ruleId === 'R001')).toBe(false);
  });

  it('R002 fires when engagementDepth (savesReachRatio) < 0.01', () => {
    const signals = makeSignals({
      aspectBreakdown: {
        contentQuality: 0.6,
        postingTiming: 0.5,
        audienceReach: 0.5,
        engagementDepth: 0.005,
      },
    });
    const fired = evaluateRules(signals);
    expect(fired.some((r) => r.ruleId === 'R002')).toBe(true);
    expect(fired.some((r) => r.ruleId === 'R001')).toBe(true);
  });

  it('R003 fires when viralRisk=true AND savesReachRatio < 0.02', () => {
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
        urgency: 'low',
        viralRisk: true,
      },
    });
    const fired = evaluateRules(signals);
    expect(fired.some((r) => r.ruleId === 'R003')).toBe(true);
  });

  it('R003 does not fire when viralRisk=false', () => {
    const signals = makeSignals({
      aspectBreakdown: {
        contentQuality: 0.6,
        postingTiming: 0.5,
        audienceReach: 0.5,
        engagementDepth: 0.015,
      },
    });
    const fired = evaluateRules(signals);
    expect(fired.some((r) => r.ruleId === 'R003')).toBe(false);
  });

  it('R004 fires for food theme with savesReachRatio < 0.05', () => {
    const signals = makeSignals({
      topThemes: ['Food', 'Recipe'],
      aspectBreakdown: {
        contentQuality: 0.6,
        postingTiming: 0.5,
        audienceReach: 0.5,
        engagementDepth: 0.03,
      },
    });
    const fired = evaluateRules(signals);
    expect(fired.some((r) => r.ruleId === 'R004')).toBe(true);
  });

  it('R004 does not fire for food theme with savesReachRatio >= 0.05', () => {
    const signals = makeSignals({
      topThemes: ['food'],
      aspectBreakdown: {
        contentQuality: 0.6,
        postingTiming: 0.5,
        audienceReach: 0.5,
        engagementDepth: 0.07,
      },
    });
    const fired = evaluateRules(signals);
    expect(fired.some((r) => r.ruleId === 'R004')).toBe(false);
  });

  it('R005 fires when narrativeShift=volatile AND riskLevel=high', () => {
    const signals = makeSignals({
      narrativeShift: 'volatile',
      strategicSignals: {
        riskLevel: 'high',
        opportunity: null,
        urgency: 'high',
        viralRisk: false,
      },
    });
    const fired = evaluateRules(signals);
    expect(fired.some((r) => r.ruleId === 'R005')).toBe(true);
  });

  it('R005 does not fire when only riskLevel=high without volatile shift', () => {
    const signals = makeSignals({
      narrativeShift: 'declining',
      strategicSignals: {
        riskLevel: 'high',
        opportunity: null,
        urgency: 'high',
        viralRisk: false,
      },
    });
    const fired = evaluateRules(signals);
    expect(fired.some((r) => r.ruleId === 'R005')).toBe(false);
  });

  it('returns correct ruleId, conclusion, and confidence for R001', () => {
    const signals = makeSignals({
      aspectBreakdown: {
        contentQuality: 0.6,
        postingTiming: 0.5,
        audienceReach: 0.5,
        engagementDepth: 0.02,
      },
    });
    const r001 = evaluateRules(signals).find((r) => r.ruleId === 'R001');
    expect(r001).toBeDefined();
    expect(r001!.conclusion).toBe('UNDERPERFORMING');
    expect(r001!.confidence).toBeGreaterThan(0);
    expect(r001!.action).toBeTruthy();
  });
});

function makeStorySignals(overrides: Partial<StorySignals> = {}): StorySignals {
  return {
    storyId: 'story-1',
    overallSentiment: 'neutral',
    sentimentScore: 0.5,
    dominantEmotion: 'curiosity',
    performanceVerdict: 'average',
    completionRate: 0.75,
    exitRate: 0.25,
    replyRate: 0.01,
    tapBackRate: 0.04,
    tapForwardRate: 0.15,
    profileVisitRate: 0.03,
    contentInsight: 'Average performance across all metrics.',
    strategicSignals: {
      riskLevel: 'low',
      opportunity: null,
      urgency: 'low',
    },
    bestAction: 'keep posting',
    confidence: 0.8,
    ...overrides,
  };
}

describe('evaluateStoryRules', () => {
  it('fires no rules when story metrics are healthy', () => {
    const signals = makeStorySignals();
    expect(evaluateStoryRules(signals)).toHaveLength(0);
  });

  it('SR001 fires when exitRate > 0.40', () => {
    const signals = makeStorySignals({ exitRate: 0.45 });
    const fired = evaluateStoryRules(signals);
    expect(fired.some((r) => r.ruleId === 'SR001')).toBe(true);
  });

  it('SR001 does not fire when exitRate <= 0.40', () => {
    const signals = makeStorySignals({ exitRate: 0.4 });
    const fired = evaluateStoryRules(signals);
    expect(fired.some((r) => r.ruleId === 'SR001')).toBe(false);
  });

  it('SR002 fires when tapForwardRate > 0.30', () => {
    const signals = makeStorySignals({ tapForwardRate: 0.35 });
    const fired = evaluateStoryRules(signals);
    expect(fired.some((r) => r.ruleId === 'SR002')).toBe(true);
  });

  it('SR003 fires when tapBackRate > 0.08', () => {
    const signals = makeStorySignals({ tapBackRate: 0.1 });
    const fired = evaluateStoryRules(signals);
    expect(fired.some((r) => r.ruleId === 'SR003')).toBe(true);
  });

  it('SR004 fires when replyRate < 0.005', () => {
    const signals = makeStorySignals({ replyRate: 0.003 });
    const fired = evaluateStoryRules(signals);
    expect(fired.some((r) => r.ruleId === 'SR004')).toBe(true);
  });

  it('SR005 fires when profileVisitRate > 0.05 AND replyRate < 0.005', () => {
    const signals = makeStorySignals({
      profileVisitRate: 0.07,
      replyRate: 0.002,
    });
    const fired = evaluateStoryRules(signals);
    expect(fired.some((r) => r.ruleId === 'SR005')).toBe(true);
  });

  it('SR005 does not fire when replyRate is healthy', () => {
    const signals = makeStorySignals({
      profileVisitRate: 0.07,
      replyRate: 0.01,
    });
    const fired = evaluateStoryRules(signals);
    expect(fired.some((r) => r.ruleId === 'SR005')).toBe(false);
  });

  it('returns correct shape for SR001', () => {
    const signals = makeStorySignals({ exitRate: 0.45 });
    const sr001 = evaluateStoryRules(signals).find((r) => r.ruleId === 'SR001');
    expect(sr001).toBeDefined();
    expect(sr001!.conclusion).toBe('HIGH_EXIT_RATE');
    expect(sr001!.confidence).toBeGreaterThan(0);
    expect(sr001!.action).toBeTruthy();
  });
});
