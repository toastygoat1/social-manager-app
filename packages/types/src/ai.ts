export interface AIAnalysisRequest {
  accountId: string;
  contentPostId: string;
  sessionId: string;
  userMessage?: string;
}

export interface PostSignals {
  postId: string;
  overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore: number;
  dominantEmotion: string;
  aspectBreakdown: {
    contentQuality: number | null;
    postingTiming: number | null;
    audienceReach: number | null;
    engagementDepth: number | null;
  };
  topThemes: string[];
  narrativeShift: 'improving' | 'declining' | 'stable' | 'volatile';
  strategicSignals: {
    riskLevel: 'low' | 'medium' | 'high';
    opportunity: string | null;
    urgency: 'low' | 'medium' | 'high';
    viralRisk: boolean;
  };
  bestAction: string;
  confidence: number;
}

export interface AIAnalysisResponse {
  sessionId: string;
  signals: PostSignals | null;
  explanation: string;
  firedRules: FiredRule[];
  memoryUpdated: boolean;
}

export interface FiredRule {
  ruleId: string;
  condition: string;
  conclusion: string;
  confidence: number;
  action: string;
}

export interface WorkingMemoryState {
  lastContentPostId?: string;
  lastSignals?: PostSignals;
  lastFiredRules?: FiredRule[];
  lastExplanation?: string;
  turnCount: number;
  updatedAt: string;
}
