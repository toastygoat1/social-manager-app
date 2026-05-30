import type { FiredRule, PostSignals } from '@social-manager/types';

export function evaluateRules(signals: PostSignals): FiredRule[] {
  const fired: FiredRule[] = [];

  const engagementDepth = signals.aspectBreakdown.engagementDepth ?? 0;
  if (engagementDepth < 0.3) {
    fired.push({
      ruleId: 'R001',
      condition: `engagementDepth (${engagementDepth.toFixed(3)}) < 0.3`,
      conclusion: 'UNDERPERFORMING',
      confidence: 0.85,
      action: 'Review caption hooks and call-to-action placement',
    });
  }

  // Layer1 outputs raw saves/reach ratio in aspectBreakdown.engagementDepth
  const savesReachRatio = signals.aspectBreakdown.engagementDepth;
  if (savesReachRatio !== null && savesReachRatio < 0.01) {
    fired.push({
      ruleId: 'R002',
      condition: `savesReachRatio (${savesReachRatio.toFixed(4)}) < 0.01`,
      conclusion: 'LOW_SAVE_VALUE',
      confidence: 0.8,
      action: 'Add more actionable or informational content worth saving',
    });
  }

  const hasViral = signals.strategicSignals.viralRisk;
  if (hasViral && savesReachRatio !== null && savesReachRatio < 0.02) {
    fired.push({
      ruleId: 'R003',
      condition: `viralRisk=true AND savesReachRatio (${savesReachRatio.toFixed(4)}) < 0.02`,
      conclusion: 'VIRAL_BUT_HOLLOW',
      confidence: 0.9,
      action: 'Leverage virality spike with high-value follow-up content',
    });
  }

  const hasFood = signals.topThemes.some((t) => t.toLowerCase() === 'food');
  if (hasFood && savesReachRatio !== null && savesReachRatio < 0.05) {
    fired.push({
      ruleId: 'R004',
      condition: `topThemes includes 'Food' AND savesReachRatio (${savesReachRatio.toFixed(4)}) < 0.05`,
      conclusion: 'FOOD_SAVE_UNDERPERFORM',
      confidence: 0.75,
      action:
        'Add recipe details or instructional value to boost saves in food niche',
    });
  }

  if (
    signals.narrativeShift === 'volatile' &&
    signals.strategicSignals.riskLevel === 'high'
  ) {
    fired.push({
      ruleId: 'R005',
      condition: 'narrativeShift=volatile AND riskLevel=high',
      conclusion: 'UNSTABLE_HIGH_RISK',
      confidence: 0.85,
      action:
        'Stabilize content cadence and reduce posting frequency temporarily',
    });
  }

  return fired;
}
