-- CivicConnect Row Level Security (RLS), Spatial Queries, and Realtime

-- Role helpers
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_municipal_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('field_officer', 'department_officer', 'municipal_admin', 'super_admin')
      AND is_verified_official = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('municipal_admin', 'super_admin')
      AND is_verified_official = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resolution_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrative_activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_municipal_staff());

CREATE POLICY "Users can update own non-role profile fields" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND is_verified_official = (SELECT p.is_verified_official FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Super admins can manage profiles" ON public.profiles
  FOR ALL USING (public.current_user_role() = 'super_admin');

-- Departments & Categories (publicly readable, admin-writable)
CREATE POLICY "Anyone can read departments" ON public.departments FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL USING (public.is_admin());

CREATE POLICY "Anyone can read categories" ON public.complaint_categories FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage categories" ON public.complaint_categories FOR ALL USING (public.is_admin());

-- Officer profiles
CREATE POLICY "Staff can read officer profiles" ON public.officer_profiles
  FOR SELECT USING (public.is_municipal_staff());
CREATE POLICY "Admins can manage officer profiles" ON public.officer_profiles
  FOR ALL USING (public.is_admin());

-- Complaints policies
CREATE POLICY "Citizens can view own complaints and public map markers" ON public.complaints
  FOR SELECT USING (
    auth.uid() = citizen_id
    OR public.is_municipal_staff()
    OR status IN ('submitted', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'verified')
  );

CREATE POLICY "Authenticated citizens can create complaints" ON public.complaints
  FOR INSERT WITH CHECK (auth.uid() = citizen_id);

CREATE POLICY "Municipal staff can update complaints" ON public.complaints
  FOR UPDATE USING (public.is_municipal_staff());

-- Assignments, Status History, Resolution Records
CREATE POLICY "Staff and complaint owner can view assignments" ON public.complaint_assignments
  FOR SELECT USING (
    public.is_municipal_staff()
    OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.citizen_id = auth.uid())
  );
CREATE POLICY "Officers and admins can manage assignments" ON public.complaint_assignments
  FOR ALL USING (
    public.current_user_role() IN ('department_officer', 'municipal_admin', 'super_admin')
  );

CREATE POLICY "Anyone involved can view status history" ON public.complaint_status_history
  FOR SELECT USING (
    public.is_municipal_staff()
    OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.citizen_id = auth.uid())
  );
CREATE POLICY "Staff can insert status history" ON public.complaint_status_history
  FOR INSERT WITH CHECK (public.is_municipal_staff());

CREATE POLICY "Anyone involved can view resolution records" ON public.resolution_records
  FOR SELECT USING (
    public.is_municipal_staff()
    OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.citizen_id = auth.uid())
  );
CREATE POLICY "Staff can manage resolution records" ON public.resolution_records
  FOR ALL USING (public.is_municipal_staff());

-- Notifications
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Staff can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (public.is_municipal_staff() OR auth.uid() = user_id);

-- Administrative Activity Logs (admins only)
CREATE POLICY "Admins can view activity logs" ON public.administrative_activity_logs
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Staff can append activity logs" ON public.administrative_activity_logs
  FOR INSERT WITH CHECK (public.is_municipal_staff());

-- PostGIS spatial query: find nearby complaints within radius_meters
CREATE OR REPLACE FUNCTION public.find_nearby_complaints(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 1500
)
RETURNS TABLE (
  id UUID,
  tracking_code TEXT,
  title TEXT,
  status complaint_status,
  priority complaint_priority,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.tracking_code,
    c.title,
    c.status,
    c.priority,
    c.latitude,
    c.longitude,
    ST_Distance(
      c.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) AS distance_meters
  FROM public.complaints c
  WHERE ST_DWithin(
    c.location,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  )
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enable Supabase Realtime on complaints and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
