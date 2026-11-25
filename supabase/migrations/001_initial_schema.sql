-- CivicConnect Initial Database Schema
-- PostgreSQL + PostGIS on Supabase

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Custom types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'citizen',
    'field_officer',
    'department_officer',
    'municipal_admin',
    'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE complaint_status AS ENUM (
    'submitted',
    'acknowledged',
    'assigned',
    'in_progress',
    'resolved',
    'verified',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE complaint_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'citizen',
  is_verified_official BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  head_officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Complaint Categories
CREATE TABLE IF NOT EXISTS public.complaint_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  default_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  sla_hours INTEGER NOT NULL DEFAULT 72,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Officer Profiles (authorized municipal staff)
CREATE TABLE IF NOT EXISTS public.officer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  badge_number TEXT NOT NULL UNIQUE,
  designation TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Complaints (with PostGIS Geography point)
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code TEXT NOT NULL UNIQUE,
  citizen_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.complaint_categories(id) ON DELETE RESTRICT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  priority complaint_priority NOT NULL DEFAULT 'medium',
  status complaint_status NOT NULL DEFAULT 'submitted',
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_location_gist ON public.complaints USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_complaints_citizen_id ON public.complaints (citizen_id);
CREATE INDEX IF NOT EXISTS idx_complaints_department_id ON public.complaints (department_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints (status);

-- 6. Complaint Assignments
CREATE TABLE IF NOT EXISTS public.complaint_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  officer_id UUID NOT NULL REFERENCES public.officer_profiles(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes TEXT,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Complaint Status History
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  old_status complaint_status,
  new_status complaint_status NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Resolution Records
CREATE TABLE IF NOT EXISTS public.resolution_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL UNIQUE REFERENCES public.complaints(id) ON DELETE CASCADE,
  resolved_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT NOT NULL,
  evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- 9. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Administrative Activity Logs
CREATE TABLE IF NOT EXISTS public.administrative_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-populate PostGIS geography point & tracking_code
CREATE OR REPLACE FUNCTION public.sync_complaint_geopoint()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  IF NEW.tracking_code IS NULL OR NEW.tracking_code = '' THEN
    NEW.tracking_code := 'CC-' || TO_CHAR(NOW(), 'YYYY') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_complaint_geopoint ON public.complaints;
CREATE TRIGGER trg_sync_complaint_geopoint
  BEFORE INSERT OR UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.sync_complaint_geopoint();

-- Trigger: create citizen profile on auth.users signup (never allows self-escalating role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_verified_official)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'citizen',
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed core departments
INSERT INTO public.departments (code, name, description) VALUES
  ('ROADS', 'Roads & Public Works', 'Road surfacing, potholes, sidewalks, and bridges'),
  ('SANITATION', 'Waste & Sanitation', 'Solid waste collection, street sweeping, and civic hygiene'),
  ('WATER', 'Water Supply', 'Potable water pipelines, leaks, and pressure management'),
  ('DRAINAGE', 'Drainage & Sewage', 'Stormwater drains, sewer lines, and flood prevention'),
  ('LIGHTING', 'Street Lighting', 'Smart LED streetlights, poles, and electrical maintenance'),
  ('INFRA', 'Public Infrastructure', 'Parks, public buildings, signage, and civic amenities')
ON CONFLICT (code) DO NOTHING;

-- Seed 7 required complaint categories
INSERT INTO public.complaint_categories (slug, name, description, default_department_id, sla_hours)
SELECT v.slug, v.name, v.description, d.id, v.sla_hours
FROM (VALUES
  ('roads-potholes', 'Roads and potholes', 'Damaged roads, potholes, and cracked pavements', 'ROADS', 48),
  ('waste-sanitation', 'Waste and sanitation', 'Overflowing bins, uncollected garbage, and sanitation', 'SANITATION', 24),
  ('water-supply', 'Water supply', 'Pipe bursts, water leakage, and supply interruptions', 'WATER', 24),
  ('drainage-sewage', 'Drainage and sewage', 'Blocked drains, waterlogging, and sewage overflow', 'DRAINAGE', 24),
  ('street-lighting', 'Street lighting', 'Broken streetlights, dark zones, and flickering poles', 'LIGHTING', 36),
  ('public-infrastructure', 'Public infrastructure', 'Damaged parks, benches, bus shelters, and signage', 'INFRA', 72),
  ('other-civic-issues', 'Other civic issues', 'General municipal issues requiring review', 'INFRA', 72)
) AS v(slug, name, description, dept_code, sla_hours)
LEFT JOIN public.departments d ON d.code = v.dept_code
ON CONFLICT (slug) DO NOTHING;
