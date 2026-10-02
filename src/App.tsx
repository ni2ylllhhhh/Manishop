import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { AuthGate } from './components/AuthGate';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { Refer } from './pages/Refer';
import { RankList } from './pages/RankList';
import { Wallet } from './pages/Wallet';
import { CashOut } from './pages/CashOut';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 4000 }} />
      <Routes>
        <Route path="/admin" element={<Admin />} />
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
      </AuthGate>
    </AuthProvider>
  );
}
