'use client';

import { useEffect, useState, useCallback } from 'react';
import { getOrganizations, clearToken } from '@/lib/api';
import { OrganizationListData } from '@/types/jobtracker';
import { useRouter } from 'next/navigation';

export default function OrganizationsPage() {
  const [data, setData] = useState<OrganizationListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  const fetchOrganizations = useCallback(async (page = 1, search = '', withSync = false) => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching organizations with params:', { page, search, withSync });
      const orgData = await getOrganizations(page, 10, search || undefined, withSync);
      console.log('Received organization data:', orgData);
      
      if (!orgData) {
        throw new Error('No data received from API');
      }
      
      setData(orgData as OrganizationListData);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch organizations';
      console.error('Error details:', { err, type: typeof err, keys: err && typeof err === 'object' ? Object.keys(err) : 'N/A' });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    await fetchOrganizations(1, searchTerm);
  }, [searchTerm, fetchOrganizations]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await fetchOrganizations(currentPage, searchTerm, true);
    } finally {
      setSyncing(false);
    }
  }, [currentPage, searchTerm, fetchOrganizations]);

  const handleOrganizationClick = useCallback((organizationId: string) => {
    router.push(`/jobtrack?org=${organizationId}`);
  }, [router]);

  const handleLogout = useCallback(() => {
    clearToken();
    router.push('/login');
  }, [router]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-4">Error Loading Organizations</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="space-y-2 mb-4">
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
              Logout and Login Again
            </button>
          </div>
          <div className="text-xs text-muted-foreground bg-card p-3 rounded border">
            <p>Debug Info:</p>
            <p>API Base URL: {process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}</p>
            <p>Endpoint: GET /job-tracker/?page=1&limit=10</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border pb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Organization Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Select an organization to view job tracking details
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors"
            >
              Admin
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-accent text-accent-foreground px-4 py-2 rounded-md hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {syncing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-foreground"></div>
                  Syncing...
                </>
              ) : (
                <>
                  🔄 Sync All
                </>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-muted-foreground">Total Organizations</h3>
            <p className="text-2xl font-bold text-foreground">{data.summary.totalOrganizations}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-muted-foreground">Total Jobs</h3>
            <p className="text-2xl font-bold text-foreground">{data.summary.totalJobs}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-muted-foreground">Total Sessions</h3>
            <p className="text-2xl font-bold text-foreground">{data.summary.totalSessions}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-muted-foreground">Organizations Shown</h3>
            <p className="text-2xl font-bold text-accent">{data.summary.organizationsShown}</p>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-foreground mb-2">
                Search Organizations
              </label>
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="Search by organization name, domain, or ID..."
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
          
          {data.summary.searchQuery && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Search results for: <span className="font-medium text-foreground">&ldquo;{data.summary.searchQuery}&rdquo;</span>
              </p>
            </div>
          )}
        </div>

        {/* Organizations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.organizations.map((orgData) => (
            <div
              key={orgData.organization.id}
              className="bg-card p-6 rounded-lg border border-border cursor-pointer hover:bg-accent/5 transition-colors"
              onClick={() => handleOrganizationClick(orgData.organization.id)}
            >
              {/* Organization Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{orgData.organization.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(orgData.organization.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Organization ID</p>
                  <p className="text-xs font-mono text-foreground break-all">{orgData.organization.id}</p>
                </div>
              </div>

              {/* Domains */}
              <div className="mb-4">
                <p className="text-sm font-medium text-foreground mb-2">Domains ({orgData.organization.domains.length})</p>
                <div className="flex flex-wrap gap-2">
                  {orgData.organization.domains.map((domain, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-accent/20 text-accent rounded text-xs font-medium"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Jobs</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-foreground">{orgData.jobStatistics.totalJobs}</p>
                    {orgData.jobStatistics.totalJobs > 0 && (
                      <div className="flex gap-1">
                        {orgData.jobStatistics.statusCounts.running && (
                          <span className="px-1 py-0.5 bg-primary/20 text-primary rounded text-xs">
                            {orgData.jobStatistics.statusCounts.running} running
                          </span>
                        )}
                        {orgData.jobStatistics.statusCounts.succeeded && (
                          <span className="px-1 py-0.5 bg-accent/20 text-accent rounded text-xs">
                            {orgData.jobStatistics.statusCounts.succeeded} succeeded
                          </span>
                        )}
                        {orgData.jobStatistics.statusCounts.failed && (
                          <span className="px-1 py-0.5 bg-destructive/20 text-destructive rounded text-xs">
                            {orgData.jobStatistics.statusCounts.failed} failed
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sessions</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-foreground">{orgData.sessionStatistics.totalSessions}</p>
                    {orgData.sessionStatistics.totalSessions > 0 && (
                      <div className="flex gap-1">
                        {orgData.sessionStatistics.activeSessions > 0 && (
                          <span className="px-1 py-0.5 bg-primary/20 text-primary rounded text-xs">
                            {orgData.sessionStatistics.activeSessions} active
                          </span>
                        )}
                        {orgData.sessionStatistics.completedSessions > 0 && (
                          <span className="px-1 py-0.5 bg-accent/20 text-accent rounded text-xs">
                            {orgData.sessionStatistics.completedSessions} completed
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Jobs */}
              {orgData.recentJobs.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Recent Jobs</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {orgData.recentJobs.slice(0, 3).map((job) => (
                      <div key={job.jobId} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{job.statusInfo.emoji}</span>
                          <span className="text-foreground truncate">{job.jobName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{job.domain}</span>
                          <span className={`px-1 py-0.5 rounded text-xs ${
                            job.status === 'running' ? 'bg-primary/20 text-primary' :
                            job.status === 'succeeded' ? 'bg-accent/20 text-accent' :
                            job.status === 'failed' ? 'bg-destructive/20 text-destructive' :
                            'bg-muted/20 text-foreground'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {orgData.recentJobs.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{orgData.recentJobs.length - 3} more jobs
                      </p>
                    )}
                  </div>
                </div>
              )}

              {orgData.jobStatistics.totalJobs === 0 && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm">No jobs found for this organization</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={() => fetchOrganizations(currentPage - 1, searchTerm)}
              disabled={!data.pagination.hasPrevPage || loading}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-foreground">
              Page {data.pagination.currentPage} of {data.pagination.totalPages}
            </span>
            <button
              onClick={() => fetchOrganizations(currentPage + 1, searchTerm)}
              disabled={!data.pagination.hasNextPage || loading}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {data.organizations.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No organizations found</p>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  fetchOrganizations(1, '');
                }}
                className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}