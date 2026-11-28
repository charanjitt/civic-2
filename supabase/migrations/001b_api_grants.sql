-- CivicConnect Migration 001b — PostgREST API grants (the "door keys")
-- Date: 2026-11-28
--
-- Why this file exists:
-- Observed error after 001 on this project:
--   42501 permission denied for table ... GRANT SELECT ON public.<table> TO anon
-- Table-level GRANTs are checked BEFORE Row Level Security can run, so
-- without them every API query fails even though RLS policies are correct.
-- Newer Supabase projects may not auto-grant the historic default
-- privileges, so we grant them explicitly here.
--
-- Security note: these grants only unlock the door. Actual data
-- protection comes from Row Level Security (migration 002), which
-- should be run immediately after this file.
--
-- Order: 001 → 001b → 002 → 003 → 004

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Future tables/sequences/functions created by this role inherit the grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public
  TO anon, authenticated, service_role;
