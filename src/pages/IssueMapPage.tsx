import { useEffect, useState } from 'react';
import { Compass, MapPin } from 'lucide-react';
import { MapView } from '../components/MapView';
import { civicService } from '../services/civicService';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Complaint, NearbyComplaint } from '../types/civic';

export function IssueMapPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [nearby, setNearby] = useState<NearbyComplaint[]>([]);
  const [lat, setLat] = useState('17.3850');
  const [lng, setLng] = useState('78.4867');
  const [radius, setRadius] = useState('2000');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void civicService
      .listComplaints()
      .then(setComplaints)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load complaints.'));
  }, []);

  const handleNearbySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const results = await civicService.findNearbyComplaints(
        Number(lat),
        Number(lng),
        Number(radius)
      );
      setNearby(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PostGIS spatial query failed.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Geographic Civic Issue Map</h1>
        <p className="text-sm text-slate-400">
          Visualize reported issues across the city and run PostGIS spatial radius searches.
        </p>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}

      <MapView complaints={complaints} heightClass="h-[460px]" />

      <div className="rounded-2xl border border-slate-800 bg-civic-surface p-6">
        <div className="flex items-center gap-2 text-sky-400">
          <Compass className="h-5 w-5" />
          <h2 className="text-base font-semibold text-white">PostGIS Nearby Complaint Search</h2>
        </div>

        <form onSubmit={(e) => void handleNearbySearch(e)} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="Latitude"
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="Longitude"
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <input
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            placeholder="Radius (meters)"
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="submit"
            disabled={!isSupabaseConfigured}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          >
            Find Nearby
          </button>
        </form>

        {nearby.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sky-400">{item.tracking_code}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <MapPin className="h-3 w-3" />
                    {Math.round(item.distance_meters)} m
                  </span>
                </div>
                <p className="mt-1 font-medium text-white">{item.title}</p>
                <p className="mt-0.5 capitalize text-slate-400">Status: {item.status.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
