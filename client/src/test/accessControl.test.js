import { describe, expect, it } from 'vitest';
import {
  canAccessFullNavigation,
  canAccessFileLibrary,
  canAccessUserSettings,
  canDirectEditLibraryComponents,
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

  it('treats lab as a write-capable full-nav role without File Library page access', () => {
    expect(canAccessFullNavigation('lab')).toBe(true);
    expect(canAccessFileLibrary('lab')).toBe(false);
    expect(canAccessUserSettings('lab')).toBe(true);
    expect(getDefaultRouteForRole('lab', true)).toBe('/');
  });

  it('only allows approver and admin to delete file-library files', () => {
    expect(canDeleteLibraryFiles('read-write')).toBe(false);
    expect(canDeleteLibraryFiles('approver')).toBe(true);
    expect(canDeleteLibraryFiles('admin')).toBe(true);
  });

  it('only allows admin to bypass ECO for direct library edits', () => {
    expect(canDirectEditLibraryComponents('read-write', 'prototype')).toBe(false);
    expect(canDirectEditLibraryComponents('lab', 'new')).toBe(true);
    expect(canDirectEditLibraryComponents('approver', 'new')).toBe(true);
    expect(canDirectEditLibraryComponents('admin', 'production')).toBe(true);
    expect(canDirectEditLibraryComponents(undefined, 'new')).toBe(false);
  });
});
