export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

export interface PostSummary {
  id: string;
  content: string;
  status: PostStatus;
  scheduledAt: string | null;
  createdAt: string;
}
