export const fullNavigationRoles = ['read-write', 'lab', 'approver', 'admin'];
export const fileLibraryAccessRoles = ['read-write', 'approver', 'admin'];
export const ecoAccessRoles = ['read-only', 'reviewer', 'lab', 'read-write', 'approver', 'admin'];
export const userSettingsRoles = ['reviewer', 'lab', 'read-write', 'approver', 'admin'];
export const limitedNavigationRoles = ['read-only', 'reviewer'];
export const fileLibraryDeleteRoles = ['approver', 'admin'];

export const canAccessFullNavigation = (role) => fullNavigationRoles.includes(role);
export const canAccessFileLibrary = (role) => fileLibraryAccessRoles.includes(role);
export const canAccessUserSettings = (role) => userSettingsRoles.includes(role);
export const isLimitedNavigationRole = (role) => limitedNavigationRoles.includes(role);
export const canDeleteLibraryFiles = (role) => fileLibraryDeleteRoles.includes(role);
export const canDirectEditLibraryComponents = (role, approvalStatus) => (
  role === 'admin' || (approvalStatus === 'new' && fullNavigationRoles.includes(role))
);

// §V15/§V59: which parts a write role may include in a bulk alternative-class
// change. With ECO off, direct editing is unrestricted for write roles (the
// button itself is already gated on canWrite). With ECO on, only parts that
// role could direct-edit qualify; the rest go through an ECO. The server
// enforces the same rule and rejects the whole batch if it disagrees.
export const canBulkSetAlternativeClass = (role, approvalStatus, ecoEnabled) => (
  !ecoEnabled || canDirectEditLibraryComponents(role, approvalStatus)
);

export const getDefaultRouteForRole = (role, ecoEnabled) => {
  if (isLimitedNavigationRole(role)) {
    return ecoEnabled ? '/eco' : '/library';
  }

  return '/';
};
