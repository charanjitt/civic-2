import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Building,
  ClipboardCheck,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { civicService } from '../services/civicService';
import { MapView } from '../components/MapView';
import {
  ADMIN_ROLES,
  type ActivityLog,
  type Complaint,
  type ComplaintPriority,
  type ComplaintStatus,
  type Department,
  type OfficerProfile,
} from '../types/civic';

type TabKey = 'complaints' | 'departments' | 'officers' | 'map' | 'analytics' | 'logs';

export function MunicipalPortalPage() {
  const { user, profile, hasRole } = useAuth();
  const [tab, setTab] = useState<TabKey>('complaints');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New department form
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');

  const isAdmin = hasRole(ADMIN_ROLES);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [cList, dList, oList] = await Promise.all([
        civicService.listComplaints(),
        civicService.listDepartments(),
        civicService.listOfficers(),
      ]);
      setComplaints(cList);
      setDepartments(dList);
      setOfficers(oList);

      if (isAdmin) {
        const logList = await civicService.listActivityLogs();
        setLogs(logList);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load municipal portal data.');
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadAll();
    const unsub = civicService.subscribeToComplaints(() => {
      void loadAll();
    });
    return unsub;
  }, [loadAll]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (deptFilter !== 'all' && c.department_id !== deptFilter) return false;
      return true;
    });
  }, [complaints, statusFilter, deptFilter]);

  const metrics = useMemo(() => {
    const total = complaints.length;
    const open = complaints.filter((c) => !['resolved', 'verified', 'rejected'].includes(c.status)).length;
    const urgent = complaints.filter((c) => c.priority === 'critical' || c.priority === 'high').length;
    const verified = complaints.filter((c) => c.status === 'verified').length;
    return { total, open, urgent, verified };
  }, [complaints]);

  const departmentBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    complaints.forEach((c) => {
      const label = c.department?.name ?? 'Unassigned';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries());
  }, [complaints]);

  const handleWorkflowUpdate = async (
    c: Complaint,
    nextStatus: ComplaintStatus,
    nextPriority: ComplaintPriority,
    nextDeptId: string | null
  ) => {
    if (!user) return;
    setFeedback(null);
    setError(null);
    try {
      await civicService.updateComplaintWorkflow({
        complaintId: c.id,
        actorId: user.id,
        oldStatus: c.status,
        newStatus: nextStatus,
        priority: nextPriority,
        departmentId: nextDeptId,
      });
      setFeedback(`Updated ${c.tracking_code} (${nextStatus}).`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update complaint.');
    }
  };

  const handleAssignOfficer = async (c: Complaint, officerId: string) => {
    if (!user || !officerId) return;
    const officer = officers.find((o) => o.id === officerId);
    if (!officer) return;
    try {
      await civicService.assignOfficer({
        complaintId: c.id,
        officerId: officer.id,
        departmentId: officer.department_id,
        assignedBy: user.id,
      });
      if (c.status === 'submitted' || c.status === 'acknowledged') {
        await civicService.updateComplaintWorkflow({
          complaintId: c.id,
          actorId: user.id,
          oldStatus: c.status,
          newStatus: 'assigned',
          departmentId: officer.department_id,
          note: `Assigned to ${officer.profile?.full_name ?? officer.badge_number}`,
        });
      }
      setFeedback(`Assigned ${c.tracking_code} to officer ${officer.badge_number}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign officer.');
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await civicService.createDepartment({ code: deptCode, name: deptName, description: deptDesc });
      setDeptCode('');
      setDeptName('');
      setDeptDesc('');
      setFeedback('Department created.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create department.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {profile?.role.replace('_', ' ')}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            Municipal Authority Portal
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-civic-surface px-4 py-2.5">
            <div className="text-lg font-bold text-white">{metrics.total}</div>
            <div className="text-[11px] text-slate-400">Total Complaints</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-civic-surface px-4 py-2.5">
            <div className="text-lg font-bold text-amber-400">{metrics.open}</div>
            <div className="text-[11px] text-slate-400">Open Queue</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-civic-surface px-4 py-2.5">
            <div className="text-lg font-bold text-rose-400">{metrics.urgent}</div>
            <div className="text-[11px] text-slate-400">High / Critical</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-civic-surface px-4 py-2.5">
            <div className="text-lg font-bold text-emerald-400">{metrics.verified}</div>
            <div className="text-[11px] text-slate-400">Verified</div>
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
      {feedback && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">{feedback}</div>}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {(
          [
            { id: 'complaints', label: 'Complaints', icon: ClipboardCheck },
            { id: 'departments', label: 'Departments', icon: Building },
            { id: 'officers', label: 'Field Officers', icon: Users },
            { id: 'map', label: 'Geo Monitor', icon: MapPin },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            ...(isAdmin ? [{ id: 'logs', label: 'Activity Logs', icon: Activity }] : []),
          ] as Array<{ id: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }>
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                tab === item.id
                  ? 'bg-emerald-500 text-slate-950'
                  : 'border border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'complaints' && (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-civic-surface p-6">
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="all">All Statuses</option>
              {['submitted', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'verified', 'rejected'].map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2.5 pr-4">Code</th>
                  <th className="py-2.5 pr-4">Issue</th>
                  <th className="py-2.5 pr-4">Department</th>
                  <th className="py-2.5 pr-4">Priority</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5">Assign Officer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredComplaints.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-4 font-mono text-sky-400">{c.tracking_code}</td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-white">{c.title}</div>
                      <div className="text-[11px] text-slate-400">{c.address}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={c.department_id ?? ''}
                        onChange={(e) =>
                          void handleWorkflowUpdate(c, c.status, c.priority, e.target.value || null)
                        }
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      >
                        <option value="">Unassigned</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={c.priority}
                        onChange={(e) =>
                          void handleWorkflowUpdate(
                            c,
                            c.status,
                            e.target.value as ComplaintPriority,
                            c.department_id
                          )
                        }
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-amber-300"
                      >
                        {(['low', 'medium', 'high', 'critical'] as ComplaintPriority[]).map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={c.status}
                        onChange={(e) =>
                          void handleWorkflowUpdate(
                            c,
                            e.target.value as ComplaintStatus,
                            c.priority,
                            c.department_id
                          )
                        }
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-emerald-300"
                      >
                        {(
                          [
                            'submitted',
                            'acknowledged',
                            'assigned',
                            'in_progress',
                            'resolved',
                            'verified',
                            'rejected',
                          ] as ComplaintStatus[]
                        ).map((s) => (
                          <option key={s} value={s}>
                            {s.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3">
                      <select
                        defaultValue=""
                        onChange={(e) => void handleAssignOfficer(c, e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                      >
                        <option value="" disabled>
                          Select officer...
                        </option>
                        {officers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.profile?.full_name ?? o.badge_number} ({o.department?.code ?? 'DEPT'})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'departments' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-800 bg-civic-surface p-6 lg:col-span-7">
            <h2 className="text-base font-semibold text-white">Active Municipal Departments</h2>
            <div className="mt-4 space-y-3">
              {departments.map((d) => (
                <div key={d.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{d.name}</span>
                    <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-sky-300">{d.code}</span>
                  </div>
                  {d.description && <p className="mt-1 text-slate-400">{d.description}</p>}
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <form
              onSubmit={(e) => void handleCreateDepartment(e)}
              className="space-y-3 rounded-2xl border border-slate-800 bg-civic-surface p-6 lg:col-span-5"
            >
              <h2 className="text-base font-semibold text-white">Create Department</h2>
              <input
                required
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                placeholder="Code (e.g. PARKS)"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <input
                required
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="Department Name"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <textarea
                rows={3}
                value={deptDesc}
                onChange={(e) => setDeptDesc(e.target.value)}
                placeholder="Responsibilities..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Add Department
              </button>
            </form>
          )}
        </div>
      )}

      {tab === 'officers' && (
        <div className="rounded-2xl border border-slate-800 bg-civic-surface p-6">
          <h2 className="text-base font-semibold text-white">Authorized Field & Department Officers</h2>
          {officers.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">No officer profiles registered yet.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {officers.map((o) => (
                <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs">
                  <div className="font-semibold text-white">{o.profile?.full_name ?? 'Officer'}</div>
                  <div className="mt-0.5 font-mono text-sky-400">Badge: {o.badge_number}</div>
                  <div className="mt-1 text-slate-400">{o.designation} · {o.department?.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'map' && (
        <div className="space-y-4">
          <MapView complaints={filteredComplaints} heightClass="h-[480px]" />
        </div>
      )}

      {tab === 'analytics' && (
        <div className="rounded-2xl border border-slate-800 bg-civic-surface p-6">
          <h2 className="text-base font-semibold text-white">Department Workload Analytics</h2>
          <div className="mt-4 space-y-3">
            {departmentBreakdown.map(([deptNameLabel, count]) => {
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              return (
                <div key={deptNameLabel} className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>{deptNameLabel}</span>
                    <span>{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-sky-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'logs' && isAdmin && (
        <div className="rounded-2xl border border-slate-800 bg-civic-surface p-6">
          <h2 className="text-base font-semibold text-white">Administrative Activity Logs</h2>
          <div className="mt-4 space-y-2 text-xs">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div>
                  <span className="font-mono font-semibold text-emerald-400">{log.action}</span>
                  <span className="ml-2 text-slate-400">{log.entity_type}</span>
                </div>
                <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
