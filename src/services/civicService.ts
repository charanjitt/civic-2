import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  COMPLAINT_PHOTOS_BUCKET,
  MAX_COMPLAINT_PHOTOS,
  photoExtensionForMimeType,
  validateComplaintPhotoFile,
  type ActivityLog,
  type Complaint,
  type ComplaintCategory,
  type ComplaintPriority,
  type ComplaintStatus,
  type Department,
  type NearbyComplaint,
  type NotificationItem,
  type OfficerProfile,
  type Profile,
} from '../types/civic';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
    );
  }
  return supabase;
}

function randomShortId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  }
  return Math.random().toString(36).slice(2, 12);
}

/**
 * Resolves private Supabase Storage paths into temporary signed URLs (1 hour)
 * when the viewer is authenticated (the citizen who reported the issue OR
 * verified municipal officers/admins, enforced by storage.objects RLS).
 */
async function attachSignedPhotoUrls(complaints: Complaint[]): Promise<Complaint[]> {
  if (complaints.length === 0 || !isSupabaseConfigured || !supabase) {
    return complaints;
  }

  const rawPaths = new Set<string>();
  for (const c of complaints) {
    for (const p of c.photo_urls ?? []) {
      if (p && !/^https?:\/\//i.test(p)) {
        rawPaths.add(p);
      }
    }
  }

  if (rawPaths.size === 0) {
    return complaints.map((c) => ({
      ...c,
      signed_photo_urls: (c.photo_urls ?? []).filter(Boolean),
    }));
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return complaints.map((c) => ({
      ...c,
      signed_photo_urls: (c.photo_urls ?? []).filter((p) => /^https?:\/\//i.test(p)),
    }));
  }

  const signedByPath = new Map<string, string>();
  try {
    const { data } = await supabase.storage
      .from(COMPLAINT_PHOTOS_BUCKET)
      .createSignedUrls(Array.from(rawPaths), 60 * 60);

    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        signedByPath.set(item.path, item.signedUrl);
      }
    }
  } catch {
    // Non-fatal: if storage migration hasn't run yet, still return complaints cleanly.
  }

  return complaints.map((c) => ({
    ...c,
    signed_photo_urls: (c.photo_urls ?? [])
      .map((p) => (/^https?:\/\//i.test(p) ? p : signedByPath.get(p) ?? ''))
      .filter(Boolean),
  }));
}

export interface CreateComplaintInput {
  citizen_id: string;
  category_id: string;
  department_id?: string | null;
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  priority?: ComplaintPriority;
  photo_urls: string[];
}

export const civicService = {
  async listCategories(): Promise<ComplaintCategory[]> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('complaint_categories')
      .select('id, slug, name, description, default_department_id, sla_hours')
      .order('name');
    if (error) throw error;
    return data ?? [];
  },

  async listDepartments(): Promise<Department[]> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('departments')
      .select('*')
      .order('name');
    if (error) throw error;
    return data ?? [];
  },

  async createDepartment(input: { code: string; name: string; description?: string }): Promise<Department> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('departments')
      .insert({
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.description?.trim() || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listComplaints(filters?: { citizenId?: string; status?: ComplaintStatus; departmentId?: string }): Promise<Complaint[]> {
    const client = requireSupabase();
    let query = client
      .from('complaints')
      .select(
        '*, category:complaint_categories(name, slug), department:departments(name, code)'
      )
      .order('created_at', { ascending: false });

    if (filters?.citizenId) query = query.eq('citizen_id', filters.citizenId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);

    const { data, error } = await query;
    if (error) throw error;
    return attachSignedPhotoUrls((data ?? []) as Complaint[]);
  },

  async getComplaintByTrackingCode(trackingCode: string): Promise<Complaint | null> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('complaints')
      .select('*, category:complaint_categories(name, slug), department:departments(name, code)')
      .eq('tracking_code', trackingCode.trim().toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [resolved] = await attachSignedPhotoUrls([data as Complaint]);
    return resolved;
  },

  async uploadComplaintPhotos(userId: string, files: File[]): Promise<string[]> {
    const client = requireSupabase();
    if (!userId) {
      throw new Error('You must be signed in to upload problem photos.');
    }
    if (files.length < 1) {
      throw new Error('Please attach at least 1 photo of the problem.');
    }
    if (files.length > MAX_COMPLAINT_PHOTOS) {
      throw new Error(`You can attach up to ${MAX_COMPLAINT_PHOTOS} photos per complaint.`);
    }

    for (const file of files) {
      const validationError = validateComplaintPhotoFile(file);
      if (validationError) throw new Error(validationError);
    }

    const uploadedPaths: string[] = [];
    try {
      for (const file of files) {
        const ext = photoExtensionForMimeType(file.type);
        if (!ext) {
          throw new Error(`Unsupported image format for "${file.name}".`);
        }
        const storagePath = `${userId}/${Date.now()}-${randomShortId()}.${ext}`;
        const { error } = await client.storage
          .from(COMPLAINT_PHOTOS_BUCKET)
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (error) {
          if (/bucket not found/i.test(error.message)) {
            throw new Error(
              'Photo storage bucket is not set up yet. Run Migration 005 in the Supabase SQL Editor first.'
            );
          }
          throw error;
        }
        uploadedPaths.push(storagePath);
      }
      return uploadedPaths;
    } catch (err) {
      if (uploadedPaths.length > 0) {
        await client.storage.from(COMPLAINT_PHOTOS_BUCKET).remove(uploadedPaths).catch(() => {});
      }
      throw err;
    }
  },

  async removeComplaintPhotos(paths: string[]): Promise<void> {
    if (paths.length === 0 || !isSupabaseConfigured || !supabase) return;
    await supabase.storage.from(COMPLAINT_PHOTOS_BUCKET).remove(paths).catch(() => {});
  },

  async createComplaint(input: CreateComplaintInput): Promise<Complaint> {
    const client = requireSupabase();
    if (!input.photo_urls || input.photo_urls.length < 1) {
      throw new Error('At least 1 photo of the problem is required to submit a complaint.');
    }
    if (input.photo_urls.length > MAX_COMPLAINT_PHOTOS) {
      throw new Error(`A complaint can include at most ${MAX_COMPLAINT_PHOTOS} photos.`);
    }

    const { data, error } = await client
      .from('complaints')
      .insert({
        citizen_id: input.citizen_id,
        category_id: input.category_id,
        department_id: input.department_id ?? null,
        title: input.title.trim(),
        description: input.description.trim(),
        address: input.address.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        priority: input.priority ?? 'medium',
        photo_urls: input.photo_urls,
        tracking_code: '',
      })
      .select('*, category:complaint_categories(name, slug), department:departments(name, code)')
      .single();
    if (error) throw error;

    await client.from('complaint_status_history').insert({
      complaint_id: data.id,
      old_status: null,
      new_status: 'submitted',
      changed_by: input.citizen_id,
      note: 'Complaint submitted by citizen with photo evidence',
    });

    const [resolved] = await attachSignedPhotoUrls([data as Complaint]);
    return resolved;
  },

  async updateComplaintWorkflow(params: {
    complaintId: string;
    actorId: string;
    oldStatus: ComplaintStatus;
    newStatus: ComplaintStatus;
    priority?: ComplaintPriority;
    departmentId?: string | null;
    note?: string;
  }): Promise<Complaint> {
    const client = requireSupabase();
    const updates: Record<string, unknown> = {
      status: params.newStatus,
    };
    if (params.priority) updates.priority = params.priority;
    if (params.departmentId !== undefined) updates.department_id = params.departmentId;

    const { data, error } = await client
      .from('complaints')
      .update(updates)
      .eq('id', params.complaintId)
      .select('*, category:complaint_categories(name, slug), department:departments(name, code)')
      .single();
    if (error) throw error;

    await client.from('complaint_status_history').insert({
      complaint_id: params.complaintId,
      old_status: params.oldStatus,
      new_status: params.newStatus,
      changed_by: params.actorId,
      note: params.note ?? `Status updated to ${params.newStatus}`,
    });

    await client.from('notifications').insert({
      user_id: data.citizen_id,
      complaint_id: data.id,
      title: `Complaint ${data.tracking_code} Updated`,
      message: `Your complaint "${data.title}" is now ${params.newStatus.replace('_', ' ')}.`,
    });

    await client.from('administrative_activity_logs').insert({
      actor_id: params.actorId,
      action: 'UPDATE_COMPLAINT_WORKFLOW',
      entity_type: 'complaint',
      entity_id: data.id,
      details: {
        old_status: params.oldStatus,
        new_status: params.newStatus,
        priority: params.priority,
        department_id: params.departmentId,
      },
    });

    return data as Complaint;
  },

  async listOfficers(): Promise<OfficerProfile[]> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('officer_profiles')
      .select(
        '*, profile:profiles!officer_profiles_profile_id_fkey(full_name, email, role), department:departments(name, code)'
      )
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as OfficerProfile[];
  },

  // Citizen accounts that are candidates for officer promotion.
  // RLS limits what each caller can see; the approval itself is
  // re-checked inside the approve_officer database function.
  async listOfficerCandidates(): Promise<Profile[]> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('role', 'citizen')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as Profile[];
  },

  async approveOfficer(params: {
    profileId: string;
    role: 'field_officer' | 'department_officer';
    departmentId: string;
    badgeNumber: string;
    designation: string;
  }): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('approve_officer', {
      p_profile_id: params.profileId,
      p_role: params.role,
      p_department_id: params.departmentId,
      p_badge_number: params.badgeNumber,
      p_designation: params.designation,
    });
    if (error) throw error;
  },

  async suspendOfficer(officerId: string): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('suspend_officer', {
      p_officer_id: officerId,
    });
    if (error) throw error;
  },

  async assignOfficer(params: {
    complaintId: string;
    officerId: string;
    departmentId: string;
    assignedBy: string;
    notes?: string;
  }): Promise<void> {
    const client = requireSupabase();
    await client
      .from('complaint_assignments')
      .update({ is_current: false })
      .eq('complaint_id', params.complaintId);

    const { error } = await client.from('complaint_assignments').insert({
      complaint_id: params.complaintId,
      officer_id: params.officerId,
      department_id: params.departmentId,
      assigned_by: params.assignedBy,
      notes: params.notes ?? null,
      is_current: true,
    });
    if (error) throw error;

    await client.from('administrative_activity_logs').insert({
      actor_id: params.assignedBy,
      action: 'ASSIGN_FIELD_OFFICER',
      entity_type: 'complaint',
      entity_id: params.complaintId,
      details: { officer_id: params.officerId, department_id: params.departmentId },
    });
  },

  async listNotifications(userId: string): Promise<NotificationItem[]> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []) as NotificationItem[];
  },

  async markNotificationRead(id: string): Promise<void> {
    const client = requireSupabase();
    const { error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) throw error;
  },

  async listActivityLogs(): Promise<ActivityLog[]> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('administrative_activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as ActivityLog[];
  },

  async findNearbyComplaints(
    lat: number,
    lng: number,
    radiusMeters = 1500
  ): Promise<NearbyComplaint[]> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('find_nearby_complaints', {
      lat,
      lng,
      radius_meters: radiusMeters,
    });
    if (error) throw error;
    return (data ?? []) as NearbyComplaint[];
  },

  subscribeToComplaints(onChange: () => void) {
    if (!isSupabaseConfigured || !supabase) return () => {};
    const channel = supabase
      .channel('civicconnect-complaints-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        () => onChange()
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  },
};
