import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  ActivityLog,
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  Department,
  NearbyComplaint,
  NotificationItem,
  OfficerProfile,
  Profile,
} from '../types/civic';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
    );
  }
  return supabase;
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
    return (data ?? []) as Complaint[];
  },

  async getComplaintByTrackingCode(trackingCode: string): Promise<Complaint | null> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('complaints')
      .select('*, category:complaint_categories(name, slug), department:departments(name, code)')
      .eq('tracking_code', trackingCode.trim().toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data as Complaint | null;
  },

  async createComplaint(input: CreateComplaintInput): Promise<Complaint> {
    const client = requireSupabase();
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
      note: 'Complaint submitted by citizen',
    });

    return data as Complaint;
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
