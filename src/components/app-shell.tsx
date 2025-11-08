'use client';

import { useAuth } from './auth-provider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OrgSwitcher } from './org-switcher';
import { usePermissions } from './route-guard';

const PUBLIC_ROUTES = ['/login', '/register'];
const PROTECTED_ROUTES = ['/jobtrack', '/organizations', '/admin'];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { canAccess } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

    if (!isAuthenticated && isProtectedRoute) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    } else if (isAuthenticated && pathname === '/login') {
      router.replace('/organizations');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout API fails
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

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

  // Show navigation header for authenticated users on protected pages
  const showHeader = isAuthenticated && user && !PUBLIC_ROUTES.includes(pathname);

  return (
    <div className="min-h-screen bg-background">
      {showHeader && (
        <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo/Title */}
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold text-foreground">JobTracker</h1>
              </div>

              {/* Navigation Links */}
              <nav className="hidden md:flex items-center space-x-6">
                <a 
                  href="/organizations"
                  className={`text-sm font-medium transition-colors hover:text-accent-foreground ${
                    pathname === '/organizations' ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Organizations
                </a>
                {canAccess('/jobtrack') && (
                  <a 
                    href="/jobtrack"
                    className={`text-sm font-medium transition-colors hover:text-accent-foreground ${
                      pathname === '/jobtrack' ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Jobs
                  </a>
                )}
                {canAccess('/admin') && (
                  <a 
                    href="/admin"
                    className={`text-sm font-medium transition-colors hover:text-accent-foreground ${
                      pathname === '/admin' ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Admin
                  </a>
                )}
              </nav>

              {/* User Controls */}
              <div className="flex items-center space-x-4">
                {/* Organization Switcher */}
                <OrgSwitcher />
                
                {/* User Menu */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    {user.user_name || user.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Logout"
                  >
                    {isLoggingOut ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}
      
      <main className={showHeader ? 'min-h-[calc(100vh-4rem)]' : 'min-h-screen'}>
        {children}
      </main>
    </div>
  );
}