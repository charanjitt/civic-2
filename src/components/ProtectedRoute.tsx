import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/civic';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireVerifiedOfficial?: boolean;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requireVerifiedOfficial = false,
  redirectTo = '/auth',
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-civic-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold text-white">Access Restricted</h2>
        <p className="mt-2 text-sm text-slate-400">
          Your account role does not have permission to view this portal. Database Row Level Security also enforces this restriction.
        </p>
      </div>
    );
  }

  if (requireVerifiedOfficial && !profile?.is_verified_official) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold text-amber-400">Official Verification Pending</h2>
        <p className="mt-2 text-sm text-slate-400">
          Municipal employee accounts require administrator approval before accessing the Municipal Authority Portal.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
