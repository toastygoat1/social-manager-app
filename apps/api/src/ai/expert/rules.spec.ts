import { describe, it, expect } from '@jest/globals';
import { evaluateRules } from './rules.js';
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

describe('evaluateRules', () => {
  it('fires no rules when metrics are healthy', () => {
    const signals = makeSignals();
    expect(evaluateRules(signals)).toHaveLength(0);
  });

  it('R001 fires when engagementDepth < 0.3', () => {
    const signals = makeSignals({
      aspectBreakdown: {
        contentQuality: 0.6,
        postingTiming: 0.5,
        audienceReach: 0.5,
        engagementDepth: 0.25,
      },
    });
    const fired = evaluateRules(signals);
    expect(fired.some((r) => r.ruleId === 'R001')).toBe(true);
  });

  it('R001 does not fire when engagementDepth >= 0.3', () => {
    const signals = makeSignals({
      aspectBreakdown: {
        contentQuality: 0.6,
        postingTiming: 0.5,
        audienceReach: 0.5,
        engagementDepth: 0.3,
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
        engagementDepth: 0.1,
      },
    });
    const r001 = evaluateRules(signals).find((r) => r.ruleId === 'R001');
    expect(r001).toBeDefined();
    expect(r001!.conclusion).toBe('UNDERPERFORMING');
    expect(r001!.confidence).toBeGreaterThan(0);
    expect(r001!.action).toBeTruthy();
  });
});
