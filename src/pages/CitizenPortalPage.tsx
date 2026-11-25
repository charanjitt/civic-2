import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle2, ClipboardList, MapPin, PlusCircle, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { civicService } from '../services/civicService';
import { MapView } from '../components/MapView';
import type {
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  NotificationItem,
} from '../types/civic';

export function CitizenPortalPage() {
  const { user, profile, updateProfile } = useAuth();
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Complaint form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<ComplaintPriority>('medium');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 17.385, lng: 78.4867 });
  const [submitting, setSubmitting] = useState(false);

  // Profile edit state
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [cats, myComplaints, myNotifs] = await Promise.all([
        civicService.listCategories(),
        civicService.listComplaints({ citizenId: user.id }),
        civicService.listNotifications(user.id),
      ]);
      setCategories(cats);
      if (cats.length > 0 && !categoryId) setCategoryId(cats[0].id);
      setComplaints(myComplaints);
      setNotifications(myNotifs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load citizen dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [user, categoryId]);

  useEffect(() => {
    void loadData();
    const unsub = civicService.subscribeToComplaints(() => {
      void loadData();
    });
    return unsub;
  }, [loadData]);

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !categoryId) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const selectedCat = categories.find((c) => c.id === categoryId);
      const created = await civicService.createComplaint({
        citizen_id: user.id,
        category_id: categoryId,
        department_id: selectedCat?.default_department_id ?? null,
        title,
        description,
        address,
        latitude: coords.lat,
        longitude: coords.lng,
        priority,
      });
      setSuccessMsg(`Complaint submitted! Tracking code: ${created.tracking_code}`);
      setTitle('');
      setDescription('');
      setAddress('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    try {
      await updateProfile({ full_name: fullName, phone: phone || null });
      setSuccessMsg('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const activeCount = complaints.filter((c) => !['resolved', 'verified', 'rejected'].includes(c.status)).length;
  const resolvedCount = complaints.filter((c) => ['resolved', 'verified'].includes(c.status)).length;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Citizen Portal</h1>
          <p className="text-sm text-slate-400">
            Report civic problems, pin exact coordinates, and track resolution in real time.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border border-slate-800 bg-civic-surface px-4 py-2 text-center">
            <div className="text-lg font-bold text-sky-400">{complaints.length}</div>
            <div className="text-[11px] text-slate-400">Total Reports</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-civic-surface px-4 py-2 text-center">
            <div className="text-lg font-bold text-amber-400">{activeCount}</div>
            <div className="text-[11px] text-slate-400">Active</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-civic-surface px-4 py-2 text-center">
            <div className="text-lg font-bold text-emerald-400">{resolvedCount}</div>
            <div className="text-[11px] text-slate-400">Resolved</div>
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Complaint Submission Form */}
        <section className="rounded-2xl border border-slate-800 bg-civic-surface p-6 lg:col-span-7">
          <div className="flex items-center gap-2 text-sky-400">
            <PlusCircle className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-white">Report a Civic Issue</h2>
          </div>

          <form onSubmit={(e) => void handleSubmitComplaint(e)} className="mt-5 space-y-4">
            <div>
              <label htmlFor="issue-title" className="block text-xs font-medium text-slate-300">
                Issue Title
              </label>
              <input
                id="issue-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Deep pothole near Central Avenue junction"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="issue-category" className="block text-xs font-medium text-slate-300">
                  Category
                </label>
                <select
                  id="issue-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="issue-priority" className="block text-xs font-medium text-slate-300">
                  Urgency / Priority
                </label>
                <select
                  id="issue-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="issue-address" className="block text-xs font-medium text-slate-300">
                Street Address / Landmark
              </label>
              <input
                id="issue-address"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 42 Main Market Road, Ward 7"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="issue-desc" className="block text-xs font-medium text-slate-300">
                Description
              </label>
              <textarea
                id="issue-desc"
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the problem, safety impact, and nearby landmarks..."
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 font-medium text-slate-300">
                  <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                  Location Pin (Click map or pick coordinates)
                </span>
                <span className="font-mono text-sky-400">
                  {coords.lat}, {coords.lng}
                </span>
              </div>
              <MapView
                complaints={complaints}
                selectable
                selectedCoords={coords}
                onSelectCoords={setCoords}
                heightClass="h-[240px]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {submitting ? 'Submitting Complaint...' : 'Submit Civic Complaint'}
            </button>
          </form>
        </section>

        {/* Notifications & Profile */}
        <aside className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-slate-800 bg-civic-surface p-6">
            <div className="flex items-center gap-2 text-amber-400">
              <Bell className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-white">Status Notifications</h2>
            </div>
            <div className="mt-4 max-h-60 space-y-2.5 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-400">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-3 text-xs ${
                      n.is_read
                        ? 'border-slate-800 bg-slate-950/50 text-slate-400'
                        : 'border-sky-500/30 bg-sky-500/10 text-slate-100'
                    }`}
                  >
                    <div className="font-semibold">{n.title}</div>
                    <p className="mt-0.5">{n.message}</p>
                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={() => void civicService.markNotificationRead(n.id).then(loadData)}
                        className="mt-1.5 text-[11px] font-medium text-sky-400 hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-civic-surface p-6">
            <div className="flex items-center gap-2 text-emerald-400">
              <User className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-white">Citizen Profile</h2>
            </div>
            <form onSubmit={(e) => void handleProfileSave(e)} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-400">Full Name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {savingProfile ? 'Saving...' : 'Update Profile'}
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* Complaint History */}
      <section className="rounded-2xl border border-slate-800 bg-civic-surface p-6">
        <div className="flex items-center gap-2 text-sky-400">
          <ClipboardList className="h-5 w-5" />
          <h2 className="text-lg font-semibold text-white">My Complaint History</h2>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading your complaints...</p>
        ) : complaints.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">You have not submitted any complaints yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2.5 pr-4">Tracking Code</th>
                  <th className="py-2.5 pr-4">Title</th>
                  <th className="py-2.5 pr-4">Category</th>
                  <th className="py-2.5 pr-4">Priority</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {complaints.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/40">
                    <td className="py-3 pr-4 font-mono font-semibold text-sky-400">{c.tracking_code}</td>
                    <td className="py-3 pr-4 font-medium text-white">{c.title}</td>
                    <td className="py-3 pr-4 text-slate-300">{c.category?.name ?? '—'}</td>
                    <td className="py-3 pr-4 uppercase text-amber-300">{c.priority}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 capitalize text-emerald-300">
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
