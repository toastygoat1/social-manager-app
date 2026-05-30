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
  FiredRule,
  PostSignals,
  WorkingMemoryState,
} from './ai.js';
