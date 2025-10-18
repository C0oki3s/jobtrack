'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  getAdminOrganizations, 
  clearToken,
  getOrgFiles,
  uploadOrgFile,
  deleteOrgFile 
} from '@/lib/api';
import { 
  AdminOrganization, 
  AdminOrganizationListResponse,
  OrgFile,
  FileType,
  UploadFileParams 
} from '@/types/admin';

export default function AdminPage() {
  const [organizations, setOrganizations] = useState<AdminOrganizationListResponse | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<AdminOrganization | null>(null);
  const [orgFiles, setOrgFiles] = useState<OrgFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [fileType, setFileType] = useState<FileType>('all');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  const fetchOrganizations = useCallback(async (page = 1, search = '') => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminOrganizations({ page, limit: 20, search: search || undefined });
      setOrganizations(data);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch organizations';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrgFiles = useCallback(async (orgId: string, params?: { type?: FileType; project?: string }) => {
    try {
      const data = await getOrgFiles(orgId, params);
      setOrgFiles(data.items);
      
      // Extract unique project keys for filtering
      const projects = Array.from(new Set(
        data.items
          .filter(file => file.projectKey)
          .map(file => file.projectKey!)
      )).sort();
      setAvailableProjects(projects);
    } catch (err) {
      console.error('Failed to fetch org files:', err);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    await fetchOrganizations(1, searchTerm);
  }, [searchTerm, fetchOrganizations]);

  const handleOrgSelect = useCallback(async (org: AdminOrganization) => {
    setSelectedOrg(org);
    await fetchOrgFiles(org._id, { type: fileType });
  }, [fetchOrgFiles, fileType]);

  const handleFileTypeChange = useCallback(async (type: FileType) => {
    setFileType(type);
    if (selectedOrg) {
      await fetchOrgFiles(selectedOrg._id, { 
        type, 
        project: selectedProject || undefined 
      });
    }
  }, [selectedOrg, selectedProject, fetchOrgFiles]);

  const handleProjectChange = useCallback(async (projectKey: string) => {
    setSelectedProject(projectKey);
    if (selectedOrg) {
      await fetchOrgFiles(selectedOrg._id, { 
        type: fileType, 
        project: projectKey || undefined 
      });
    }
  }, [selectedOrg, fileType, fetchOrgFiles]);

  const handleFileUpload = useCallback(async (
    files: FileList, 
    type: 'report' | 'tracker',
    metadata?: FileMetadata
  ) => {
    if (!selectedOrg || !files.length) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(file => {
        const params: UploadFileParams = { 
          file,
          metadata: metadata && Object.values(metadata).some(v => v.trim()) ? metadata : undefined
        };
        return uploadOrgFile(selectedOrg._id, type, params);
      });

      await Promise.all(uploadPromises);
      await fetchOrgFiles(selectedOrg._id, { 
        type: fileType, 
        project: selectedProject || undefined 
      });
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [selectedOrg, fileType, selectedProject, fetchOrgFiles]);

  const handleFileDelete = useCallback(async (fileId: string) => {
    if (!selectedOrg || !confirm('Are you sure you want to delete this file?')) return;

    try {
      await deleteOrgFile(selectedOrg._id, fileId);
      await fetchOrgFiles(selectedOrg._id, { 
        type: fileType, 
        project: selectedProject || undefined 
      });
    } catch (err) {
      console.error('Delete failed:', err);
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [selectedOrg, fileType, selectedProject, fetchOrgFiles]);

  const handleLogout = useCallback(() => {
    clearToken();
    router.push('/login');
  }, [router]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Handle organization selection from URL params
  useEffect(() => {
    const orgId = searchParams.get('org');
    if (orgId && organizations?.items) {
      const org = organizations.items.find(o => o._id === orgId);
      if (org) {
        handleOrgSelect(org);
      }
    }
  }, [searchParams, organizations, handleOrgSelect]);

  if (loading && !organizations) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !organizations) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-4">Admin Access Error</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="space-y-2">
            <button 
              onClick={() => fetchOrganizations()} 
              className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-accent"
            >
              Retry
            </button>
            <button 
              onClick={handleLogout}
              className="w-full bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border pb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage organizations, upload files, and monitor system resources
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/organizations')}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90"
            >
              ← Organizations
            </button>
            <button
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Organizations Sidebar */}
          <div className="col-span-4 space-y-4">
            <div className="bg-card p-6 rounded-lg border border-border">
              <h2 className="text-xl font-semibold mb-4">Organizations</h2>
              
              {/* Search */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Search organizations..."
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  Search
                </button>
              </div>

              {/* Organization List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {organizations?.items.map((org) => (
                  <div
                    key={org._id}
                    onClick={() => handleOrgSelect(org)}
                    className={`p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedOrg?._id === org._id
                        ? 'bg-accent border-accent text-accent-foreground'
                        : 'bg-card border-border hover:bg-accent/50'
                    }`}
                  >
                    <div className="font-medium text-sm">{org.name}</div>
                    <div className="text-xs text-muted-foreground">{org.domain}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {organizations && organizations.total > organizations.limit && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <button
                    onClick={() => fetchOrganizations(currentPage - 1, searchTerm)}
                    disabled={currentPage <= 1 || loading}
                    className="bg-secondary text-secondary-foreground px-3 py-1 rounded text-sm hover:bg-secondary/90 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {Math.ceil(organizations.total / organizations.limit)}
                  </span>
                  <button
                    onClick={() => fetchOrganizations(currentPage + 1, searchTerm)}
                    disabled={currentPage >= Math.ceil(organizations.total / organizations.limit) || loading}
                    className="bg-secondary text-secondary-foreground px-3 py-1 rounded text-sm hover:bg-secondary/90 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="col-span-8 space-y-4">
            {selectedOrg ? (
              <>
                {/* Organization Details */}
                <div className="bg-card p-6 rounded-lg border border-border">
                  <h2 className="text-xl font-semibold mb-2">{selectedOrg.name}</h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Domain:</span>
                      <span className="ml-2">{selectedOrg.domain}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <span className="ml-2">{new Date(selectedOrg.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">ID:</span>
                      <span className="ml-2 font-mono text-xs">{selectedOrg._id}</span>
                    </div>
                  </div>
                </div>

                {/* File Upload Section */}
                <div className="bg-card p-6 rounded-lg border border-border">
                  <h3 className="text-lg font-semibold mb-4">Upload Files</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FileUploadDropzone
                      type="report"
                      onUpload={(files: FileList, metadata?: FileMetadata) => handleFileUpload(files, 'report', metadata)}
                      uploading={uploading}
                    />
                    <FileUploadDropzone
                      type="tracker"
                      onUpload={(files: FileList, metadata?: FileMetadata) => handleFileUpload(files, 'tracker', metadata)}
                      uploading={uploading}
                    />
                  </div>
                </div>

                {/* File Management Section */}
                <div className="bg-card p-6 rounded-lg border border-border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Files</h3>
                    <div className="flex flex-col gap-3">
                      {/* File Type Filters */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleFileTypeChange('all')}
                          className={`px-3 py-1 rounded text-sm transition-colors ${
                            fileType === 'all'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                          }`}
                        >
                          All ({orgFiles.length})
                        </button>
                        <button
                          onClick={() => handleFileTypeChange('report')}
                          className={`px-3 py-1 rounded text-sm transition-colors ${
                            fileType === 'report'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                          }`}
                        >
                          Reports ({orgFiles.filter(f => f.type === 'report').length})
                        </button>
                        <button
                          onClick={() => handleFileTypeChange('tracker')}
                          className={`px-3 py-1 rounded text-sm transition-colors ${
                            fileType === 'tracker'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                          }`}
                        >
                          Trackers ({orgFiles.filter(f => f.type === 'tracker').length})
                        </button>
                      </div>
                      
                      {/* Project Filter */}
                      {availableProjects.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Filter by Project:</span>
                          <select
                            value={selectedProject}
                            onChange={(e) => handleProjectChange(e.target.value)}
                            className="px-3 py-1 bg-input border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <option value="">All Projects</option>
                            {availableProjects.map(project => (
                              <option key={project} value={project}>{project}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <FileListComponent 
                    files={orgFiles}
                    onDelete={handleFileDelete}
                  />
                </div>
              </>
            ) : (
              <div className="bg-card p-12 rounded-lg border border-border text-center">
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  Select an Organization
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose an organization from the sidebar to manage its files and settings.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Metadata form interface
interface FileMetadata extends Record<string, string> {
  projectSummary: string;
  projectName: string;
  projectDate: string;
  projectType: string;
  reportName: string;
  date_projecttype_projectname: string; // Special backend field for project organization
}

// File Upload Dropzone Component
interface FileUploadDropzoneProps {
  type: 'report' | 'tracker';
  onUpload: (files: FileList, metadata?: FileMetadata) => void;
  uploading: boolean;
}

function FileUploadDropzone({ type, onUpload, uploading }: FileUploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata>({
    projectSummary: '',
    projectName: '',
    projectDate: '',
    projectType: '',
    reportName: '',
    date_projecttype_projectname: ''
  });

  const resetForm = () => {
    setSelectedFiles(null);
    setShowMetadataForm(false);
    setMetadata({
      projectSummary: '',
      projectName: '',
      projectDate: '',
      projectType: '',
      reportName: '',
      date_projecttype_projectname: ''
    });
  };

  // Generate the special backend field format: date_projecttype_projectname
  const generateProjectKey = (date: string, type: string, name: string) => {
    if (!date || !type || !name) return '';
    // Format: YYYY-MM-DD_projecttype_projectname
    const cleanDate = date.replace(/-/g, '-');
    const cleanType = type.toLowerCase().replace(/\s+/g, '');
    const cleanName = name.toLowerCase().replace(/\s+/g, '');
    return `${cleanDate}_${cleanType}_${cleanName}`;
  };

  const updateMetadata = (field: keyof FileMetadata, value: string) => {
    const newMetadata = { ...metadata, [field]: value };
    
    // Auto-generate the special field when project fields change
    if (field === 'projectDate' || field === 'projectType' || field === 'projectName') {
      newMetadata.date_projecttype_projectname = generateProjectKey(
        field === 'projectDate' ? value : metadata.projectDate,
        field === 'projectType' ? value : metadata.projectType,
        field === 'projectName' ? value : metadata.projectName
      );
    }
    
    setMetadata(newMetadata);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      setSelectedFiles(e.dataTransfer.files);
      setShowMetadataForm(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
      setShowMetadataForm(true);
    }
  };

  const handleUploadWithMetadata = () => {
    if (selectedFiles) {
      onUpload(selectedFiles, metadata);
      resetForm();
    }
  };

  const handleSkipMetadata = () => {
    if (selectedFiles) {
      onUpload(selectedFiles);
      resetForm();
    }
  };

  if (showMetadataForm && selectedFiles) {
    return (
      <div className="border-2 border-solid rounded-lg p-6 bg-card">
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-2xl mb-2">{type === 'report' ? '📊' : '📋'}</div>
            <div className="font-medium capitalize">{type} Files</div>
            <div className="text-sm text-muted-foreground">
              {selectedFiles.length} file(s) selected
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Project Metadata (Optional)</h4>
            {metadata.date_projecttype_projectname && (
              <div className="p-2 bg-primary/10 rounded border">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Project Key:</span> {metadata.date_projecttype_projectname}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Files will be organized under this project folder in storage
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={metadata.projectName}
                  onChange={(e) => updateMetadata('projectName', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Report Name
                </label>
                <input
                  type="text"
                  value={metadata.reportName}
                  onChange={(e) => updateMetadata('reportName', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Enter report name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Project Type
                </label>
                <input
                  type="text"
                  value={metadata.projectType}
                  onChange={(e) => updateMetadata('projectType', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Enter project type (e.g., research, development, analysis)"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Project Date
                </label>
                <input
                  type="date"
                  value={metadata.projectDate}
                  onChange={(e) => updateMetadata('projectDate', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Project Summary
                </label>
                <textarea
                  value={metadata.projectSummary}
                  onChange={(e) => updateMetadata('projectSummary', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  placeholder="Brief summary of the project..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleUploadWithMetadata}
              disabled={uploading}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm"
            >
              {uploading ? 'Uploading...' : 'Upload with Metadata'}
            </button>
            <button
              onClick={handleSkipMetadata}
              disabled={uploading}
              className="flex-1 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 disabled:opacity-50 text-sm"
            >
              Upload without Metadata
            </button>
            <button
              onClick={resetForm}
              disabled={uploading}
              className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 disabled:opacity-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragOver
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-accent'
      } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className="space-y-2">
        <div className="text-2xl">{type === 'report' ? '📊' : '📋'}</div>
        <div className="font-medium capitalize">{type} Files</div>
        <div className="text-sm text-muted-foreground">
          Drag and drop files here or click to browse
        </div>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id={`upload-${type}`}
          disabled={uploading}
        />
        <label
          htmlFor={`upload-${type}`}
          className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md cursor-pointer hover:bg-primary/90 text-sm"
        >
          {uploading ? 'Uploading...' : 'Browse Files'}
        </label>
      </div>
    </div>
  );
}

// File List Component
interface FileListProps {
  files: OrgFile[];
  onDelete: (fileId: string) => void;
}

function FileListComponent({ files, onDelete }: FileListProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderMetadata = (metadata: Record<string, unknown>) => {
    const getValue = (key: string): string | null => {
      const value = metadata[key];
      return typeof value === 'string' && value.trim() ? value : null;
    };

    const projectName = getValue('projectName');
    const reportName = getValue('reportName');
    const projectType = getValue('projectType');
    const projectDate = getValue('projectDate');
    const projectSummary = getValue('projectSummary');

    const hasAnyData = projectName || reportName || projectType || projectDate || projectSummary;
    
    if (!hasAnyData) return null;

    return (
      <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/30 rounded border">
        <div className="font-medium mb-1">Project Metadata:</div>
        <div className="grid grid-cols-2 gap-1">
          {projectName && (
            <div><span className="font-medium">Project:</span> {projectName}</div>
          )}
          {reportName && (
            <div><span className="font-medium">Report:</span> {reportName}</div>
          )}
          {projectType && (
            <div><span className="font-medium">Type:</span> {projectType}</div>
          )}
          {projectDate && (
            <div><span className="font-medium">Date:</span> {new Date(projectDate).toLocaleDateString()}</div>
          )}
        </div>
        {projectSummary && (
          <div className="mt-2">
            <span className="font-medium">Summary:</span> {projectSummary}
          </div>
        )}
      </div>
    );
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No files found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between p-3 bg-background rounded-md border border-border"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm">
                {file.type === 'report' ? '📊' : '📋'}
              </span>
              <span className="font-medium text-sm">{file.fileName}</span>
              <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">
                v{file.version}
              </span>
              {file.project && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                  {file.project.name}
                </span>
              )}
            </div>
            {file.project && (
              <div className="text-xs text-muted-foreground mt-1">
                <span className="font-medium">Project:</span> {file.project.name} • 
                <span className="font-medium">Type:</span> {file.project.type} • 
                <span className="font-medium">Date:</span> {file.project.date}
                {file.projectKey && <span> • <span className="font-medium">Key:</span> {file.projectKey}</span>}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {formatFileSize(file.size)} • {file.mimeType} • {new Date(file.createdAt).toLocaleString()}
              {file.uploadedBy && <span> • Uploaded by {file.uploadedBy}</span>}
            </div>
            {file.metadata && Object.keys(file.metadata).length > 0 && renderMetadata(file.metadata)}
          </div>
          <div className="flex items-center gap-2 ml-4">
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm hover:bg-primary/90"
            >
              Download
            </a>
            <button
              onClick={() => onDelete(file.id)}
              className="bg-destructive text-destructive-foreground px-3 py-1 rounded text-sm hover:bg-destructive/90"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}