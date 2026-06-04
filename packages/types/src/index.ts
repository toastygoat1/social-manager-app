export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

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
  WorkingMemoryState,
} from './ai.js';
