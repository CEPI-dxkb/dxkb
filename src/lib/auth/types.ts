export interface AuthUser {
  username: string;
  email: string;
  token: string;
  refresh_token?: string;
  expires_at?: number;
  realm?: string;
  un?: string;
  first_name?: string;
  last_name?: string;
  email_verified?: boolean;
  id?: string;
}

export interface UserProfile {
  affiliation?: string;
  created_by?: string;
  creation_date: string;
  email: string;
  email_verified: boolean;
  first_name: string;
  middle_name?: string;
  last_name: string;
  id: string;
  interests?: string;
  l_id: string;
  last_login: string;
  organisms: string;
  reverification: boolean;
  roles?: string[];
  source: string;
  update_date?: string;
  updated_by?: string;
  verification_code?: string;
  verification_date?: string;
  verification_error?: string;
  verification_send_date?: string;
}

export interface SigninCredentials {
  username: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  username: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  affiliation?: string;
  organisms?: string;
  interests?: string;
  password: string;
  password_repeat: string;
}

export interface AuthError {
  message: string;
  code?: string;
}

export interface PasswordResetRequest {
  usernameOrEmail: string;
}

export interface PasswordResetResponse {
  message: string;
  success: boolean;
  code?: string;
}
