'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RouteGuard } from '@/components/route-guard';
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

function AdminPageContent() {
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
  const [pocView, setPocView] = useState<'gallery' | 'tree'>('tree');
  
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
    // For POCs tab, fetch 'all' so tracker entries also appear in the tree
    const typeToFetch: FileType = fileType === 'poc' ? 'all' : fileType;
    await fetchOrgFiles(org._id, { type: typeToFetch });
  }, [fetchOrgFiles, fileType]);

  const handleFileTypeChange = useCallback(async (type: FileType) => {
    setFileType(type);
    if (selectedOrg) {
      const typeToFetch: FileType = type === 'poc' ? 'all' : type;
      await fetchOrgFiles(selectedOrg._id, { 
        type: typeToFetch, 
        project: selectedProject || undefined 
      });
    }
  }, [selectedOrg, selectedProject, fetchOrgFiles]);

  const handleProjectChange = useCallback(async (projectKey: string) => {
    setSelectedProject(projectKey);
    if (selectedOrg) {
      const typeToFetch: FileType = fileType === 'poc' ? 'all' : fileType;
      await fetchOrgFiles(selectedOrg._id, { 
        type: typeToFetch, 
        project: projectKey || undefined 
      });
    }
  }, [selectedOrg, fileType, fetchOrgFiles]);

  const handleFileUpload = useCallback(async (
    files: FileList, 
    type: 'report' | 'tracker',
    metadata?: FileMetadata,
    pocs?: File
  ) => {
    if (!selectedOrg || !files.length) return;

    setUploading(true);
    try {
      const filesArr = Array.from(files);
      const uploadPromises = filesArr.map((file, index) => {
        const params: UploadFileParams = { 
          file,
          metadata: metadata && Object.values(metadata).some(v => v.trim()) ? metadata : undefined,
          // Only attach POCS once (with the first tracker upload)
          ...(type === 'tracker' && index === 0 && pocs ? { pocs } : {}),
        };
        return uploadOrgFile(selectedOrg._id, type, params);
      });

      await Promise.all(uploadPromises);
      const typeToFetch: FileType = fileType === 'poc' ? 'all' : fileType;
      await fetchOrgFiles(selectedOrg._id, { 
        type: typeToFetch, 
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
      const typeToFetch: FileType = fileType === 'poc' ? 'all' : fileType;
      await fetchOrgFiles(selectedOrg._id, { 
        type: typeToFetch, 
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
                      onUpload={(files: FileList, metadata?: FileMetadata, pocs?: File) => handleFileUpload(files, 'tracker', metadata, pocs)}
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
                        <button
                          onClick={() => handleFileTypeChange('poc')}
                          className={`px-3 py-1 rounded text-sm transition-colors ${
                            fileType === 'poc'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                          }`}
                        >
                          POCs ({orgFiles.filter(f => f.type === 'poc').length})
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
                      {fileType === 'poc' && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">View:</span>
                          <div className="inline-flex rounded-md overflow-hidden border border-border">
                            <button
                              onClick={() => setPocView('tree')}
                              className={`px-3 py-1 text-sm ${pocView === 'tree' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'}`}
                            >
                              Tree
                            </button>
                            <button
                              onClick={() => setPocView('gallery')}
                              className={`px-3 py-1 text-sm ${pocView === 'gallery' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'}`}
                            >
                              Gallery
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {fileType === 'poc' ? (
                    pocView === 'gallery' ? (
                      <POCGallery files={orgFiles.filter(f => f.type === 'poc')} onDelete={handleFileDelete} />
                    ) : (
                      <POCSTree files={orgFiles.filter(f => f.type === 'poc' || f.type === 'tracker')} orgId={selectedOrg._id} onDelete={handleFileDelete} />
                    )
                  ) : (
                    <FileListComponent 
                      files={orgFiles}
                      onDelete={handleFileDelete}
                    />
                  )}
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
  onUpload: (files: FileList, metadata?: FileMetadata, pocs?: File) => void;
  uploading: boolean;
}

function FileUploadDropzone({ type, onUpload, uploading }: FileUploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [pocsFile, setPocsFile] = useState<File | null>(null);
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
    setPocsFile(null);
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
      onUpload(selectedFiles, metadata, pocsFile || undefined);
      resetForm();
    }
  };

  const handleSkipMetadata = () => {
    if (selectedFiles) {
      onUpload(selectedFiles, undefined, pocsFile || undefined);
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

            {type === 'tracker' && (
              <div className="p-3 bg-muted/30 rounded border">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  POCS Zip (optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    onChange={(e) => setPocsFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                    className="hidden"
                    id={`pocs-${type}`}
                    disabled={uploading}
                  />
                  <label
                    htmlFor={`pocs-${type}`}
                    className="inline-block bg-secondary text-secondary-foreground px-3 py-1 rounded-md cursor-pointer hover:bg-secondary/90 text-xs"
                  >
                    {pocsFile ? 'Change Zip' : 'Choose Zip'}
                  </label>
                  <span className="text-xs text-muted-foreground truncate">
                    {pocsFile ? pocsFile.name : 'No file selected'}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  If provided, this zip will be uploaded alongside the tracker and organized under the same project.
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
                {file.type === 'report' ? '📊' : file.type === 'tracker' ? '📋' : '🧪'}
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

// POC Gallery Component
interface POCGalleryProps {
  files: OrgFile[];
  onDelete: (fileId: string) => void;
}

function POCGallery({ files, onDelete }: POCGalleryProps) {
  // Group POC files by projectKey (or 'Ungrouped')
  const groups = files.reduce<Record<string, OrgFile[]>>((acc, f) => {
    const key = f.projectKey || 'Ungrouped';
    acc[key] = acc[key] || [];
    acc[key].push(f);
    return acc;
  }, {});

  const isImage = (mime: string) => mime?.startsWith('image/');
  const formatFileSize = (bytes: number) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const groupEntries = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));

  if (groupEntries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">No POCs found</div>
    );
  }

  return (
    <div className="space-y-6">
      {groupEntries.map(([projectKey, groupFiles]) => {
        const first = groupFiles[0];
        const project = first.project;
        return (
          <div key={projectKey} className="border border-border rounded-lg bg-card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="text-sm">
                <div className="font-semibold flex items-center gap-2">
                  <span>Project</span>
                  <span className="px-2 py-0.5 text-xs rounded bg-primary/20 text-primary">
                    {project?.name || projectKey}
                  </span>
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {project?.date && <span className="mr-2">Date: {project.date}</span>}
                  {project?.type && <span>Type: {project.type}</span>}
                  {!project && projectKey !== 'Ungrouped' && (
                    <span className="ml-2">Key: {projectKey}</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{groupFiles.length} item(s)</div>
            </div>

            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {groupFiles.map((file) => (
                <div key={file.id} className="bg-background rounded-md border border-border overflow-hidden flex flex-col">
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="block group">
                    <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                      {isImage(file.mimeType) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.url}
                          alt={file.fileName}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="text-3xl">📄</div>
                      )}
                    </div>
                  </a>
                  <div className="p-2 text-xs flex-1 flex flex-col gap-1">
                    <div className="font-medium truncate" title={file.fileName}>{file.fileName}</div>
                    <div className="text-muted-foreground">
                      {formatFileSize(file.size)} • {file.mimeType}
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        View
                      </a>
                      <button
                        onClick={() => onDelete(file.id)}
                        className="px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// POC + Tracker Tree Component
interface POCSTreeProps {
  files: OrgFile[]; // Expect mixture of 'poc' and 'tracker' files
  orgId: string;
  onDelete: (fileId: string) => void;
}

function POCSTree({ files, orgId, onDelete }: POCSTreeProps) {
  // Split into tracker and POCS by inspecting s3 key path
  const rel = (key: string) => key.startsWith(`${orgId}/`) ? key.slice(orgId.length + 1) : key;

  // Tracker grouping: tracker/<projectKey>/vX/<filename>
  const tracker = files.filter(f => f.type === 'tracker').reduce<Record<string, Record<string, OrgFile[]>>>((acc, f) => {
    const parts = rel(f.key).split('/');
    if (parts[0] !== 'tracker') return acc;
    const projectKey = parts[1] || '(unknown)';
    const versionFolder = parts[2] || '(v?)';
    acc[projectKey] = acc[projectKey] || {};
    acc[projectKey][versionFolder] = acc[projectKey][versionFolder] || [];
    acc[projectKey][versionFolder].push(f);
    return acc;
  }, {});

  // POCS grouping: POCS/<projectKey>/(optional folder)/file
  type PocsGroup = Record<string, { root: OrgFile[]; folders: Record<string, OrgFile[]> }>;
  const pocs: PocsGroup = files.filter(f => f.type === 'poc').reduce<PocsGroup>((acc, f) => {
    const parts = rel(f.key).split('/');
    if (parts[0] !== 'POCS') return acc;
    const projectKey = parts[1] || '(unknown)';
    const sub = parts.slice(2);
    if (!acc[projectKey]) acc[projectKey] = { root: [], folders: {} };
    if (sub.length <= 1) {
      acc[projectKey].root.push(f);
    } else {
      const folder = sub[0];
      acc[projectKey].folders[folder] = acc[projectKey].folders[folder] || [];
      acc[projectKey].folders[folder].push(f);
    }
    return acc;
  }, {});

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-muted/40 border-b border-border font-medium text-sm">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );

  const FileRow: React.FC<{ file: OrgFile }> = ({ file }) => (
    <div className="flex items-center justify-between p-2 bg-background rounded border border-border">
      <div className="text-xs truncate mr-2" title={file.key}>
        {file.key.replace(`${orgId}/`, '')}
      </div>
      <div className="flex items-center gap-2">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
        >
          View
        </a>
        <button
          onClick={() => onDelete(file.id)}
          className="px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
        >
          Delete
        </button>
      </div>
    </div>
  );

  const renderTracker = () => {
    const projects = Object.keys(tracker).sort();
    if (projects.length === 0) return <div className="text-xs text-muted-foreground">No tracker files</div>;
    return (
      <div className="space-y-3">
        {projects.map(pk => {
          const versions = Object.keys(tracker[pk]).sort();
          return (
            <details key={pk} open className="rounded border border-border">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm bg-card/60">{pk}</summary>
              <div className="p-3 space-y-2">
                {versions.map(v => (
                  <details key={v} open className="rounded border border-border">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs text-muted-foreground">{v}</summary>
                    <div className="p-2 space-y-2">
                      {tracker[pk][v].map(f => (
                        <FileRow key={f.id} file={f} />
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    );
  };

  const renderPocs = () => {
    const projects = Object.keys(pocs).sort();
    if (projects.length === 0) return <div className="text-xs text-muted-foreground">No POCs</div>;
    return (
      <div className="space-y-3">
        {projects.map(pk => {
          const group = pocs[pk];
          const folders = Object.keys(group.folders).sort();
          const hasRoot = group.root.length > 0;
          return (
            <details key={pk} open className="rounded border border-border">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm bg-card/60">{pk}</summary>
              <div className="p-3 space-y-3">
                {hasRoot && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">(root)</div>
                    <div className="space-y-2">
                      {group.root.map(f => <FileRow key={f.id} file={f} />)}
                    </div>
                  </div>
                )}
                {folders.map(folder => (
                  <details key={folder} open className="rounded border border-border">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs">{folder}</summary>
                    <div className="p-2 space-y-2">
                      {group.folders[folder].map(f => <FileRow key={f.id} file={f} />)}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Section title="tracker/">{renderTracker()}</Section>
      <Section title="POCS/">{renderPocs()}</Section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RouteGuard requiredRoute="/admin" showUnauthorized={true}>
      <AdminPageContent />
    </RouteGuard>
  );
}