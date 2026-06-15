export interface AuthUser {
  userId: string;
  email: string;
  role?: string;
  sessionId?: string;
  sessionExpiresAt?: string;
}

export interface AuthedRequest {
  user: AuthUser;
}
