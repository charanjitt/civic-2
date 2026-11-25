import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { MUNICIPAL_ROLES } from '../types/civic';
import * as AuthModule from '../context/AuthContext';

function mockAuthState(overrides: Partial<ReturnType<typeof AuthModule.useAuth>>) {
  vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
    user: null,
    session: null,
    profile: null,
    loading: false,
    isConfigured: true,
    isMunicipalStaff: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
    updateProfile: vi.fn(),
    hasRole: vi.fn().mockReturnValue(false),
    ...overrides,
  });
}

describe('ProtectedRoute role & security enforcement', () => {
  it('redirects unauthenticated users to login', () => {
    mockAuthState({ user: null, profile: null });
    render(
      <MemoryRouter initialEntries={['/municipal']}>
        <Routes>
          <Route
            path="/municipal"
            element={
              <ProtectedRoute allowedRoles={MUNICIPAL_ROLES} requireVerifiedOfficial redirectTo="/municipal/login">
                <div>Municipal Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route path="/municipal/login" element={<div>Staff Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Staff Login Page')).toBeInTheDocument();
  });

  it('blocks citizen role from municipal administration portal', () => {
    mockAuthState({
      user: { id: 'u1' } as never,
      profile: {
        id: 'u1',
        full_name: 'Citizen User',
        email: 'citizen@example.com',
        phone: null,
        role: 'citizen',
        is_verified_official: false,
        avatar_url: null,
        created_at: '',
        updated_at: '',
      },
    });

    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={MUNICIPAL_ROLES} requireVerifiedOfficial>
          <div>Municipal Dashboard</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.queryByText('Municipal Dashboard')).not.toBeInTheDocument();
  });

  it('blocks unverified officials until approved by admin', () => {
    mockAuthState({
      user: { id: 'u2' } as never,
      profile: {
        id: 'u2',
        full_name: 'Pending Officer',
        email: 'officer@gov.in',
        phone: null,
        role: 'field_officer',
        is_verified_official: false,
        avatar_url: null,
        created_at: '',
        updated_at: '',
      },
    });

    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={MUNICIPAL_ROLES} requireVerifiedOfficial>
          <div>Municipal Dashboard</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Official Verification Pending')).toBeInTheDocument();
  });

  it('allows verified municipal officers', () => {
    mockAuthState({
      user: { id: 'u3' } as never,
      profile: {
        id: 'u3',
        full_name: 'Verified Admin',
        email: 'admin@gov.in',
        phone: null,
        role: 'municipal_admin',
        is_verified_official: true,
        avatar_url: null,
        created_at: '',
        updated_at: '',
      },
    });

    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={MUNICIPAL_ROLES} requireVerifiedOfficial>
          <div>Municipal Dashboard</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Municipal Dashboard')).toBeInTheDocument();
  });
});
