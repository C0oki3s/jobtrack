'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginUser, setToken, setRefreshToken, setUserEmail } from '@/lib/api';
import { LoginResponse } from '@/types/login';
import { OrganizationMembership } from '@/types/auth';
import { useAuth } from '@/components/auth-provider';

export default function LoginPage() {
  const [email, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [token, setTokenInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'credentials' | 'token'>('credentials');
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [showOrgSelection, setShowOrgSelection] = useState(false);
  const [currentLoginData, setCurrentLoginData] = useState<{ email: string; password: string } | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const response: LoginResponse = await loginUser(email.trim(), password.trim());
      
      if (response.multiTenant && response.memberships) {
        // User has multiple organization memberships - show selection
        setMemberships(response.memberships);
        setCurrentLoginData({ email: email.trim(), password: password.trim() });
        setShowOrgSelection(true);
      } else if (response.success && response.token && response.user) {
        // Single membership - proceed with login
        login(response.token, response.refreshToken!, response.user);
        router.replace('/organizations');
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrgSelection = async (membership: OrganizationMembership) => {
    if (!currentLoginData) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response: LoginResponse = await loginUser(
        currentLoginData.email, 
        currentLoginData.password, 
        membership.org.id
      );
      
      if (response.success && response.token && response.user) {
        login(response.token, response.refreshToken!, response.user);
        router.replace('/organizations');
      } else {
        setError('Failed to login with selected organization.');
      }
    } catch (error) {
      console.error('Org selection login error:', error);
      setError(error instanceof Error ? error.message : 'Failed to login with selected organization.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setIsLoading(true);
    try {
      setToken(token.trim());
      router.replace('/organizations');
    } catch (error) {
      console.error('Token login error:', error);
      setError('Invalid token. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowOrgSelection(false);
    setMemberships([]);
    setCurrentLoginData(null);
    setError(null);
  };

  if (showOrgSelection) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">Select Organization</h1>
            <p className="mt-2 text-muted-foreground">
              You have access to multiple organizations. Please select one to continue.
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {memberships.map((membership) => (
              <button
                key={membership.membershipId}
                onClick={() => handleOrgSelection(membership)}
                disabled={isLoading}
                className="w-full p-4 text-left bg-card border border-border rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-foreground">{membership.org.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Role: <span className="capitalize">{membership.role}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      User: {membership.user_name}
                    </p>
                  </div>
                  <div className="text-sm text-primary font-medium">
                    Select →
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleBackToLogin}
            disabled={isLoading}
            className="w-full bg-secondary text-secondary-foreground py-3 px-4 rounded-md hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">AWS Batch JobTracker</h1>
          <p className="mt-2 text-muted-foreground">
            {loginMode === 'credentials' ? 'Sign in with your credentials' : 'Enter your authentication token'}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-card border border-border rounded-md p-1">
          <button
            type="button"
            onClick={() => setLoginMode('credentials')}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              loginMode === 'credentials'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-accent hover:text-accent-foreground'
            }`}
          >
            Email & Password
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('token')}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              loginMode === 'token'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-accent hover:text-accent-foreground'
            }`}
          >
            JWT Token
          </button>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm font-medium">
            {error}
          </div>
        )}
        
        {loginMode === 'credentials' ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="Enter your email..."
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="Enter your password..."
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password.trim()}
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTokenSubmit} className="space-y-6">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-foreground mb-2">
                Authentication Token
              </label>
              <textarea
                id="token"
                required
                value={token}
                onChange={(e) => setTokenInput(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                placeholder="Enter your JWT token..."
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !token.trim()}
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? 'Signing in...' : 'Sign In with Token'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}