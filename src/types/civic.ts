export type UserRole =
  | 'citizen'
  | 'field_officer'
  | 'department_officer'
  | 'municipal_admin'
  | 'super_admin';

export type ComplaintStatus =
  | 'submitted'
  | 'acknowledged'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'verified'
  | 'rejected';

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_verified_official: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  head_officer_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ComplaintCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  default_department_id: string | null;
  sla_hours: number;
}

export interface OfficerProfile {
  id: string;
  profile_id: string;
  department_id: string;
  badge_number: string;
  designation: string;
  is_active: boolean;
  approved_by: string | null;
  approved_at: string | null;
  profile?: Pick<Profile, 'full_name' | 'email' | 'role'>;
  department?: Pick<Department, 'name' | 'code'>;
}

export interface Complaint {
  id: string;
  tracking_code: string;
  citizen_id: string;
  category_id: string;
  department_id: string | null;
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  photo_urls: string[];
  signed_photo_urls?: string[];
  created_at: string;
  updated_at: string;
  category?: Pick<ComplaintCategory, 'name' | 'slug'>;
  department?: Pick<Department, 'name' | 'code'>;
}

export interface NearbyComplaint {
  id: string;
  tracking_code: string;
  title: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  latitude: number;
  longitude: number;
  distance_meters: number;
}

export interface ComplaintStatusHistory {
  id: string;
  complaint_id: string;
  old_status: ComplaintStatus | null;
  new_status: ComplaintStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  complaint_id: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export const MUNICIPAL_ROLES: UserRole[] = [
  'field_officer',
  'department_officer',
  'municipal_admin',
  'super_admin',
];

export const ADMIN_ROLES: UserRole[] = ['municipal_admin', 'super_admin'];

// Roles that may be granted through the officer approval flow.
// Admin roles are deliberately excluded (no privilege escalation).
export const OFFICER_ROLES: UserRole[] = ['field_officer', 'department_officer'];

export const CIVIC_CATEGORY_DEFAULTS: Array<{
  slug: string;
  name: string;
  deptCode: string;
}> = [
  { slug: 'roads-potholes', name: 'Roads and potholes', deptCode: 'ROADS' },
  { slug: 'waste-sanitation', name: 'Waste and sanitation', deptCode: 'SANITATION' },
  { slug: 'water-supply', name: 'Water supply', deptCode: 'WATER' },
  { slug: 'drainage-sewage', name: 'Drainage and sewage', deptCode: 'DRAINAGE' },
  { slug: 'street-lighting', name: 'Street lighting', deptCode: 'LIGHTING' },
  { slug: 'public-infrastructure', name: 'Public infrastructure', deptCode: 'INFRA' },
  { slug: 'other-civic-issues', name: 'Other civic issues', deptCode: 'INFRA' },
];

export const COMPLAINT_PHOTOS_BUCKET = 'complaint-photos';
export const MAX_COMPLAINT_PHOTOS = 3;
export const MAX_COMPLAINT_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_COMPLAINT_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export function photoExtensionForMimeType(mimeType: string): 'jpg' | 'png' | 'webp' | null {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

export function validateComplaintPhotoFile(
  file: Pick<File, 'name' | 'size' | 'type'>
): string | null {
  if (!file || file.size <= 0) {
    return `Photo "${file?.name ?? 'selected file'}" is empty.`;
  }
  if (!photoExtensionForMimeType(file.type)) {
    return `Photo "${file.name}" must be a JPG, PNG, or WebP image.`;
  }
  if (file.size > MAX_COMPLAINT_PHOTO_BYTES) {
    return `Photo "${file.name}" exceeds the 5 MB limit.`;
  }
  return null;
}

