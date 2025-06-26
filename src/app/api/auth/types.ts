export interface AuthUser {
  username: string;
  email: string;
  token: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthError {
  message: string;
  code?: string;
}
