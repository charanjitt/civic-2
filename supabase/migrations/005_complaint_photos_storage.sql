-- CivicConnect Migration 005 — Mandatory Problem Photos & Municipal Inspection Access
-- Date: 2026-11-28
--
-- What this migration sets up:
--   1. Private Supabase Storage bucket `complaint-photos` (max 5 MB per image,
--      JPEG / PNG / WebP only — blocks scripts/executables at the server).
--   2. Storage Row Level Security (RLS) on `storage.objects`:
--        * Logged-in citizens can upload photos ONLY inside their own `<user_id>/` folder.
--        * ONLY the citizen who uploaded the photo AND verified municipal staff
--          (`field_officer`, `department_officer`, `municipal_admin`, `super_admin`
--          via `public.is_municipal_staff()`) can read/view the photo.
--        * Citizens (for failed-submit rollback) and admins can delete photos.
--   3. Database-level enforcement on `public.complaints`:
--        * Every new complaint MUST include 1 to 3 valid photo paths in `photo_urls`
--          belonging to the submitting citizen's folder (cannot be bypassed via API).

-- ---------------------------------------------------------------------------
-- 1. Create / update private storage bucket for complaint evidence photos
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'complaint-photos',
  'complaint-photos',
  FALSE,
  5242880, -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Storage object policies (Citizen upload + Citizen & Municipal Staff view)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Citizens can upload own complaint photos" ON storage.objects;
CREATE POLICY "Citizens can upload own complaint photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'complaint-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Owner and municipal staff can view complaint photos" ON storage.objects;
CREATE POLICY "Owner and municipal staff can view complaint photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'complaint-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_municipal_staff()
    )
  );

DROP POLICY IF EXISTS "Citizens and admins can delete complaint photos" ON storage.objects;
CREATE POLICY "Citizens and admins can delete complaint photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'complaint-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Database-level mandatory photo validation on public.complaints
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.are_valid_citizen_photo_paths(
  p_urls TEXT[],
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_path TEXT;
  v_prefix TEXT := p_user_id::text || '/';
BEGIN
  IF p_urls IS NULL OR p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF cardinality(p_urls) < 1 OR cardinality(p_urls) > 3 THEN
    RETURN FALSE;
  END IF;

  FOREACH v_path IN ARRAY p_urls LOOP
    IF v_path IS NULL
       OR length(trim(v_path)) = 0
       OR position('..' in v_path) > 0
       OR left(v_path, length(v_prefix)) <> v_prefix
       OR v_path !~* '\.(jpe?g|png|webp)$'
    THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.are_valid_citizen_photo_paths(TEXT[], UUID)
  TO authenticated, service_role;

ALTER TABLE public.complaints
  DROP CONSTRAINT IF EXISTS chk_complaints_photo_required;

ALTER TABLE public.complaints
  ADD CONSTRAINT chk_complaints_photo_required
  CHECK (
    cardinality(photo_urls) BETWEEN 1 AND 3
    AND array_position(photo_urls, '') IS NULL
    AND array_position(photo_urls, NULL) IS NULL
  ) NOT VALID;

DROP POLICY IF EXISTS "Authenticated citizens can create complaints" ON public.complaints;
CREATE POLICY "Authenticated citizens can create complaints"
  ON public.complaints
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = citizen_id
    AND public.are_valid_citizen_photo_paths(photo_urls, auth.uid())
  );
