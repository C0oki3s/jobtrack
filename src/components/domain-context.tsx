'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const STORAGE_KEY = 'selected_domain';
const ORG_STORAGE_KEY = 'selected_org';

interface DomainContextType {
  selectedDomain: string | null;
  selectedOrg: string | null;
  setSelectedDomain: (domain: string | null) => void;
  setSelectedOrg: (org: string | null) => void;
}

const DomainContext = createContext<DomainContextType | undefined>(undefined);

interface DomainProviderProps {
  children: ReactNode;
}

export function DomainProvider({ children }: DomainProviderProps) {
  const [selectedDomain, setSelectedDomainState] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrgState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDomain = localStorage.getItem(STORAGE_KEY);
      const savedOrg = localStorage.getItem(ORG_STORAGE_KEY);
      if (savedDomain) setSelectedDomainState(savedDomain);
      if (savedOrg) setSelectedOrgState(savedOrg);
    }
  }, []);

  const setSelectedDomain = (domain: string | null) => {
    setSelectedDomainState(domain);
    if (typeof window !== 'undefined') {
      if (domain) {
        localStorage.setItem(STORAGE_KEY, domain);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  const setSelectedOrg = (org: string | null) => {
    setSelectedOrgState(org);
    if (typeof window !== 'undefined') {
      if (org) {
        localStorage.setItem(ORG_STORAGE_KEY, org);
      } else {
        localStorage.removeItem(ORG_STORAGE_KEY);
      }
    }
  };

  return (
    <DomainContext.Provider value={{
      selectedDomain,
      selectedOrg,
      setSelectedDomain,
      setSelectedOrg
    }}>
      {children}
    </DomainContext.Provider>
  );
}

export function useDomain() {
  const context = useContext(DomainContext);
  if (context === undefined) {
    throw new Error('useDomain must be used within a DomainProvider');
  }
  return context;
}

export { STORAGE_KEY, ORG_STORAGE_KEY };