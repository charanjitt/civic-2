import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin } from 'lucide-react';
import type { Complaint } from '../types/civic';

interface MapViewProps {
  complaints: Complaint[];
  center?: [number, number];
  zoom?: number;
  selectable?: boolean;
  selectedCoords?: { lat: number; lng: number } | null;
  onSelectCoords?: (coords: { lat: number; lng: number }) => void;
  heightClass?: string;
}

const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
const hasValidToken = Boolean(mapboxToken && !mapboxToken.includes('your-mapbox-public-token'));

export function MapView({
  complaints,
  center = [78.4867, 17.385],
  zoom = 12,
  selectable = false,
  selectedCoords,
  onSelectCoords,
  heightClass = 'h-[420px]',
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const pickMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!hasValidToken || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = mapboxToken!;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'top-right'
    );

    if (selectable && onSelectCoords) {
      map.on('click', (e) => {
        onSelectCoords({
          lat: Number(e.lngLat.lat.toFixed(6)),
          lng: Number(e.lngLat.lng.toFixed(6)),
        });
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom, selectable, onSelectCoords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    complaints.forEach((c) => {
      const color =
        c.priority === 'critical'
          ? '#ef4444'
          : c.priority === 'high'
          ? '#f59e0b'
          : '#38bdf8';

      const popup = new mapboxgl.Popup({ offset: 18 }).setHTML(
        `<div class="text-xs">
          <div class="font-mono text-sky-400">${c.tracking_code}</div>
          <div class="font-semibold text-white mt-0.5">${c.title}</div>
          <div class="text-slate-300 mt-1">${c.address}</div>
          <div class="mt-1 text-slate-400">Status: <strong class="text-emerald-300">${c.status}</strong></div>
        </div>`
      );

      const marker = new mapboxgl.Marker({ color })
        .setLngLat([c.longitude, c.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [complaints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCoords) return;

    pickMarkerRef.current?.remove();
    pickMarkerRef.current = new mapboxgl.Marker({ color: '#10b981' })
      .setLngLat([selectedCoords.lng, selectedCoords.lat])
      .addTo(map);
  }, [selectedCoords]);

  if (!hasValidToken) {
    return (
      <div
        className={`${heightClass} flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5`}
      >
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-400">
            <MapPin className="h-4 w-4" />
            Mapbox GL JS Ready (Token Required for Tile Rendering)
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Set <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sky-300">VITE_MAPBOX_ACCESS_TOKEN</code> in{' '}
            <code className="rounded bg-slate-800 px-1.5 py-0.5">.env</code> to render interactive Mapbox vector tiles.
          </p>
        </div>

        {selectable && onSelectCoords && (
          <div className="my-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <p className="text-xs font-medium text-slate-300">Quick Coordinate Picker:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { label: 'Downtown Hub', lat: 17.385, lng: 78.4867 },
                { label: 'North Sector', lat: 17.4126, lng: 78.4482 },
                { label: 'East Ward', lat: 17.3714, lng: 78.526 },
              ].map((spot) => (
                <button
                  key={spot.label}
                  type="button"
                  onClick={() => onSelectCoords({ lat: spot.lat, lng: spot.lng })}
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-200 hover:border-sky-500"
                >
                  {spot.label} ({spot.lat}, {spot.lng})
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-slate-400">
          Active Geo-Markers Loaded: <strong className="text-white">{complaints.length}</strong>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${heightClass} w-full overflow-hidden rounded-2xl border border-slate-800`}
    />
  );
}
