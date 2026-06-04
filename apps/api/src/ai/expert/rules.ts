import type { FiredRule, PostSignals, StorySignals } from '@social-manager/types';

export function evaluateRules(signals: PostSignals): FiredRule[] {
  const fired: FiredRule[] = [];

  const engagementDepth = signals.aspectBreakdown.engagementDepth ?? 0;
  if (engagementDepth < 0.03) {
    fired.push({
      ruleId: 'R001',
      condition: `engagementDepth (${engagementDepth.toFixed(4)}) < 0.03`,
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

export function evaluateStoryRules(signals: StorySignals): FiredRule[] {
  const fired: FiredRule[] = [];

  // SR001 — high exit rate
  if (signals.exitRate > 0.40) {
    fired.push({
      ruleId: 'SR001',
      condition: `exitRate (${signals.exitRate.toFixed(4)}) > 0.40`,
      conclusion: 'HIGH_EXIT_RATE',
      confidence: 0.90,
      action: 'Open with a stronger hook — viewers are leaving in the first frame',
    });
  }

  // SR002 — content being skipped
  if (signals.tapForwardRate > 0.30) {
    fired.push({
      ruleId: 'SR002',
      condition: `tapForwardRate (${signals.tapForwardRate.toFixed(4)}) > 0.30`,
      conclusion: 'CONTENT_SKIPPED',
      confidence: 0.85,
      action: 'Shorten story duration or front-load value — audience is tapping past',
    });
  }

  // SR003 — strong content resonance (positive rule)
  if (signals.tapBackRate > 0.08) {
    fired.push({
      ruleId: 'SR003',
      condition: `tapBackRate (${signals.tapBackRate.toFixed(4)}) > 0.08`,
      conclusion: 'STRONG_RESONANCE',
      confidence: 0.88,
      action: 'Replicate this content format — audience is rewatching',
    });
  }

  // SR004 — low reply engagement
  if (signals.replyRate < 0.005) {
    fired.push({
      ruleId: 'SR004',
      condition: `replyRate (${signals.replyRate.toFixed(5)}) < 0.005`,
      conclusion: 'LOW_REPLY_ENGAGEMENT',
      confidence: 0.80,
      action: 'Add a direct question or poll sticker to drive replies',
    });
  }

  // SR005 — driving profile visits but not replies (conversion without engagement)
  if (signals.profileVisitRate > 0.05 && signals.replyRate < 0.005) {
    fired.push({
      ruleId: 'SR005',
      condition: `profileVisitRate (${signals.profileVisitRate.toFixed(4)}) > 0.05 AND replyRate < 0.005`,
      conclusion: 'PROFILE_TRAFFIC_NO_ENGAGEMENT',
      confidence: 0.82,
      action: 'Add a CTA that converts profile visitors — they are curious but not engaging',
    });
  }

  return fired;
}
