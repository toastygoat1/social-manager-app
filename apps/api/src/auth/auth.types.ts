export interface AuthUser {
  userId: string;
  email: string;
  role?: string;
}

export interface AuthedRequest {
  user: AuthUser;
}
