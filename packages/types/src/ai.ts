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

export type BatchRange = 'week' | 'month' | 'year';

export interface BatchAnalyzeRequest {
  accountId: string;
  range: BatchRange;
}

export interface BatchAnalyzeResponse {
  batchId: string;
  totalPosts: number;
  range: BatchRange;
  status: 'PENDING';
  message: string;
}

export interface BatchStatusResponse {
  batchId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  range: BatchRange;
  totalPosts: number;
  completedPosts: number;
  failedPosts: number;
  summary: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface StoryMetrics {
  storyId: string;
  mediaType: string | null;
  mediaProductType: string | null;
  timestamp: Date | null;
  impressions: number;
  reach: number;
  exits: number;
  replies: number;
  tapsForward: number;
  tapsBack: number;
  profileVisits: number;
  follows: number;
  exitRate: number;
  completionRate: number;
  replyRate: number;
  tapForwardRate: number;
  tapBackRate: number;
  profileVisitRate: number;
  accountUsername: string;
}

export interface StorySignals {
  storyId: string;
  overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore: number;
  dominantEmotion: string;
  performanceVerdict: 'strong' | 'average' | 'weak' | 'viral';
  completionRate: number;
  exitRate: number;
  replyRate: number;
  tapBackRate: number;
  tapForwardRate: number;
  profileVisitRate: number;
  contentInsight: string;
  strategicSignals: {
    riskLevel: 'low' | 'medium' | 'high';
    opportunity: string | null;
    urgency: 'low' | 'medium' | 'high';
  };
  bestAction: string;
  confidence: number;
}

export interface StoryAnalysisRequest {
  accountId: string;
  storyId: string;
  sessionId: string;
}

export interface StoryAnalysisResponse {
  sessionId: string;
  storyId: string;
  signals: StorySignals | null;
  explanation: string;
  firedRules: FiredRule[];
  metricsAvailable: boolean;
}

export interface WorkingMemoryState {
  lastContentPostId?: string;
  lastSignals?: PostSignals;
  lastFiredRules?: FiredRule[];
  lastExplanation?: string;
  turnCount: number;
  updatedAt: string;
}
