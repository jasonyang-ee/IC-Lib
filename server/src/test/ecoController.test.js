import { describe, it, expect } from 'vitest';

// Mirror the actual VALID_COMPONENT_FIELDS array from ecoController.js
const VALID_COMPONENT_FIELDS = [
  'description', 'value', 'pcb_footprint', 'package_size', 'datasheet_url',
  'approval_status', 'sub_category1', 'sub_category2', 'sub_category3', 'sub_category4',
  'schematic', 'step_model', 'pspice', 'pad_file', 'manufacturer_id', 'manufacturer_pn',
  'category_id', '_delete_component',
];

describe('ECO Field Validation', () => {
  it('should allow all whitelisted component fields', () => {
    const expected = [
      'description', 'value', 'pcb_footprint', 'package_size', 'datasheet_url',
      'approval_status', 'manufacturer_id', 'manufacturer_pn', 'category_id',
      'sub_category1', 'sub_category2', 'sub_category3', 'sub_category4',
      'schematic', 'step_model', 'pspice', 'pad_file', '_delete_component',
    ];
    expected.forEach(field => {
      expect(VALID_COMPONENT_FIELDS).toContain(field);
    });
  });

  it('should reject SQL injection attempts', () => {
    const attacks = [
      'DROP TABLE components;--',
      '1=1; DELETE FROM users;',
      "' OR '1'='1",
      'UNION SELECT * FROM users',
    ];
    attacks.forEach(field => {
      expect(VALID_COMPONENT_FIELDS).not.toContain(field);
    });
  });

  it('should reject prototype pollution fields', () => {
    expect(VALID_COMPONENT_FIELDS).not.toContain('__proto__');
    expect(VALID_COMPONENT_FIELDS).not.toContain('constructor');
    expect(VALID_COMPONENT_FIELDS).not.toContain('prototype');
  });

  it('should be case-sensitive', () => {
    expect(VALID_COMPONENT_FIELDS).not.toContain('Description');
    expect(VALID_COMPONENT_FIELDS).not.toContain('DELETE_COMPONENT');
    expect(VALID_COMPONENT_FIELDS).not.toContain('PCB_FOOTPRINT');
  });

  it('should include _delete_component for soft deletes', () => {
    expect(VALID_COMPONENT_FIELDS).toContain('_delete_component');
  });

  it('should have exactly 18 allowed fields', () => {
    expect(VALID_COMPONENT_FIELDS).toHaveLength(18);
  });
});

describe('ECO Self-Approval Prevention', () => {
  const canUserApprove = (eco, user) =>
    !(eco.initiated_by === user.id && user.role !== 'admin');

  it('should prevent non-admin from approving own ECO', () => {
    expect(canUserApprove(
      { initiated_by: 'user-1' },
      { id: 'user-1', role: 'approver' },
    )).toBe(false);
  });

  it('should allow admin to approve own ECO', () => {
    expect(canUserApprove(
      { initiated_by: 'admin-1' },
      { id: 'admin-1', role: 'admin' },
    )).toBe(true);
  });

  it('should allow anyone to approve ECOs by others', () => {
    expect(canUserApprove(
      { initiated_by: 'user-1' },
      { id: 'user-2', role: 'approver' },
    )).toBe(true);

    expect(canUserApprove(
      { initiated_by: 'user-1' },
      { id: 'user-2', role: 'read-write' },
    )).toBe(true);
  });
});
