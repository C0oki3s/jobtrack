export interface AdminOrganization {
  _id: string;
  name: string;
  domain: string;
  createdAt: string;
}

export interface AdminOrganizationListResponse {
  success: boolean;
  page: number;
  limit: number;
  total: number;
  items: AdminOrganization[];
}

export interface OrgFile {
  id: string;
  type: 'report' | 'tracker' | 'poc';
  version: number;
  projectKey?: string;
  project?: {
    date: string;
    type: string;
    name: string;
  };
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  url: string;
  uploadedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface FileListResponse {
  success: boolean;
  items: OrgFile[];
  count: number;
}

export interface FileUploadResponse {
  success: boolean;
  file: {
    id: string;
    key: string;
    url: string;
    type: 'report' | 'tracker';
    version: number;
    fileName: string;
    size: number;
    mimeType: string;
  };
}

// Tracker upload may return a different shape with optional POCS summary
export interface TrackerUploadResponse {
  success: boolean;
  tracker: {
    id: string;
    key: string;
    url: string;
    type: 'tracker';
    version: number;
    fileName: string;
    size: number;
    mimeType: string;
  };
  pocs?: {
    count: number;
    items: Array<{ key: string; size: number; mimeType: string }>;
    projectKey?: string;
  } | null;
}

export interface FileDeleteResponse {
  success: boolean;
  deleted: {
    id: string;
    key: string;
    type: string;
    version: number;
    fileName: string;
  };
}

export interface UploadFileParams {
  file: File;
  // Optional POCS zip file when uploading a tracker
  pocs?: File;
  version?: number;
  metadata?: Record<string, unknown>;
}

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type FileType = 'report' | 'tracker' | 'poc' | 'all';

export interface AdminSearchParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface FileSearchParams {
  type?: FileType;
  project?: string; // projectKey filter
}

export interface AdminErrorResponse {
  success: false;
  error: string;
}