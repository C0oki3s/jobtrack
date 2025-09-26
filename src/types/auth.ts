export interface ApiError {
  status: number;
  message: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
}