import { describe, expect, it } from 'vitest';
import { ADMIN_ROLES, CIVIC_CATEGORY_DEFAULTS, MUNICIPAL_ROLES } from '../types/civic';

describe('CivicConnect domain constants', () => {
  it('defines all 7 required civic complaint categories', () => {
    const names = CIVIC_CATEGORY_DEFAULTS.map((c) => c.name);
    expect(names).toEqual([
      'Roads and potholes',
      'Waste and sanitation',
      'Water supply',
      'Drainage and sewage',
      'Street lighting',
      'Public infrastructure',
      'Other civic issues',
    ]);
  });

  it('separates municipal staff roles from citizen role', () => {
    expect(MUNICIPAL_ROLES).not.toContain('citizen');
    expect(ADMIN_ROLES).toEqual(['municipal_admin', 'super_admin']);
  });
});
