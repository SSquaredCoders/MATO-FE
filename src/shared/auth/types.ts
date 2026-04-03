export interface AuthUser {
  id: number;
  userId: string;
  nickname: string;
  role: string;
}

export interface LoginRequest {
  userId: string;
  password: string;
}

export interface RegisterRequest {
  userId: string;
  password: string;
  confirmPassword: string;
  nickname: string;
}
