# Updated Authentication & Multi-Tenant System

This document describes the implementation of the new multi-tenant authentication system based on the provided specification.

## 🚀 What's New

### Multi-Tenant Authentication
- **Organization Selection**: Users with access to multiple organizations can choose which one to access during login
- **Organization Switching**: Switch between organizations without re-entering passwords using `/users/switch`
- **Token Refresh**: Automatic token refresh with rotation to maintain sessions
- **ABAC Support**: Allow-only route access control based on user permissions

### Enhanced Security
- **JWT Token Management**: Proper handling of access tokens (10h expiry) and refresh tokens (1d expiry)
- **Automatic Token Refresh**: Background refresh before expiry with fallback on 401 errors
- **Secure Token Storage**: Tokens stored in localStorage with automatic cleanup on auth failures

### Permission System
- **Role-Based Permissions**: Traditional role-based access control (RBAC)
- **Attribute-Based Access Control (ABAC)**: Fine-grained route-level permissions
- **Dynamic Route Guards**: Client-side route protection respecting both RBAC and ABAC rules

## 🔧 Implementation Details

### New API Endpoints Used

| Endpoint | Purpose | Method | Notes |
|----------|---------|--------|-------|
| `/users/login` | Multi-tenant login | POST | Replaces `/login` |
| `/users/switch` | Switch organization | POST | No password required |
| `/users/token/refresh` | Refresh tokens | POST | Rotates both tokens |
| `/users/logout` | Logout user | POST | Clears server-side tokens |
| `/me` | Get user info | GET | Includes permissions & ABAC |

### Components Created

#### 1. Enhanced Auth Provider (`auth-provider.tsx`)
```tsx
const { 
  isAuthenticated, 
  isLoading, 
  user, 
  login, 
  logout, 
  switchOrg, 
  refreshUser,
  canAccess 
} = useAuth();
```

Features:
- Complete user context with organization and permissions
- Organization switching functionality
- Route access validation
- Automatic token validation on app load

#### 2. Organization Switcher (`org-switcher.tsx`)
```tsx
<OrgSwitcher className="your-custom-classes" />
```

Features:
- Modal interface for organization selection
- Shows current organization and role
- No password required for switching
- Error handling for failed switches

#### 3. Route Guards (`route-guard.tsx`)
```tsx
<RouteGuard 
  requiredRoute="/admin" 
  showUnauthorized={true}
>
  <ProtectedContent />
</RouteGuard>
```

Features:
- Route-specific access control
- ABAC allow-only mode support
- Customizable unauthorized page
- Automatic redirection for unauthorized access

#### 4. Permission Hook (`usePermissions`)
```tsx
const {
  user,
  canAccess,
  checkPermission,
  isAdmin,
  canManageUsers,
  hasABAC,
  allowedRoutes
} = usePermissions();
```

### Updated Login Flow

#### Single Organization
1. User enters email/password
2. System returns token + user data
3. User is logged in and redirected

#### Multiple Organizations
1. User enters email/password
2. System returns list of organization memberships
3. User selects preferred organization
4. System issues org-specific token
5. User is logged in to selected organization

### Organization Switching
1. User clicks organization switcher
2. System fetches available memberships
3. User selects new organization
4. System issues new tokens for selected org
5. UI updates with new organization context

## 🛡️ Security Features

### Token Management
- **Access Token**: 10h expiry, stored in localStorage
- **Refresh Token**: 1d expiry, stored in localStorage
- **Automatic Refresh**: Runs before expiry and on 401 errors
- **Token Rotation**: Both tokens are rotated on refresh

### Route Protection
- **Public Routes**: `/login`, `/register`
- **Protected Routes**: All others require authentication
- **ABAC Routes**: Restricted based on user's `allowedRoutes` list
- **Admin Routes**: Require admin role or specific permissions

### Permission Validation
```typescript
// Example ABAC validation
const canAccess = (routePrefix: string): boolean => {
  if (!user) return false;
  if (user.role.name === 'admin') return true;
  
  if (user.abac.active && user.abac.mode === 'allow-only') {
    return user.abac.allowedRoutes.some(allowedRoute => 
      routePrefix === allowedRoute || 
      routePrefix.startsWith(allowedRoute + '/')
    );
  }
  
  return checkRolePermissions(routePrefix);
};
```

## 📱 Usage Examples

### Protecting a Page
```tsx
// pages/admin/page.tsx
export default function AdminPage() {
  return (
    <RouteGuard requiredRoute="/admin" showUnauthorized={true}>
      <AdminContent />
    </RouteGuard>
  );
}
```

### Conditional Navigation
```tsx
// components/navigation.tsx
const { canAccess } = usePermissions();

return (
  <nav>
    <Link href="/organizations">Organizations</Link>
    {canAccess('/jobtrack') && (
      <Link href="/jobtrack">Jobs</Link>
    )}
    {canAccess('/admin') && (
      <Link href="/admin">Admin</Link>
    )}
  </nav>
);
```

### Organization Context
```tsx
// components/header.tsx
const { user, switchOrg } = useAuth();

return (
  <header>
    <div>Current Org: {user?.organization.name}</div>
    <OrgSwitcher />
  </header>
);
```

## 🔄 Migration from Old System

### API Changes
- Replace `loginUser()` calls with new multi-tenant version
- Update token storage to include refresh tokens
- Use `/me` endpoint for user data instead of token decoding

### Component Updates
- Wrap protected pages with `<RouteGuard>`
- Replace manual auth checks with `usePermissions()` hook
- Add `<OrgSwitcher>` to navigation header

### Error Handling
- Handle organization selection flow in login
- Add error states for token refresh failures
- Implement proper logout on auth failures

## 🎯 Key Benefits

1. **Multi-Tenant Support**: Users can access multiple organizations seamlessly
2. **Enhanced Security**: Automatic token refresh and proper session management
3. **Fine-Grained Permissions**: ABAC support for precise access control
4. **Better UX**: Organization switching without re-authentication
5. **Future-Proof**: Extensible permission system for complex requirements

## 🚨 Important Notes

- **Breaking Changes**: This update requires users to log in again
- **Token Storage**: Tokens are stored in localStorage (consider httpOnly cookies for production)
- **ABAC Mode**: When active, `allowedRoutes` is the ONLY access control (role permissions are ignored)
- **Admin Override**: Admin users bypass all ABAC restrictions

## 🔧 Environment Variables

No additional environment variables required. The system uses the existing `BASE_URL` configuration.

## 📚 Type Definitions

All types are defined in:
- `src/types/auth.ts` - User, Organization, Role, ABAC types
- `src/types/login.ts` - Login request/response types

The system is fully TypeScript enabled with comprehensive type safety.