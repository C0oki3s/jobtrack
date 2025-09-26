'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { getFilteredJobTrackerData, clearToken, getSessionDetails, getJobDetails, syncOrganization, syncSession } from '@/lib/api';
import { JobTrackerData, SessionDetailData, JobDetailData } from '@/types/jobtracker';
import { useRouter, useSearchParams } from 'next/navigation';

const DEFAULT_ORGANIZATION_ID = '67fbe974cb39023f3e902eef';
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'text-primary' },
  { value: 'submitted', label: 'Submitted', color: 'text-accent' },
  { value: 'failed', label: 'Failed', color: 'text-destructive' },
  { value: 'completed', label: 'Completed', color: 'text-foreground' },
  { value: 'succeeded', label: 'Succeeded', color: 'text-accent' },
];

export default function JobTrackPage() {
  const [data, setData] = useState<JobTrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['pending', 'submitted', 'failed', 'succeeded', 'completed']);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionDetailData | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobDetailData | null>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobSheetOpen, setJobSheetOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingSession, setSyncingSession] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get organization ID from query params or use default
  const organizationId = searchParams.get('org') || DEFAULT_ORGANIZATION_ID;

  const fetchJobData = useCallback(async () => {
    try {
      setError(null);
      const response = await getFilteredJobTrackerData(
        organizationId,
        selectedStatuses.length > 0 ? selectedStatuses : ['running', 'pending', 'failed'],
        50
      );
      setData(response as JobTrackerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job data');
    } finally {
      setLoading(false);
    }
  }, [selectedStatuses, organizationId]);

  // Filter jobs based on search term
  const filteredJobs = useMemo(() => {
    if (!data?.jobs) return [];
    
    if (!searchTerm.trim()) return data.jobs;
    
    const term = searchTerm.toLowerCase();
    return data.jobs.filter(job => 
      job.jobId.toLowerCase().includes(term) ||
      job.jobName.toLowerCase().includes(term) ||
      job.parentJobId.toLowerCase().includes(term)
    );
  }, [data?.jobs, searchTerm]);

  useEffect(() => {
    fetchJobData();
  }, [fetchJobData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchJobData, 30000);
    setRefreshInterval(interval);
    
    return () => {
      clearInterval(interval);
    };
  }, [fetchJobData]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleLogout = () => {
    clearToken();
    router.replace('/login');
  };

  const handleSessionClick = useCallback(async (sessionId: string) => {
    setSessionLoading(true);
    try {
      const sessionData = await getSessionDetails(sessionId) as SessionDetailData;
      setSelectedSession(sessionData);
      setSheetOpen(true);
    } catch (err) {
      console.error('Failed to fetch session details:', err);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const handleJobClick = useCallback(async (jobId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent session click if job is inside session
    setJobLoading(true);
    try {
      const jobData = await getJobDetails(jobId) as JobDetailData;
      setSelectedJob(jobData);
      setJobSheetOpen(true);
    } catch (err) {
      console.error('Failed to fetch job details:', err);
    } finally {
      setJobLoading(false);
    }
  }, []);

  const handleOrgSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncOrganization(organizationId, selectedStatuses.length > 0 ? selectedStatuses : ['running', 'pending', 'submitted']);
      // Refresh data after sync
      await fetchJobData();
    } catch (err) {
      console.error('Failed to sync organization:', err);
    } finally {
      setSyncing(false);
    }
  }, [selectedStatuses, fetchJobData, organizationId]);

  const handleSessionSync = useCallback(async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent session click
    setSyncingSession(sessionId);
    try {
      await syncSession(sessionId);
      // Refresh data after sync
      await fetchJobData();
    } catch (err) {
      console.error('Failed to sync session:', err);
    } finally {
      setSyncingSession(null);
    }
  }, [fetchJobData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>         
          <p className="text-muted-foreground">{error}</p>
          <button 
            onClick={() => fetchJobData()} 
            className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-accent"
          >
            Retry
          </button>
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
        {/* Header with Back Button and Logout */}
        <div className="flex justify-between items-center border-b border-border pb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/organizations')}
              className="bg-secondary text-secondary-foreground px-3 py-2 rounded-md hover:bg-secondary/90 transition-colors flex items-center gap-2"
            >
              ← Back to Organizations
            </button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">AWS Batch JobTracker</h1>
              <p className="text-muted-foreground mt-1">
                Organization: {data.organization.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOrgSync}
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
                  🔄 Sync Organization
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
            <h3 className="text-sm font-medium text-muted-foreground">Total Jobs</h3>
            <p className="text-2xl font-bold text-foreground">{data.summary.totalJobs}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-muted-foreground">Total Sessions</h3>
            <p className="text-2xl font-bold text-foreground">{data.summary.totalSessions}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-muted-foreground">Pending Jobs</h3>
            <p className="text-2xl font-bold text-primary">{data.summary.statusCounts.pending}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-muted-foreground">Failed Jobs</h3>
            <p className="text-2xl font-bold text-destructive">{data.summary.statusCounts.failed}</p>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Search Bar */}
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-foreground mb-2">
                Search Jobs (ID, Name, Parent ID)
              </label>
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="Enter job ID, name, or parent ID..."
              />
            </div>

            {/* Status Filter */}
            <div className="md:w-80">
              <label className="block text-sm font-medium text-foreground mb-2">
                Filter by Status
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => handleStatusToggle(status.value)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      selectedStatuses.includes(status.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedStatuses.length === 0 
                  ? 'Showing: all statuses (default)'
                  : `Showing: ${selectedStatuses.join(', ')}`
                }
              </p>
            </div>
          </div>

          {/* Refresh Button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Showing {filteredJobs.length} of {data.jobs.length} jobs
            </p>
            <button
              onClick={() => fetchJobData()}
              disabled={loading}
              className="bg-accent text-accent-foreground px-4 py-2 rounded-md hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Sessions Section */}
        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 className="text-xl font-semibold text-foreground mb-4">Scan Sessions</h2>
          <div className="space-y-4">
            {data.sessions.map((session) => (
              <div 
                key={session.sessionId} 
                className="border border-border rounded-lg p-4 cursor-pointer hover:bg-accent/5 transition-colors"
                onClick={() => handleSessionClick(session.sessionId)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-foreground">{session.sessionName}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleSessionSync(session.sessionId, e)}
                      disabled={syncingSession === session.sessionId}
                      className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs hover:bg-secondary/90 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      {syncingSession === session.sessionId ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-secondary-foreground"></div>
                          Syncing
                        </>
                      ) : (
                        <>
                          🔄 Sync
                        </>
                      )}
                    </button>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      session.status === 'active' ? 'bg-primary/20 text-primary' :
                      session.status === 'completed' ? 'bg-accent/20 text-accent' :
                      'bg-destructive/20 text-destructive'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Domain:</span>
                    <p className="text-foreground">{session.domain}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Child Jobs:</span>
                    <p className="text-foreground">{session.totalChildJobs}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completed:</span>
                    <p className="text-foreground">{session.completedJobs}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Failed:</span>
                    <p className="text-foreground">{session.failedJobs}</p>
                  </div>
                </div>
                {session.duration && (
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="text-foreground ml-2">
                      {session.duration.minutes}m {session.duration.seconds}s
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Jobs Section */}
        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Jobs {searchTerm && `(filtered by "${searchTerm}")`}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground">Job ID</th>
                  <th className="text-left p-2 text-muted-foreground">Job Name</th>
                  <th className="text-left p-2 text-muted-foreground">Status</th>
                  <th className="text-left p-2 text-muted-foreground">Domain</th>
                  <th className="text-left p-2 text-muted-foreground">Progress</th>
                  <th className="text-left p-2 text-muted-foreground">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.slice(0, 20).map((job) => (
                  <tr key={job.jobId} className="border-b border-border hover:bg-muted/5">
                    <td className="p-2 text-xs text-muted-foreground font-mono">{job.jobId}</td>
                    <td className="p-2">
                      <button 
                        onClick={(e) => handleJobClick(job.jobId, e)}
                        className="text-foreground hover:text-primary hover:underline cursor-pointer text-left"
                      >
                        {job.jobName}
                      </button>
                    </td>
                    <td className="p-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        job.status === 'pending' ? 'bg-primary/20 text-primary' :
                        job.status === 'submitted' ? 'bg-accent/20 text-accent' :
                        job.status === 'completed' ? 'bg-secondary/20 text-secondary-foreground' :
                        job.status === 'succeeded' ? 'bg-accent/20 text-accent' :
                        job.status === 'failed' ? 'bg-destructive/20 text-destructive' :
                        'bg-muted/20 text-foreground'
                      }`}>
                        {job.statusInfo.emoji} {job.status}
                      </span>
                    </td>
                    <td className="p-2 text-foreground">{job.domain}</td>
                    <td className="p-2 text-foreground">
                      {job.progress.subdomainsProcessed}/{job.progress.totalSubdomains}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {new Date(job.submittedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredJobs.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No jobs found matching your search criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Session Detail Sheet */}
      {sheetOpen && selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/50 flex">
          <div className="w-2/5 bg-background border-r border-border h-full overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border p-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">Session Details</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleSessionSync(selectedSession.session.sessionId, e)}
                  disabled={syncingSession === selectedSession.session.sessionId}
                  className="bg-accent text-accent-foreground px-3 py-1 rounded text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {syncingSession === selectedSession.session.sessionId ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent-foreground"></div>
                      Syncing
                    </>
                  ) : (
                    <>
                      🔄 Sync Session
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Session Info */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">
                  {selectedSession.session.sessionName}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Session ID:</span>
                    <p className="text-foreground font-mono text-xs break-all">
                      {selectedSession.session.sessionId}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p className={`text-foreground ${
                      selectedSession.session.status === 'active' ? 'text-primary' :
                      selectedSession.session.status === 'completed' ? 'text-accent' :
                      'text-destructive'
                    }`}>
                      {selectedSession.session.status.toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Domain:</span>
                    <p className="text-foreground">{selectedSession.session.domain}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Started:</span>
                    <p className="text-foreground">
                      {new Date(selectedSession.session.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Configuration */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Configuration</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Job Queue:</span>
                    <p className="text-foreground">{selectedSession.session.configuration.jobQueue}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Job Definition:</span>
                    <p className="text-foreground">{selectedSession.session.configuration.jobDefinition}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Chunk Size:</span>
                    <p className="text-foreground">{selectedSession.session.configuration.chunkSize}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Parallel:</span>
                    <p className="text-foreground">{selectedSession.session.configuration.maxParallelJobs}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">On Demand:</span>
                    <p className={selectedSession.session.configuration.useOnDemand ? 'text-primary' : 'text-muted-foreground'}>
                      {selectedSession.session.configuration.useOnDemand ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Full Scan:</span>
                    <p className={selectedSession.session.configuration.fullScan ? 'text-primary' : 'text-muted-foreground'}>
                      {selectedSession.session.configuration.fullScan ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card p-3 rounded border border-border">
                    <p className="text-sm text-muted-foreground">Total Jobs</p>
                    <p className="text-lg font-bold text-foreground">{selectedSession.summary.totalJobs}</p>
                  </div>
                  <div className="bg-card p-3 rounded border border-border">
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                    <p className="text-lg font-bold text-foreground">{selectedSession.summary.completionRate}%</p>
                  </div>
                  <div className="bg-card p-3 rounded border border-border">
                    <p className="text-sm text-muted-foreground">Succeeded</p>
                    <p className="text-lg font-bold text-accent">{selectedSession.summary.statusCounts.succeeded}</p>
                  </div>
                  <div className="bg-card p-3 rounded border border-border">
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-lg font-bold text-primary">{selectedSession.summary.statusCounts.pending}</p>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Scan Results</h4>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Subdomains Scanned:</span>
                    <p className="text-foreground font-medium">{selectedSession.session.results.subdomainsScanned}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Findings:</span>
                    <p className="text-foreground font-medium">{selectedSession.session.results.totalFindings}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Critical:</span>
                    <p className="text-destructive font-medium">{selectedSession.session.results.findingsBySeverity.critical}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">High:</span>
                    <p className="text-accent font-medium">{selectedSession.session.results.findingsBySeverity.high}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Medium:</span>
                    <p className="text-primary font-medium">{selectedSession.session.results.findingsBySeverity.medium}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Low:</span>
                    <p className="text-foreground font-medium">{selectedSession.session.results.findingsBySeverity.low}</p>
                  </div>
                </div>
              </div>

              {/* Jobs Table */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Session Jobs ({selectedSession.jobs.length})</h4>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border">
                        <th className="text-left p-2 text-muted-foreground">Job Name</th>
                        <th className="text-left p-2 text-muted-foreground">Status</th>
                        <th className="text-left p-2 text-muted-foreground">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSession.jobs.map((job) => (
                        <tr key={job.jobId} className="border-b border-border">
                          <td className="p-2">
                            <button 
                              onClick={(e) => handleJobClick(job.jobId, e)}
                              className="text-foreground hover:text-primary hover:underline cursor-pointer text-left text-xs"
                            >
                              {job.jobName}
                            </button>
                          </td>
                          <td className="p-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              job.status === 'pending' ? 'bg-primary/20 text-primary' :
                              job.status === 'succeeded' ? 'bg-accent/20 text-accent' :
                              job.status === 'failed' ? 'bg-destructive/20 text-destructive' :
                              'bg-muted/20 text-foreground'
                            }`}>
                              {job.statusInfo.emoji} {job.status}
                            </span>
                          </td>
                          <td className="p-2 text-muted-foreground">
                            {job.duration ? `${job.duration.minutes}m ${job.duration.seconds}s` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          {/* Click outside to close */}
          <div className="flex-1" onClick={() => setSheetOpen(false)} />
        </div>
      )}

      {/* Job Detail Sheet */}
      {jobSheetOpen && selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/50 flex">
          <div className="w-2/5 bg-background border-r border-border h-full overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border p-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">Job Details</h2>
              <button
                onClick={() => setJobSheetOpen(false)}
                className="text-muted-foreground hover:text-foreground p-2"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Job Info */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">
                  {selectedJob.job.jobName}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Job ID:</span>
                    <p className="text-foreground font-mono text-xs break-all">
                      {selectedJob.job.jobId}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      selectedJob.job.status === 'pending' ? 'bg-primary/20 text-primary' :
                      selectedJob.job.status === 'succeeded' ? 'bg-accent/20 text-accent' :
                      selectedJob.job.status === 'failed' ? 'bg-destructive/20 text-destructive' :
                      'bg-muted/20 text-foreground'
                    }`}>
                      {selectedJob.job.statusInfo.emoji} {selectedJob.job.status.toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Job Type:</span>
                    <p className="text-foreground capitalize">{selectedJob.job.jobType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Domain:</span>
                    <p className="text-foreground">{selectedJob.job.domain}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Queue:</span>
                    <p className="text-foreground">{selectedJob.job.jobQueue}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Definition:</span>
                    <p className="text-foreground">{selectedJob.job.jobDefinition}</p>
                  </div>
                </div>
              </div>

              {/* Timing Information */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Timing</h4>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Submitted:</span>
                    <p className="text-foreground">{new Date(selectedJob.job.submittedAt).toLocaleString()}</p>
                  </div>
                  {selectedJob.job.startedAt && (
                    <div>
                      <span className="text-muted-foreground">Started:</span>
                      <p className="text-foreground">{new Date(selectedJob.job.startedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedJob.job.completedAt && (
                    <div>
                      <span className="text-muted-foreground">Completed:</span>
                      <p className="text-foreground">{new Date(selectedJob.job.completedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedJob.job.duration && (
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <p className="text-foreground">
                        {selectedJob.job.duration.minutes}m {selectedJob.job.duration.seconds}s
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Parameters */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Parameters</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Organization ID:</span>
                    <p className="text-foreground font-mono text-xs break-all">{selectedJob.job.parameters.organizationId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Job Index:</span>
                    <p className="text-foreground">{selectedJob.job.parameters.jobIndex} of {selectedJob.job.parameters.totalJobs}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Full Scan:</span>
                    <p className={selectedJob.job.parameters.fullScan ? 'text-primary' : 'text-muted-foreground'}>
                      {selectedJob.job.parameters.fullScan ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Parent Job:</span>
                    <p className="text-foreground font-mono text-xs break-all">{selectedJob.job.parentJobId}</p>
                  </div>
                </div>
              </div>

              {/* Subdomains */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Subdomains ({selectedJob.job.parameters.subdomains.length})</h4>
                <div className="bg-card p-3 rounded border border-border max-h-40 overflow-y-auto">
                  <div className="space-y-1">
                    {selectedJob.job.parameters.subdomains.map((subdomain, index) => (
                      <div key={index} className="text-sm text-foreground font-mono">
                        {subdomain}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Progress</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-card p-3 rounded border border-border text-center">
                    <p className="text-sm text-muted-foreground">Processed</p>
                    <p className="text-lg font-bold text-foreground">{selectedJob.job.progress.subdomainsProcessed}</p>
                  </div>
                  <div className="bg-card p-3 rounded border border-border text-center">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-lg font-bold text-foreground">{selectedJob.job.progress.totalSubdomains}</p>
                  </div>
                  <div className="bg-card p-3 rounded border border-border text-center">
                    <p className="text-sm text-muted-foreground">Findings</p>
                    <p className="text-lg font-bold text-accent">{selectedJob.job.progress.findingsFound}</p>
                  </div>
                </div>
              </div>

              {/* Retry Information */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Retry Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Retry Count:</span>
                    <p className="text-foreground">{selectedJob.job.retryCount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Retries:</span>
                    <p className="text-foreground">{selectedJob.job.maxRetries}</p>
                  </div>
                </div>
              </div>

              {/* Status Reason */}
              {selectedJob.job.statusReason && (
                <div className="border-t border-border pt-4">
                  <h4 className="font-medium text-foreground mb-3">Status Reason</h4>
                  <div className="bg-card p-3 rounded border border-border">
                    <p className="text-sm text-muted-foreground">{selectedJob.job.statusReason}</p>
                  </div>
                </div>
              )}

              {/* Attempts */}
              {selectedJob.job.attempts.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h4 className="font-medium text-foreground mb-3">Attempts ({selectedJob.job.attempts.length})</h4>
                  <div className="space-y-2">
                    {selectedJob.job.attempts.map((attempt, index) => (
                      <div key={attempt._id} className="bg-card p-3 rounded border border-border">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Attempt #{index + 1}</span>
                          <span className="text-foreground">
                            {new Date(attempt.startedAt).toLocaleString()} - {new Date(attempt.stoppedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Click outside to close */}
          <div className="flex-1" onClick={() => setJobSheetOpen(false)} />
        </div>
      )}

      {/* Loading overlay for session */}
      {sessionLoading && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
          <div className="bg-background p-4 rounded-lg shadow-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span className="text-foreground">Loading session details...</span>
          </div>
        </div>
      )}

      {/* Loading overlay for job */}
      {jobLoading && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
          <div className="bg-background p-4 rounded-lg shadow-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span className="text-foreground">Loading job details...</span>
          </div>
        </div>
      )}
    </div>
  );
}