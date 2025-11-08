'use client';

import { useAuth } from '@/components/auth-provider';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RouteGuardProps {
  children: ReactNode;
  requiredRoute?: string;
  requireAuth?: boolean;
  fallbackPath?: string;
  showUnauthorized?: boolean;
}

export function RouteGuard({ 
  children, 
  requiredRoute,
  requireAuth = true,
  fallbackPath = '/login',
  showUnauthorized = false
}: RouteGuardProps) {
  const { isAuthenticated, isLoading, canAccess, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (requireAuth && !isAuthenticated) {
      router.replace(fallbackPath);
      return;
    }

    if (requiredRoute && user && !canAccess(requiredRoute)) {
      if (showUnauthorized) {
        // Stay on page but show unauthorized message
        return;
      }
      // Redirect to a safe page (organizations list or home)
      router.replace('/organizations');
      return;
    }
  }, [isAuthenticated, isLoading, user, requiredRoute, canAccess, router, requireAuth, fallbackPath, showUnauthorized]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  if (requiredRoute && user && !canAccess(requiredRoute)) {
    if (showUnauthorized) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <svg 
                className="w-16 h-16 text-muted-foreground mx-auto mb-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
              <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
              <p className="text-muted-foreground">
                You don&apos;t have permission to access this page.
              </p>
            </div>
            
            {user?.abac.active && (
              <div className="bg-card border border-border rounded-lg p-4 mb-6">
                <h3 className="font-medium text-foreground mb-2">Your Access Information</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Organization:</strong> {user.organization.name}</p>
                  <p><strong>Role:</strong> <span className="capitalize">{user.role.name}</span></p>
                  {user.abac.active && (
                    <div>
                      <p><strong>Access Mode:</strong> Allow-only</p>
                      <p><strong>Allowed Routes:</strong></p>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        {user.abac.allowedRoutes.map((route, index) => (
                          <li key={index} className="text-xs">{route}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <button
              onClick={() => router.push('/organizations')}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background transition-colors"
            >
              Go to Organizations
            </button>
          </div>
        </div>
      );
    }
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}

// Hook for checking specific permissions
export function usePermissions() {
  const { user, canAccess } = useAuth();

  const checkPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // Check role-based permissions
    if (user.role.permissions[permission as keyof typeof user.role.permissions]) {
      return true;
    }
    
    // Check derived permissions
    if (user.derived[permission as keyof typeof user.derived]) {
      return true;
    }
    
    return false;
  };

  const checkRouteAccess = (route: string): boolean => {
    return canAccess(route);
  };

  return {
    user,
    canAccess: checkRouteAccess,
    checkPermission,
    isAdmin: user?.role.name === 'admin',
    canManageUsers: user?.derived.effectiveManageUsers || false,
    hasABAC: user?.abac.active || false,
    allowedRoutes: user?.abac.allowedRoutes || [],
  };
}