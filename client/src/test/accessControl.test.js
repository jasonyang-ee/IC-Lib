import { describe, expect, it } from 'vitest';
import {
  canAccessFullNavigation,
  canAccessUserSettings,
  canDeleteLibraryFiles,
  getDefaultRouteForRole,
} from '../utils/accessControl';

describe('accessControl', () => {
  it('limits read-only users to library and eco routes', () => {
    expect(canAccessFullNavigation('read-only')).toBe(false);
    expect(canAccessUserSettings('read-only')).toBe(false);
    expect(getDefaultRouteForRole('read-only', true)).toBe('/eco');
    expect(getDefaultRouteForRole('read-only', false)).toBe('/library');
  });

  it('keeps reviewer default route aligned with limited navigation behavior', () => {
    expect(canAccessUserSettings('reviewer')).toBe(true);
    expect(getDefaultRouteForRole('reviewer', true)).toBe('/eco');
    expect(getDefaultRouteForRole('reviewer', false)).toBe('/library');
  });

  it('only allows approver and admin to delete file-library files', () => {
    expect(canDeleteLibraryFiles('read-write')).toBe(false);
    expect(canDeleteLibraryFiles('approver')).toBe(true);
    expect(canDeleteLibraryFiles('admin')).toBe(true);
  });
});