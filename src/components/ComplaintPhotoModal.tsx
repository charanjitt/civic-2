import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, MapPin, X } from 'lucide-react';
import type { Complaint } from '../types/civic';

interface ComplaintPhotoModalProps {
  complaint: Complaint | null;
  initialIndex?: number;
  onClose: () => void;
}

export function ComplaintPhotoModal({
  complaint,
  initialIndex = 0,
  onClose,
}: ComplaintPhotoModalProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    setActiveIndex(initialIndex);
  }, [complaint, initialIndex]);

  useEffect(() => {
    if (!complaint) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [complaint, onClose]);

  if (!complaint) return null;

  const photos = complaint.signed_photo_urls ?? [];
  const safeIndex = photos.length > 0 ? Math.min(activeIndex, photos.length - 1) : 0;
  const activeUrl = photos[safeIndex] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo evidence for ${complaint.tracking_code}`}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-semibold text-sky-400">
                {complaint.tracking_code}
              </span>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 uppercase text-amber-300">
                {complaint.priority}
              </span>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 capitalize text-emerald-300">
                {complaint.status.replace('_', ' ')}
              </span>
            </div>
            <h3 className="mt-1 text-base font-semibold text-white">{complaint.title}</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo viewer"
            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {activeUrl ? (
            <div className="space-y-3">
              <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                <img
                  src={activeUrl}
                  alt={`Problem evidence ${safeIndex + 1} for ${complaint.title}`}
                  className="max-h-[440px] w-auto max-w-full object-contain"
                />

                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex((prev) => (prev - 1 + photos.length) % photos.length)
                      }
                      aria-label="Previous photo"
                      className="absolute left-3 rounded-full border border-slate-700 bg-slate-900/90 p-2 text-white hover:bg-slate-800"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveIndex((prev) => (prev + 1) % photos.length)}
                      aria-label="Next photo"
                      className="absolute right-3 rounded-full border border-slate-700 bg-slate-900/90 p-2 text-white hover:bg-slate-800"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  {photos.length > 1 &&
                    photos.map((url, idx) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setActiveIndex(idx)}
                        className={`h-12 w-16 overflow-hidden rounded-lg border transition ${
                          idx === safeIndex
                            ? 'border-sky-400 ring-2 ring-sky-400/40'
                            : 'border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={url}
                          alt={`Thumbnail ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  <span className="text-slate-400">
                    Photo {safeIndex + 1} of {photos.length}
                  </span>
                </div>

                <a
                  href={activeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-sky-400 hover:bg-slate-800"
                >
                  Open Full Image
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 py-12 text-center text-xs text-slate-400">
              <ImageOff className="h-7 w-7 text-slate-500" />
              <p className="mt-2">
                {complaint.photo_urls?.length
                  ? 'Unable to load signed photo link. Sign in with an authorized account and ensure Migration 005 has been applied.'
                  : 'No photo attached to this complaint.'}
              </p>
            </div>
          )}

          <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs">
            <div>
              <span className="font-semibold text-slate-300">Reported Problem Details:</span>
              <p className="mt-1 leading-relaxed text-slate-200">{complaint.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-slate-400">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                {complaint.address}
              </span>
              <span className="font-mono text-sky-400">
                ({complaint.latitude}, {complaint.longitude})
              </span>
              {complaint.department?.name && (
                <span>Department: {complaint.department.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
