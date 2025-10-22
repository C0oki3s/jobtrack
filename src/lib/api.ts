'use client';

import { ApiError } from '../types/auth';
import { LoginResponse } from '../types/login';
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

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://veta-api.plaidnox.com';
const TOKEN_KEY = 'auth_token';
const DOMAIN_STORAGE_KEY = 'selected_domain';
const ORG_STORAGE_KEY = 'selected_org';
const AUTH_SCHEME = process.env.NEXT_PUBLIC_AUTH_SCHEME || 'token';

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

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
  authScheme?: string;
}

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
    
    if (res.status === 401 || res.status === 403) {
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY);
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
    throw error;
  }

  return body as T;
}

// Login API function
export async function loginUser(email: string, password: string): Promise<LoginResponse> {
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

export { TOKEN_KEY, BASE_URL, AUTH_SCHEME, DOMAIN_STORAGE_KEY, ORG_STORAGE_KEY };