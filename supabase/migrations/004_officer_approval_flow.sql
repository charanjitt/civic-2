-- CivicConnect Migration 004 — Officer approval flow
-- Date: 2026-11-28
--
-- Adds two database functions that enforce the municipal officer
-- approval workflow INSIDE the database (never trust the frontend alone):
--
--   approve_officer(...)  — verified municipal admins promote a citizen
--                           account to field_officer / department_officer,
--                           create (or refresh) the officer record, and
--                           append an activity log entry. Atomic (all-or-nothing).
--   suspend_officer(...)  — verified municipal admins revoke officer access
--                           (is_active = false, is_verified_official = false)
--                           and append an activity log entry.
--
-- Security model:
--   * Both functions check public.is_admin() internally (SECURITY DEFINER
--     is safe here BECAUSE the authorization check lives inside the function).
--   * approve_officer only accepts 'field_officer' or 'department_officer'
--     as the new role — admins can never create other admins through it.
--   * EXECUTE is revoked from PUBLIC and anon; granted to authenticated.

-- ---------------------------------------------------------------------------
-- approve_officer: promote a citizen to an authorized municipal officer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_officer(
  p_profile_id UUID,
  p_role user_role,
  p_department_id UUID,
  p_badge_number TEXT,
  p_designation TEXT
) RETURNS public.officer_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role user_role;
  v_target_verified BOOLEAN;
  v_officer public.officer_profiles%ROWTYPE;
  v_actor UUID := auth.uid();
BEGIN
  -- 1. Authorization: only verified municipal admins may approve officers.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only municipal administrators can approve officers';
  END IF;

  -- 2. The new role must be an officer role — never admin/super_admin.
  IF p_role NOT IN ('field_officer', 'department_officer') THEN
    RAISE EXCEPTION 'Invalid officer role: officers can only be field_officer or department_officer';
  END IF;

  -- 3. Basic input validation.
  IF p_badge_number IS NULL OR length(trim(p_badge_number)) = 0 THEN
    RAISE EXCEPTION 'Badge number is required';
  END IF;
  IF p_designation IS NULL OR length(trim(p_designation)) = 0 THEN
    RAISE EXCEPTION 'Designation is required';
  END IF;

  -- 4. The target account must exist and be eligible for promotion.
  SELECT role, is_verified_official
    INTO v_target_role, v_target_verified
  FROM public.profiles
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Citizen profile not found';
  END IF;

  IF v_target_verified AND v_target_role IN ('field_officer', 'department_officer') THEN
    RAISE EXCEPTION 'This account is already an active officer';
  END IF;

  IF v_target_role NOT IN ('citizen', 'field_officer', 'department_officer') THEN
    RAISE EXCEPTION 'Only citizen accounts can be approved as officers';
  END IF;

  -- 5. Department must exist and be active.
  IF NOT EXISTS (
    SELECT 1 FROM public.departments
    WHERE id = p_department_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive department';
  END IF;

  -- 6. Badge numbers must be unique across officers.
  IF EXISTS (
    SELECT 1 FROM public.officer_profiles
    WHERE badge_number = trim(p_badge_number) AND profile_id <> p_profile_id
  ) THEN
    RAISE EXCEPTION 'Badge number already in use';
  END IF;

  -- 7. Promote the account (role + verified flag together).
  UPDATE public.profiles
  SET role = p_role,
      is_verified_official = TRUE,
      updated_at = NOW()
  WHERE id = p_profile_id;

  -- 8. Create the officer record, or refresh it on re-approval.
  INSERT INTO public.officer_profiles
    (profile_id, department_id, badge_number, designation, is_active, approved_by, approved_at)
  VALUES
    (p_profile_id, p_department_id, trim(p_badge_number), trim(p_designation), TRUE, v_actor, NOW())
  ON CONFLICT (profile_id) DO UPDATE
    SET department_id = EXCLUDED.department_id,
        badge_number  = EXCLUDED.badge_number,
        designation   = EXCLUDED.designation,
        is_active     = TRUE,
        approved_by   = EXCLUDED.approved_by,
        approved_at   = NOW();

  SELECT * INTO v_officer
  FROM public.officer_profiles
  WHERE profile_id = p_profile_id;

  -- 9. Audit trail.
  INSERT INTO public.administrative_activity_logs
    (actor_id, action, entity_type, entity_id, details)
  VALUES
    (v_actor, 'APPROVE_OFFICER', 'officer_profile', v_officer.id,
     jsonb_build_object(
       'profile_id', p_profile_id,
       'role', p_role,
       'department_id', p_department_id,
       'badge_number', trim(p_badge_number),
       'designation', trim(p_designation)
     ));

  RETURN v_officer;
END;
$$;

-- ---------------------------------------------------------------------------
-- suspend_officer: revoke an officer's municipal access
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suspend_officer(p_officer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_officer public.officer_profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only municipal administrators can revoke officer access';
  END IF;

  SELECT * INTO v_officer
  FROM public.officer_profiles
  WHERE id = p_officer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Officer profile not found';
  END IF;

  IF NOT v_officer.is_active THEN
    RAISE EXCEPTION 'Officer is already inactive';
  END IF;

  UPDATE public.officer_profiles
  SET is_active = FALSE
  WHERE id = p_officer_id;

  -- Revoking verification blocks portal access AND all staff RLS policies,
  -- while keeping the historical role label for audit purposes.
  UPDATE public.profiles
  SET is_verified_official = FALSE,
      updated_at = NOW()
  WHERE id = v_officer.profile_id;

  INSERT INTO public.administrative_activity_logs
    (actor_id, action, entity_type, entity_id, details)
  VALUES
    (auth.uid(), 'SUSPEND_OFFICER', 'officer_profile', p_officer_id,
     jsonb_build_object(
       'profile_id', v_officer.profile_id,
       'badge_number', v_officer.badge_number
     ));
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissions: service only authenticated users (never anonymous)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.approve_officer(UUID, user_role, UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_officer(UUID, user_role, UUID, TEXT, TEXT)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.suspend_officer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspend_officer(UUID) TO authenticated, service_role;
