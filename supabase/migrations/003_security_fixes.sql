-- CivicConnect Migration 003 — Security fixes & citizen audit-trail policy
-- Date: 2026-11-28
--
-- Fix 1: find_nearby_complaints() was created with SECURITY DEFINER, which
--         bypassed Row Level Security and could expose "rejected" complaints
--         to anonymous/public callers. Recreated as a normal (invoker-rights)
--         function so the caller's RLS policies apply.
--
-- Fix 2: Citizens could not insert the initial status-history row for their
--         own complaint (policy 002 only allowed staff). The frontend insert
--         failed silently. Added a narrow policy: citizens may log ONLY the
--         first "submitted" entry for a complaint they own.

-- ---------------------------------------------------------------------------
-- Fix 1: Rebuild nearby-search without SECURITY DEFINER
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.find_nearby_complaints(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION
);

CREATE FUNCTION public.find_nearby_complaints(
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
$$ LANGUAGE plpgsql STABLE;
-- Note: NO "SECURITY DEFINER" — runs as the caller, so Row Level Security
-- on public.complaints decides which rows are visible.

GRANT EXECUTE ON FUNCTION public.find_nearby_complaints(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION
) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fix 2: Citizens may record the initial submission of their OWN complaint
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Citizens can log own initial submission" ON public.complaint_status_history
    FOR INSERT WITH CHECK (
      auth.uid() = changed_by
      AND old_status IS NULL
      AND new_status = 'submitted'
      AND EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_id
          AND c.citizen_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
