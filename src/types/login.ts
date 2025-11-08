import { User, OrganizationMembership } from './auth';

export interface LoginRequest {
  email: string;
  password: string;
  orgId?: string;
}

export interface LoginResponse {
  status: boolean;
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: User;
  message?: string;
  multiTenant?: boolean;
  memberships?: OrganizationMembership[];
}

export interface SwitchOrgRequest {
  orgId?: string;
  membershipId?: string;
}

export interface SwitchOrgResponse {
  status: boolean;
  success: boolean;
  token: string;
  refreshToken: string;
  user: User;
  multiTenant?: boolean;
  memberships?: OrganizationMembership[];
}

export interface RefreshTokenRequest {
  email: string;
  refreshToken: string;
}

export interface RefreshTokenResponse {
  status: boolean;
  success: boolean;
  token: string;
  refreshToken: string;
}

export interface LogoutRequest {
  email: string;
}

export interface LogoutResponse {
  status: boolean;
  success: boolean;
  message: string;
}

export interface MeResponse {
  user: User;
}

export interface SetPasswordRequest {
  token: string;
  password: string;
}

export interface SetPasswordResponse {
  status: boolean;
  success: boolean;
  message: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetResponse {
  status: boolean;
  success: boolean;
  message: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
}

export interface PasswordResetConfirmResponse {
  status: boolean;
  success: boolean;
  message: string;
}