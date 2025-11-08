'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { OrganizationMembership } from '@/types/auth';
import { SwitchOrgResponse } from '@/types/login';

interface OrgSwitcherProps {
  className?: string;
}

export function OrgSwitcher({ className = '' }: OrgSwitcherProps) {
  const { user, switchOrg, refreshUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableMemberships, setAvailableMemberships] = useState<OrganizationMembership[]>([]);

  const handleSwitchOrg = async (membership?: OrganizationMembership) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let response: SwitchOrgResponse;
      
      if (membership) {
        // Switch to specific org
        response = await switchOrg(membership.org.id, membership.membershipId);
      } else {
        // Get list of available memberships
        response = await switchOrg();
        
        if (response.multiTenant && response.memberships) {
          setAvailableMemberships(response.memberships);
          setIsLoading(false);
          return; // Show membership selection
        }
      }
      
      if (response.success) {
        await refreshUser();
        setIsOpen(false);
        setAvailableMemberships([]);
      } else {
        setError('Failed to switch organization');
      }
    } catch (error) {
      console.error('Org switch error:', error);
      setError(error instanceof Error ? error.message : 'Failed to switch organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSwitcher = () => {
    setIsOpen(true);
    setError(null);
    handleSwitchOrg(); // Get available memberships
  };

  const handleClose = () => {
    setIsOpen(false);
    setAvailableMemberships([]);
    setError(null);
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={handleOpenSwitcher}
        disabled={isLoading}
        className={`flex items-center space-x-2 p-2 rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      >
        <div className="flex flex-col text-left">
          <span className="text-sm font-medium">{user.organization.name}</span>
          <span className="text-xs text-muted-foreground capitalize">{user.role.name}</span>
        </div>
        <svg 
          className="w-4 h-4 text-muted-foreground" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {availableMemberships.length > 0 ? 'Switch Organization' : 'Loading Organizations...'}
                </h3>
                <button
                  onClick={handleClose}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm font-medium mb-4">
                  {error}
                </div>
              )}

              {isLoading && availableMemberships.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : availableMemberships.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Select an organization to switch to:
                  </p>
                  {availableMemberships.map((membership) => {
                    const isCurrent = membership.org.id === user.organization.id;
                    return (
                      <button
                        key={membership.membershipId}
                        onClick={() => !isCurrent && handleSwitchOrg(membership)}
                        disabled={isLoading || isCurrent}
                        className={`w-full p-4 text-left rounded-md border transition-colors ${
                          isCurrent
                            ? 'bg-primary/10 border-primary text-primary cursor-default'
                            : 'bg-background border-border hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-accent'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{membership.org.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Role: <span className="capitalize">{membership.role}</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              User: {membership.user_name}
                            </p>
                          </div>
                          <div className="text-sm font-medium">
                            {isCurrent ? (
                              <span className="text-primary">Current</span>
                            ) : (
                              <span className="text-muted-foreground">Switch →</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No other organizations available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}