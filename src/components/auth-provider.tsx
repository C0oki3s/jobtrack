'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  getToken, 
  getRefreshToken, 
  setToken, 
  setRefreshToken, 
  setUserEmail,
  clearTokens, 
  clearUserEmail,
  getCurrentUser, 
  logoutUser,
  switchOrganization 
} from '@/lib/api';
import { User } from '@/types/auth';
import { SwitchOrgResponse } from '@/types/login';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => Promise<void>;
  switchOrg: (orgId?: string, membershipId?: string) => Promise<SwitchOrgResponse>;
  refreshUser: () => Promise<void>;
  canAccess: (routePrefix: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const login = (token: string, refreshToken: string, userData: User) => {
    setToken(token);
    setRefreshToken(refreshToken);
    setUserEmail(userData.email);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      if (user?.email) {
        await logoutUser(user.email);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearTokens();
      clearUserEmail();
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const switchOrg = async (orgId?: string, membershipId?: string): Promise<SwitchOrgResponse> => {
    const response = await switchOrganization(orgId, membershipId);
    
    if (response.success && response.token && response.user) {
      setToken(response.token);
      setRefreshToken(response.refreshToken);
      setUser(response.user);
    }
    
    return response;
  };

  const refreshUser = async () => {
    try {
      const response = await getCurrentUser();
      setUser(response.user);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      // Don't logout on user refresh failure, just log the error
    }
  };

  const canAccess = (routePrefix: string): boolean => {
    if (!user) return false;
    
    // Admin users have access to everything
    if (user.role.name === 'admin') return true;
    
    // Normalize route prefix
    const normalizedPrefix = routePrefix.startsWith('/') ? routePrefix : '/' + routePrefix;
    
    // If ABAC is active, use allow-only mode
    if (user.abac.active && user.abac.mode === 'allow-only') {
      return user.abac.allowedRoutes.some(allowedRoute => 
        normalizedPrefix === allowedRoute || 
        normalizedPrefix.startsWith(allowedRoute + '/')
      );
    }
    
    // Fallback to role-based permissions for specific routes
    if (normalizedPrefix.startsWith('/users') || normalizedPrefix.startsWith('/admin')) {
      return user.derived.effectiveManageUsers || false;
    }
    
    // Default allow for other routes when ABAC is not active
    return true;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = getToken();
      const refreshToken = getRefreshToken();
      
      if (token && refreshToken) {
        try {
          // Validate token by fetching user data
          const response = await getCurrentUser();
          setUser(response.user);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Failed to validate token:', error);
          // Clear invalid tokens
          clearTokens();
          clearUserEmail();
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading, 
      user, 
      login, 
      logout, 
      switchOrg, 
      refreshUser,
      canAccess 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}