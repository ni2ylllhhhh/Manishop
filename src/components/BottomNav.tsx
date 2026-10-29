import { NavLink, useLocation } from 'react-router-dom';
import { Home, Users, Trophy, Wallet, User as UserIcon } from 'lucide-react';
import { triggerHaptic } from '../lib/telegram';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  center?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/refer", label: "Refer", icon: Users },
  { to: "/rank", label: "Rank", icon: Trophy, center: true },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/profile", label: "Profile", icon: UserIcon }
];

export function BottomNav() {
  const { pathname } = useLocation();

  if (pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-14 max-w-md items-stretch border-t border-black/5 bg-white/95 backdrop-blur"
    >
      {NAV_ITEMS.map(({ to, label, icon: Icon, center }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={() => triggerHaptic("light")}
          className="relative flex flex-1 flex-col items-center justify-center gap-0.5"
        >
          {({ isActive }) =>
            center ? (
              <>
                <span
                  className={`-mt-6 flex h-11 w-11 items-center justify-center rounded-full shadow-card transition-transform active:scale-95 ${
                    isActive ? "bg-brand-500 shadow-md" : "bg-brand-100"
                  }`}
                >
                  <Trophy
                    className={`h-5 w-5 ${isActive ? "text-white" : "text-brand-500"}`}
                  />
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    isActive ? "text-brand-600" : "text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </>
            ) : (
              <>
                <Icon
                  className={`h-[18px] w-[18px] transition-colors ${
                    isActive ? "text-brand-600" : "text-gray-400"
                  }`}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
                <span
                  className={`text-[10px] ${
                    isActive ? "font-bold text-brand-600" : "font-medium text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </>
            )
          }
        </NavLink>
      ))}
    </nav>
  );
}
