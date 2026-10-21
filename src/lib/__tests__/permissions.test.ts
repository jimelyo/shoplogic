import { describe, expect, it } from 'vitest';
import { ADMIN_ONLY, canAccess, canDo, firstAccessible, isReadOnly } from '../permissions';
import { DEFAULT_ACTION_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../../types';
import type { SessionUser } from '../../store/store';

const user = (role: SessionUser['role'], permissions?: SessionUser['permissions'], actions?: SessionUser['actions']): SessionUser => ({
  id: 1, name: 'Test', email: 't@t.t', role,
  permissions: permissions ?? DEFAULT_ROLE_PERMISSIONS[role],
  actions: actions ?? [...DEFAULT_ACTION_PERMISSIONS[role]],
});

describe('canAccess', () => {
  it('denies everything without a session', () => {
    expect(canAccess(null, 'dashboard')).toBe(false);
    expect(canAccess(null, 'settings')).toBe(false);
  });

  it('locks admin-only modules to the admin role', () => {
    expect(ADMIN_ONLY).toEqual(['users', 'settings']);
    expect(canAccess(user('admin'), 'users')).toBe(true);
    expect(canAccess(user('admin'), 'settings')).toBe(true);
    expect(canAccess(user('manager'), 'users')).toBe(false);
    expect(canAccess(user('cashier'), 'settings')).toBe(false);
  });

  it('respects the permissions granted to the role', () => {
    expect(canAccess(user('cashier'), 'pos')).toBe(true);
    expect(canAccess(user('cashier'), 'inventory')).toBe(false);
    expect(canAccess(user('technician'), 'repairs')).toBe(true);
    expect(canAccess(user('technician'), 'purchases')).toBe(false);
  });

  it('honours a custom permission list over the role defaults', () => {
    const custom = user('cashier', ['dashboard', 'billing']);
    expect(canAccess(custom, 'billing')).toBe(true);
    expect(canAccess(custom, 'pos')).toBe(false);
  });
});

describe('isReadOnly', () => {
  it('treats an anonymous user as read-only', () => {
    expect(isReadOnly(null, 'inventory')).toBe(true);
  });

  it('marks inventory read-only for technicians only', () => {
    expect(isReadOnly(user('technician'), 'inventory')).toBe(true);
    expect(isReadOnly(user('manager'), 'inventory')).toBe(false);
    expect(isReadOnly(user('admin'), 'inventory')).toBe(false);
  });
});

describe('firstAccessible', () => {
  it('returns the first allowed module in navigation order', () => {
    expect(firstAccessible(user('admin'))).toBe('dashboard');
    expect(firstAccessible(user('cashier'))).toBe('dashboard');
    expect(firstAccessible(user('cashier', ['billing']))).toBe('billing');
  });

  it('returns null when nothing is reachable', () => {
    expect(firstAccessible(user('cashier', []))).toBe(null);
    expect(firstAccessible(null)).toBe(null);
  });
});

describe('canDo', () => {
  it('always allows admin and follows role defaults for legacy sessions', () => {
    expect(canDo(user('admin', [], []), 'pos.discount')).toBe(true);
    expect(canDo(user('cashier'), 'pos.discount')).toBe(true);
    expect(canDo(user('cashier'), 'data.export')).toBe(false);
    expect(canDo(user('manager'), 'data.export')).toBe(true);
    expect(canDo(user('technician'), 'pos.refund')).toBe(false);
  });

  it('honours explicit grants and denials', () => {
    expect(canDo(user('cashier', undefined, ['pos.refund']), 'pos.refund')).toBe(true);
    expect(canDo(user('cashier', undefined, ['pos.refund']), 'pos.discount')).toBe(false);
    expect(canDo(null, 'pos.discount')).toBe(false);
  });
});
