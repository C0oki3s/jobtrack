export interface ApiError {
  status: number;
  message: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  user: User | null;
}

export interface User {
  id: string;
  email: string;
  user_name: string;
  organization: Organization;
  role: Role;
  roleBasePermissions: RolePermissions;
  abac: ABACInfo;
  derived: DerivedPermissions;
}

export interface Organization {
  id: string;
  name: string;
}

export interface Role {
  name: string;
  permissions: RolePermissions;
}

export interface RolePermissions {
  readASM: boolean;
  readDarkweb: boolean;
  writeASM: boolean;
  writeDarkweb: boolean;
  manageUsers: boolean;
  [key: string]: boolean;
}

export interface ABACInfo {
  mode: 'allow-only' | 'deny' | null;
  active: boolean;
  allowedRoutes: string[];
}

export interface DerivedPermissions {
  effectiveManageUsers: boolean;
  manageUsersGrantedBy: 'role' | 'abac' | null;
  [key: string]: boolean | string | null;
}

export interface OrganizationMembership {
  membershipId: string;
  org: {
    id: string;
    name: string;
  };
  role: string;
  user_name: string;
}