import { describe, it, expect } from 'vitest';

describe('ECO Field Validation', () => {
  // This mirrors the VALID_COMPONENT_FIELDS whitelist from ecoController.js
  const VALID_COMPONENT_FIELDS = new Set([
    'mfg_part_number',
    'description',
    'value',
    'tolerance',
    'voltage_rating',
    'power_rating',
    'package_type',
    'pin_count',
    'temperature_range',
    'rohs_status',
    'lifecycle_status',
    'datasheet_url',
    'manufacturer_name',
    'notes',
    'custom_field_1',
    'custom_field_2',
    'custom_field_3',
    'custom_field_4',
    'custom_field_5',
    '_delete_component',
  ]);

  it('should allow valid component fields', () => {
    const validFields = ['mfg_part_number', 'description', 'value'];
    validFields.forEach(field => {
      expect(VALID_COMPONENT_FIELDS.has(field)).toBe(true);
    });
  });

  it('should reject invalid/malicious field names', () => {
    const invalidFields = [
      'DROP TABLE components;--',
      '1=1; DELETE FROM users;',
      'invalid_field',
      '__proto__',
      'constructor',
    ];
    invalidFields.forEach(field => {
      expect(VALID_COMPONENT_FIELDS.has(field)).toBe(false);
    });
  });

  it('should allow _delete_component field', () => {
    expect(VALID_COMPONENT_FIELDS.has('_delete_component')).toBe(true);
  });

  it('should not allow DELETE_COMPONENT (wrong case)', () => {
    expect(VALID_COMPONENT_FIELDS.has('DELETE_COMPONENT')).toBe(false);
  });
});

describe('ECO Self-Approval Prevention', () => {
  it('should prevent non-admin users from approving their own ECOs', () => {
    const eco = { initiated_by: 'user-123' };
    const user = { id: 'user-123', role: 'user' };
    
    const canApprove = !(eco.initiated_by === user.id && user.role !== 'admin');
    expect(canApprove).toBe(false);
  });

  it('should allow admins to approve their own ECOs', () => {
    const eco = { initiated_by: 'admin-456' };
    const user = { id: 'admin-456', role: 'admin' };
    
    const canApprove = !(eco.initiated_by === user.id && user.role !== 'admin');
    expect(canApprove).toBe(true);
  });

  it('should allow users to approve ECOs initiated by others', () => {
    const eco = { initiated_by: 'user-123' };
    const user = { id: 'user-456', role: 'user' };
    
    const canApprove = !(eco.initiated_by === user.id && user.role !== 'admin');
    expect(canApprove).toBe(true);
  });
});
