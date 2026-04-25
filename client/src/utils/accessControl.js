export const fullNavigationRoles = ['read-write', 'approver', 'admin'];
export const ecoAccessRoles = ['read-only', 'reviewer', 'read-write', 'approver', 'admin'];
export const userSettingsRoles = ['reviewer', 'read-write', 'approver', 'admin'];
export const limitedNavigationRoles = ['read-only', 'reviewer'];
export const fileLibraryDeleteRoles = ['approver', 'admin'];

export const canAccessFullNavigation = (role) => fullNavigationRoles.includes(role);
export const canAccessUserSettings = (role) => userSettingsRoles.includes(role);
export const isLimitedNavigationRole = (role) => limitedNavigationRoles.includes(role);
export const canDeleteLibraryFiles = (role) => fileLibraryDeleteRoles.includes(role);
export const canDirectEditLibraryComponents = (role) => role === 'admin';

export const getDefaultRouteForRole = (role, ecoEnabled) => {
  if (isLimitedNavigationRole(role)) {
    return ecoEnabled ? '/eco' : '/library';
  }

  return '/';
};