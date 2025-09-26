export interface JobTrackerData {
  success: boolean;
  organization: {
    id: string;
    name: string;
  };
  summary: {
    totalJobs: number;
    totalSessions: number;
    statusCounts: {
      pending: number;
      submitted: number;
      failed: number;
    };
    domainCounts: Record<string, number>;
    averageDuration: number | null;
  };
  sessions: JobSession[];
  jobs: Job[];
  synced: boolean;
}

export interface JobSession {
  sessionId: string;
  sessionName: string;
  status: 'active' | 'completed' | 'failed';
  domain: string;
  parentJobId: string;
  totalChildJobs: number;
  completedJobs: number;
  failedJobs: number;
  startedAt: string;
  completedAt?: string;
  duration: {
    minutes: number;
    seconds: number;
    total: number;
  } | null;
  results: {
    findingsBySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
    };
    totalFindings: number;
    subdomainsScanned: number;
  };
}

export interface Job {
  jobId: string;
  jobName: string;
  jobType: 'child' | 'parent';
  status: 'pending' | 'submitted' | 'failed' | 'completed' | 'succeeded';
  statusInfo: {
    emoji: string;
    color: string;
  };
  domain: string;
  jobQueue: string;
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  duration: {
    minutes: number;
    seconds: number;
    total: number;
  } | null;
  statusReason?: string;
  progress: {
    subdomainsProcessed: number;
    totalSubdomains: number;
    findingsFound: number;
  };
  parentJobId: string;
}

export interface SessionDetailData {
  success: boolean;
  session: {
    sessionId: string;
    sessionName: string;
    status: 'active' | 'completed' | 'failed';
    domain: string;
    parentJobId: string;
    organization: {
      id: string;
      name: string;
    };
    startedAt: string;
    duration: {
      minutes: number;
      seconds: number;
      total: number;
    } | null;
    configuration: {
      jobQueue: string;
      jobDefinition: string;
      chunkSize: number;
      maxParallelJobs: number;
      useOnDemand: boolean;
      fullScan: boolean;
    };
    results: {
      findingsBySeverity: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
      };
      totalFindings: number;
      subdomainsScanned: number;
    };
  };
  summary: {
    totalJobs: number;
    statusCounts: {
      succeeded: number;
      pending: number;
    };
    averageDuration: {
      minutes: number;
      seconds: number;
      total: number;
    };
    completionRate: number;
  };
  jobs: Job[];
  synced: boolean;
}

export interface JobDetailData {
  success: boolean;
  job: {
    jobId: string;
    jobName: string;
    jobType: 'child' | 'parent';
    status: 'pending' | 'submitted' | 'failed' | 'completed' | 'succeeded';
    statusInfo: {
      emoji: string;
      color: string;
    };
    domain: string;
    organization: {
      id: string;
      name: string;
    };
    jobQueue: string;
    jobDefinition: string;
    submittedAt: string;
    startedAt?: string;
    completedAt?: string;
    duration: {
      minutes: number;
      seconds: number;
      total: number;
    } | null;
    parameters: {
      domain: string;
      organizationId: string;
      totalJobs: number;
      jobIndex: number;
      subdomains: string[];
      fullScan: boolean;
    };
    statusReason?: string;
    attempts: Array<{
      startedAt: string;
      stoppedAt: string;
      _id: string;
    }>;
    progress: {
      subdomainsProcessed: number;
      totalSubdomains: number;
      findingsFound: number;
    };
    lastError: Record<string, unknown>;
    parentJobId: string;
    retryCount: number;
    maxRetries: number;
  };
  logs: unknown[];
  synced: boolean;
}

export interface OrganizationListData {
  success: boolean;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalOrganizations: number;
    organizationsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  summary: {
    totalOrganizations: number;
    organizationsShown: number;
    totalJobs: number;
    totalSessions: number;
    searchQuery: string | null;
  };
  organizations: Array<{
    organization: {
      id: string;
      name: string;
      domains: string[];
      createdAt: string;
    };
    jobStatistics: {
      totalJobs: number;
      statusCounts: {
        running?: number;
        succeeded?: number;
        failed?: number;
        runnable?: number;
        pending?: number;
        submitted?: number;
      };
      averageDuration: number | null;
    };
    sessionStatistics: {
      totalSessions: number;
      activeSessions: number;
      completedSessions: number;
    };
    recentJobs: Array<{
      jobId: string;
      jobName: string;
      status: string;
      statusInfo: {
        emoji: string;
        color: string;
      };
      domain: string;
      submittedAt: string;
      startedAt?: string;
      completedAt?: string;
      duration: {
        minutes: number;
        seconds: number;
        total: number;
      } | null;
    }>;
  }>;
  synced: boolean;
}