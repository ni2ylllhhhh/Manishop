import { useEffect, useState } from 'react';
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
import { PaymentHistory } from './pages/PaymentHistory';
import { CashOut } from './pages/CashOut';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { VideoWatch } from './pages/VideoWatch';
import { Tasks } from './pages/Tasks';
import { TaskDetails } from './pages/TaskDetails';
import { TaskHistory } from './pages/TaskHistory';
import referInviteBanner from './assets/images/refer_invite_banner.jpg';
import smartEarningLogo from './assets/images/smart_earning_logo.png';
import taskCenterLogo from './assets/images/task_center_logo.webp';

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
  useEffect(() => {
    [referInviteBanner, smartEarningLogo, taskCenterLogo].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

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

const MAIN_TABS = new Set(['/', '/refer', '/tasks', '/wallet', '/profile']);

function AppShell() {
  const { pathname } = useLocation();
  const normalizedPath = pathname === "/task" ? "/tasks" : pathname;
  const isMainTab = MAIN_TABS.has(normalizedPath);
  const [visitedTabs, setVisitedTabs] = useState<string[]>(() =>
    isMainTab ? [normalizedPath] : ['/']
  );

  useEffect(() => {
    if (isMainTab) {
      setVisitedTabs((prev) => (prev.includes(normalizedPath) ? prev : [...prev, normalizedPath]));
    }
  }, [isMainTab, normalizedPath]);

  const hideBottomPadding = pathname === "/wallet/cashout" || pathname.startsWith("/video");

  return (
    <AuthProvider>
      <AuthGate>
        <ChannelVerificationGate>
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-cream shadow-2xl relative">
            <div className={hideBottomPadding ? "" : "pb-20"}>
              {visitedTabs.includes('/') && (
                <div className={normalizedPath === '/' ? 'block' : 'hidden'}>
                  <Home />
                </div>
              )}
              {visitedTabs.includes('/refer') && (
                <div className={normalizedPath === '/refer' ? 'block' : 'hidden'}>
                  <Refer />
                </div>
              )}
              {visitedTabs.includes('/tasks') && (
                <div className={normalizedPath === '/tasks' ? 'block' : 'hidden'}>
                  <Tasks />
                </div>
              )}
              {visitedTabs.includes('/wallet') && (
                <div className={normalizedPath === '/wallet' ? 'block' : 'hidden'}>
                  <Wallet />
                </div>
              )}
              {visitedTabs.includes('/profile') && (
                <div className={normalizedPath === '/profile' ? 'block' : 'hidden'}>
                  <Profile />
                </div>
              )}

              {!isMainTab && (
                <Routes>
                  <Route path="/video/:videoId" element={<VideoWatch />} />
                  <Route path="/tasks/history" element={<TaskHistory />} />
                  <Route path="/tasks/:taskId" element={<TaskDetails />} />
                  <Route path="/task" element={<Navigate to="/tasks" replace />} />
                  <Route path="/rank" element={<RankList />} />
                  <Route path="/wallet/payments" element={<PaymentHistory />} />
                  <Route path="/wallet/history" element={<PaymentHistory />} />
                  <Route path="/wallet/cashout" element={<CashOut />} />
                  <Route path="/profile/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              )}
            </div>
            {!pathname.startsWith("/video") && <BottomNav />}
          </div>
        </ChannelVerificationGate>
      </AuthGate>
    </AuthProvider>
  );
}
