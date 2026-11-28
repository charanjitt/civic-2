import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLES,
  CIVIC_CATEGORY_DEFAULTS,
  COMPLAINT_PHOTOS_BUCKET,
  MAX_COMPLAINT_PHOTO_BYTES,
  MAX_COMPLAINT_PHOTOS,
  MUNICIPAL_ROLES,
  OFFICER_ROLES,
  photoExtensionForMimeType,
  validateComplaintPhotoFile,
} from '../types/civic';

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

  it('officer approval can never grant admin privileges', () => {
    expect(OFFICER_ROLES).toEqual(['field_officer', 'department_officer']);
    expect(OFFICER_ROLES).not.toContain('municipal_admin');
    expect(OFFICER_ROLES).not.toContain('super_admin');
    expect(OFFICER_ROLES).not.toContain('citizen');
  });

  it('validates complaint problem photo files strictly', () => {
    expect(COMPLAINT_PHOTOS_BUCKET).toBe('complaint-photos');
    expect(MAX_COMPLAINT_PHOTOS).toBe(3);

    expect(photoExtensionForMimeType('image/jpeg')).toBe('jpg');
    expect(photoExtensionForMimeType('image/png')).toBe('png');
    expect(photoExtensionForMimeType('image/webp')).toBe('webp');
    expect(photoExtensionForMimeType('image/svg+xml')).toBeNull();

    expect(
      validateComplaintPhotoFile({ name: 'pothole.jpg', size: 420_000, type: 'image/jpeg' })
    ).toBeNull();

    expect(
      validateComplaintPhotoFile({ name: 'empty.jpg', size: 0, type: 'image/jpeg' })
    ).toContain('empty');

    expect(
      validateComplaintPhotoFile({ name: 'script.svg', size: 1200, type: 'image/svg+xml' })
    ).toContain('JPG, PNG, or WebP');

    expect(
      validateComplaintPhotoFile({
        name: 'huge.png',
        size: MAX_COMPLAINT_PHOTO_BYTES + 1,
        type: 'image/png',
      })
    ).toContain('5 MB');
  });
});
