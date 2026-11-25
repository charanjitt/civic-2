import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { CitizenPortalPage } from './pages/CitizenPortalPage';
import { IssueMapPage } from './pages/IssueMapPage';
import { MunicipalLoginPage } from './pages/MunicipalLoginPage';
import { MunicipalPortalPage } from './pages/MunicipalPortalPage';
import { MUNICIPAL_ROLES } from './types/civic';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-civic-bg text-slate-100">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/map" element={<IssueMapPage />} />
              <Route
                path="/citizen"
                element={
                  <ProtectedRoute redirectTo="/auth">
                    <CitizenPortalPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/municipal/login" element={<MunicipalLoginPage />} />
              <Route
                path="/municipal"
                element={
                  <ProtectedRoute
                    allowedRoles={MUNICIPAL_ROLES}
                    requireVerifiedOfficial
                    redirectTo="/municipal/login"
                  >
                    <MunicipalPortalPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
