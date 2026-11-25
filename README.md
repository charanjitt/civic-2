# CivicConnect — Intelligent 3D Smart City & Municipal Management Platform

## Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **3D Twin:** Three.js, React Three Fiber, Drei, GSAP
- **Backend & Spatial DB:** Supabase, PostgreSQL, PostGIS, Supabase Auth, Supabase Realtime, Row Level Security (RLS)
- **Maps:** Mapbox GL JS
- **Testing & Deployment:** Vitest, React Testing Library, Vercel

## Setup
1. Copy `.env.example` to `.env` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_MAPBOX_ACCESS_TOKEN`
2. Run SQL migrations in your Supabase SQL Editor in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_and_spatial_functions.sql`
3. Install & run locally:
   ```bash
   npm install
   npm run dev
   ```
4. Verify tests and production build:
   ```bash
   npm test
   npm run build
   ```
