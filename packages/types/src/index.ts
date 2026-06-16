export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'removed';

export interface PostSummary {
  id: string;
  content: string;
  status: PostStatus;
  scheduledAt: string | null;
  createdAt: string;
}

export type {
  AIAnalysisRequest,
  AIAnalysisResponse,
  BatchAnalyzeRequest,
  BatchAnalyzeResponse,
  BatchRange,
  BatchStatusResponse,
  FiredRule,
  PostSignals,
  StoryAnalysisRequest,
  StoryAnalysisResponse,
  StoryMetrics,
  StorySignals,
  WorkingMemoryState,
} from './ai.js';
