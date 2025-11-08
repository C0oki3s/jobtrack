'use client';

import { ApiError } from '../types/auth';
import { 
  LoginResponse, 
  SwitchOrgResponse, 
  RefreshTokenResponse, 
  LogoutResponse,
  MeResponse,
  SetPasswordResponse,
  PasswordResetResponse,
  PasswordResetConfirmResponse
} from '../types/login';
import {
  AdminOrganizationListResponse,
  FileListResponse,
  FileUploadResponse,
  TrackerUploadResponse,
  FileDeleteResponse,
  UploadFileParams,
  AdminSearchParams,
  FileType
} from '../types/admin';

const BASE_URL =  'https://veta-api.plaidnox.com';
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const DOMAIN_STORAGE_KEY = 'selected_domain';
const ORG_STORAGE_KEY = 'selected_org';
const AUTH_SCHEME = 'Bearer';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(refreshToken: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearToken() {
  clearTokens();
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
  authScheme?: string;
  skipRefresh?: boolean;
}

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = getToken();
  if (token && options.auth !== false) {
    const scheme = (options.authScheme || AUTH_SCHEME).trim();
    headers.Authorization = `${scheme} ${token}`.trim();
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for refresh token if backend uses them
  });

  const contentType = res.headers.get('content-type');
  let body: unknown = null;
  if (contentType && contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    const errorBody = body as { message?: string; error?: string };
    const error: ApiError = {
      status: res.status,
      message: (errorBody && (errorBody.message || errorBody.error)) || res.statusText,
    };
    
    // Handle 401 - attempt token refresh if not already refreshing and not a refresh endpoint
    if (res.status === 401 && !options.skipRefresh && path !== '/users/token/refresh') {
      const refreshToken = getRefreshToken();
      if (refreshToken && !isRefreshing) {
        if (!refreshPromise) {
          refreshPromise = attemptTokenRefresh();
        }
        
        try {
          await refreshPromise;
          // Retry the original request with new token
          return apiFetch<T>(path, { ...options, skipRefresh: true });
        } catch (refreshError) {
          // Refresh failed, force logout
          handleAuthFailure();
          throw error;
        } finally {
          refreshPromise = null;
        }
      } else {
        handleAuthFailure();
      }
    }
    
    if (res.status === 401 || res.status === 403) {
      handleAuthFailure();
    }
    throw error;
  }

  return body as T;
}

async function attemptTokenRefresh(): Promise<void> {
  if (isRefreshing) return;
  
  isRefreshing = true;
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    // You'll need to implement getUserEmail to get the current user's email
    const email = getUserEmail();
    if (!email) {
      throw new Error('No user email available');
    }
    
    const response = await refreshTokens(email, refreshToken);
    setToken(response.token);
    setRefreshToken(response.refreshToken);
  } finally {
    isRefreshing = false;
  }
}

function handleAuthFailure() {
  try {
    if (typeof window !== 'undefined') {
      clearTokens();
      localStorage.removeItem(DOMAIN_STORAGE_KEY);
      localStorage.removeItem(ORG_STORAGE_KEY);
      const current = window.location.pathname + window.location.search;
      if (!window.location.pathname.startsWith('/login')) {
        const next = encodeURIComponent(current);
        window.location.replace(`/login?next=${next}`);
      }
    }
  } catch {}
}

// Helper function to get user email from token or storage
function getUserEmail(): string | null {
  // This would ideally decode the JWT token to get the email
  // For now, we'll store it separately or implement JWT decoding
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('user_email');
  } catch {
    return null;
  }
}

export function setUserEmail(email: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user_email', email);
}

export function clearUserEmail() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user_email');
}

// Authentication API functions (New multi-tenant endpoints)
export async function loginUser(email: string, password: string, orgId?: string): Promise<LoginResponse> {
  const body: any = { email, password };
  if (orgId) {
    body.orgId = orgId;
  }
  
  return apiFetch<LoginResponse>('/users/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(body),
  });
}

export async function switchOrganization(orgId?: string, membershipId?: string): Promise<SwitchOrgResponse> {
  const body: any = {};
  if (orgId) body.orgId = orgId;
  if (membershipId) body.membershipId = membershipId;
  
  return apiFetch<SwitchOrgResponse>('/users/switch', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function refreshTokens(email: string, refreshToken: string): Promise<RefreshTokenResponse> {
  return apiFetch<RefreshTokenResponse>('/users/token/refresh', {
    method: 'POST',
    auth: false,
    skipRefresh: true,
    body: JSON.stringify({ email, refreshToken }),
  });
}

export async function logoutUser(email: string): Promise<LogoutResponse> {
  return apiFetch<LogoutResponse>('/users/logout', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function getCurrentUser(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/me');
}

export async function setPassword(token: string, password: string): Promise<SetPasswordResponse> {
  return apiFetch<SetPasswordResponse>('/users/set-password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ token, password }),
  });
}

export async function requestPasswordReset(email: string): Promise<PasswordResetResponse> {
  return apiFetch<PasswordResetResponse>('/users/password-reset/request', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(token: string, password: string): Promise<PasswordResetConfirmResponse> {
  return apiFetch<PasswordResetConfirmResponse>('/users/password-reset/confirm', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ token, password }),
  });
}

export async function resendVerificationEmail(email: string): Promise<{ status: boolean; success: boolean; message: string }> {
  return apiFetch('/users/resend-verification', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email }),
  });
}

// Legacy login function (keeping for backward compatibility)
export async function loginUserLegacy(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/login', {
    method: 'POST',
    auth: false, // Don't send auth header for login
    body: JSON.stringify({ email, password }),
  });
}

// JobTracker API functions
export async function getJobTrackerData(organizationId: string, limit: number = 50) {
  return apiFetch(`/job-tracker/organization/${organizationId}?limit=${limit}`);
}

export async function getFilteredJobTrackerData(
  organizationId: string, 
  status?: string[], 
  limit: number = 50
) {
  const statusParam = status && status.length > 0 ? `&status=${status.join(',')}` : '';
  return apiFetch(`/job-tracker/organization/${organizationId}?limit=${limit}${statusParam}`);
}

export async function getSessionDetails(sessionId: string) {
  return apiFetch(`/job-tracker/session/${sessionId}`);
}

export async function getJobDetails(jobId: string) {
  return apiFetch(`/job-tracker/job/${jobId}`);
}

export async function syncOrganization(organizationId: string, statuses: string[] = ['running', 'pending', 'submitted']) {
  return apiFetch(`/job-tracker/sync/${organizationId}?sync=true`, {
    method: 'POST',
    body: JSON.stringify({ status: statuses }),
  });
}

export async function syncSession(sessionId: string) {
  return apiFetch(`/job-tracker/sync/session/${sessionId}`, {
    method: 'POST',
  });
}

// Organization listing API functions
export async function getOrganizations(page: number = 1, limit: number = 10, org?: string, sync?: boolean) {
  const searchParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (org) {
    searchParams.append('org', org);
  }

  if (sync) {
    searchParams.append('sync', 'true');
  }

  const url = `/job-tracker/?${searchParams.toString()}`;
  return apiFetch(url);
}

// Admin API functions
export async function getAdminOrganizations(params: AdminSearchParams = {}): Promise<AdminOrganizationListResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.search) searchParams.append('search', params.search);

  const url = `/admin/orgs${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return apiFetch<AdminOrganizationListResponse>(url);
}

export async function uploadOrgFile(
  orgId: string, 
  type: 'report' | 'tracker', 
  params: UploadFileParams
): Promise<FileUploadResponse | TrackerUploadResponse> {
  const formData = new FormData();
  formData.append('file', params.file);
  // Optional POCS zip when uploading tracker
  if (type === 'tracker' && params.pocs) {
    formData.append('pocs', params.pocs);
  }
  
  if (params.version) {
    formData.append('version', params.version.toString());
  }
  
  if (params.metadata) {
    formData.append('metadata', JSON.stringify(params.metadata));
  }

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    const scheme = AUTH_SCHEME.trim();
    headers.Authorization = `${scheme} ${token}`.trim();
  }

  const res = await fetch(`${BASE_URL}/admin/${orgId}/${type}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    const error: ApiError = {
      status: res.status,
      message: errorBody.error || res.statusText,
    };
    throw error;
  }

  return res.json();
}

export async function getOrgFiles(
  orgId: string, 
  params?: { type?: FileType; project?: string }
): Promise<FileListResponse> {
  const searchParams = new URLSearchParams();
  
  if (params?.type && params.type !== 'all') {
    searchParams.append('type', params.type);
  }
  
  if (params?.project) {
    searchParams.append('project', params.project);
  }

  const url = `/admin/${orgId}/files${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return apiFetch<FileListResponse>(url);
}

export async function getOrgReports(orgId: string): Promise<FileListResponse> {
  return apiFetch<FileListResponse>(`/admin/${orgId}/report`);
}

export async function getOrgTrackers(orgId: string): Promise<FileListResponse> {
  return apiFetch<FileListResponse>(`/admin/${orgId}/tracker`);
}

export async function deleteOrgFile(
  orgId: string, 
  fileId: string
): Promise<FileDeleteResponse> {
  return apiFetch<FileDeleteResponse>(`/admin/${orgId}/files/${fileId}`, {
    method: 'DELETE',
  });
}

export { 
  TOKEN_KEY, 
  REFRESH_TOKEN_KEY, 
  BASE_URL, 
  AUTH_SCHEME, 
  DOMAIN_STORAGE_KEY, 
  ORG_STORAGE_KEY 
};