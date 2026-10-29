import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { AuthGate } from './components/AuthGate';
import { ChannelVerificationGate } from './components/ChannelVerificationGate';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { Refer } from './pages/Refer';
import { RankList } from './pages/RankList';
import { Wallet } from './pages/Wallet';
import { CashOut } from './pages/CashOut';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';

function AdminAutoRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    try {
      const hash = window.location.hash || '';
      const search = window.location.search || location.search || '';
      const searchParams = new URLSearchParams(search);
      const tgStart = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
      const winPath = (window.location.pathname || '').toLowerCase();
      const locPath = (location.pathname || '').toLowerCase();

      const shouldBeAdmin =
        winPath === '/admin' ||
        winPath === '/admin/' ||
        winPath === '/admin.html' ||
        winPath.startsWith('/admin') ||
        locPath === '/admin/' ||
        locPath === '/admin.html' ||
        hash === '#/admin' ||
        hash === '#admin' ||
        hash.startsWith('#/admin') ||
        hash.startsWith('#admin') ||
        searchParams.get('page') === 'admin' ||
        searchParams.has('admin') ||
        tgStart === 'admin';

      if (shouldBeAdmin && location.pathname !== '/admin') {
        navigate('/admin', { replace: true });
      }
    } catch {}
  }, [location, navigate]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AdminAutoRedirect />
      <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 4000 }} />
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/admin/" element={<Admin />} />
        <Route path="/admin.html" element={<Admin />} />
        <Route path="admin" element={<Admin />} />
        <Route path="admin/*" element={<Admin />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  const hideBottomPadding = pathname === "/wallet/cashout";

  return (
    <AuthProvider>
      <AuthGate>
        <ChannelVerificationGate>
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-cream shadow-2xl relative">
            <div className={hideBottomPadding ? "" : "pb-16"}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/refer" element={<Refer />} />
                <Route path="/rank" element={<RankList />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/wallet/cashout" element={<CashOut />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
            <BottomNav />
          </div>
        </ChannelVerificationGate>
      </AuthGate>
    </AuthProvider>
  );
}
