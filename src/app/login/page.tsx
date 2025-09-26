'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setToken, loginUser } from '@/lib/api';
import { LoginResponse } from '@/types/login';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setTokenInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'credentials' | 'token'>('credentials');
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const response: LoginResponse = await loginUser(email.trim(), password.trim());
      
      if (response.success && response.token) {
        setToken(response.token);
        // Force redirect to organizations page after successful login
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

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setIsLoading(true);
    try {
      setToken(token.trim());
      // Force redirect to organizations page after token login
      router.replace('/organizations');
    } catch (error) {
      console.error('Token login error:', error);
      setError('Invalid token. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
                onChange={(e) => setEmail(e.target.value)}
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