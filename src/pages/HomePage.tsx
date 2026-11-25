import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, MapPin, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { CityScene, type CameraPreset } from '../components/CityScene';
import { civicService } from '../services/civicService';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Complaint } from '../types/civic';

export function HomePage() {
  const [preset, setPreset] = useState<CameraPreset>('overview');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [trackingCode, setTrackingCode] = useState('');
  const [tracked, setTracked] = useState<Complaint | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void civicService
      .listComplaints()
      .then(setComplaints)
      .catch(() => {});
  }, []);

  const handleTrackLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError(null);
    setTracked(null);
    if (!trackingCode.trim()) return;
    try {
      const found = await civicService.getComplaintByTrackingCode(trackingCode);
      if (!found) {
        setTrackError(`No complaint found for code "${trackingCode.trim().toUpperCase()}".`);
      } else {
        setTracked(found);
      }
    } catch (err) {
      setTrackError(err instanceof Error ? err.message : 'Unable to look up tracking code.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="grid gap-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
            <Sparkles className="h-3.5 w-3.5" />
            Hybrid 3D Smart City Digital Twin
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Report civic issues.{' '}
            <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
              Coordinate resolution.
            </span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
            CivicConnect unites citizens and municipal departments inside an interactive 3D smart city,
            backed by PostgreSQL + PostGIS spatial intelligence, real-time tracking, and role-secured governance.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/citizen"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
            >
              Open Citizen Portal
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/municipal"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-white transition hover:border-slate-500"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Municipal Authority
            </Link>
          </div>

          <form
            onSubmit={(e) => void handleTrackLookup(e)}
            className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
          >
            <label htmlFor="quick-track" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Quick Complaint Tracker
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="quick-track"
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="Enter code (e.g. CC-2026-A1B2C3)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                <Search className="h-4 w-4" />
                Track
              </button>
            </div>
            {trackError && <p className="mt-2 text-xs text-rose-400">{trackError}</p>}
            {tracked && (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-emerald-300">{tracked.tracking_code}</span>
                  <span className="rounded bg-slate-900 px-2 py-0.5 uppercase text-sky-300">{tracked.status}</span>
                </div>
                <p className="mt-1 font-medium text-white">{tracked.title}</p>
                <p className="mt-0.5 text-slate-400">{tracked.address}</p>
              </div>
            )}
          </form>
        </div>

        <div className="lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Compass className="h-4 w-4 text-sky-400" />
              <span>Drag to orbit · Scroll to zoom · Click glowing nodes to inspect</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['overview', 'downtown', 'residential', 'civic'] as CameraPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                    preset === p
                      ? 'bg-sky-500 text-slate-950'
                      : 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[460px] w-full">
            <CityScene complaints={complaints} preset={preset} />
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-civic-surface p-5">
          <MapPin className="h-5 w-5 text-sky-400" />
          <h2 className="mt-3 text-base font-semibold text-white">PostGIS Spatial Precision</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Every reported pothole, streetlight, or water leak is indexed with WGS-84 geography coordinates for instant nearby-issue clustering.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-civic-surface p-5">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h2 className="mt-3 text-base font-semibold text-white">Database-Enforced Roles</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Supabase Row Level Security isolates citizen records, field officer tasks, and municipal administrator controls at the PostgreSQL layer.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-civic-surface p-5">
          <Sparkles className="h-5 w-5 text-amber-400" />
          <h2 className="mt-3 text-base font-semibold text-white">Live Realtime Sync</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Citizens receive instant status notifications as municipal departments acknowledge, assign, and verify field resolutions.
          </p>
        </div>
      </section>
    </div>
  );
}
