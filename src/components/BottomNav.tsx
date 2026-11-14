import { NavLink, useLocation } from 'react-router-dom';
import { Home, Users, ListTodo, Wallet, User as UserIcon } from 'lucide-react';
import { triggerHaptic } from '../lib/telegram';
import taskCenterLogo from '../assets/images/task_center_logo.webp';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  center?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/refer", label: "Refer", icon: Users },
  { to: "/tasks", label: "Task", icon: ListTodo, center: true },
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
      className="fixed inset-x-3 bottom-2.5 z-40 mx-auto flex h-14 max-w-[424px] items-stretch rounded-full border border-orange-200/80 bg-gradient-to-r from-[#fff3eb] via-[#fffaf6] to-[#ffedf1] px-2 shadow-[0_8px_24px_-6px_rgba(24,20,12,0.16)]"
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
                  className={`-mt-6 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 bg-black shadow-md transition-transform active:scale-95 ${
                    isActive
                      ? "border-brand-600 ring-2 ring-brand-500/35"
                      : "border-brand-400"
                  }`}
                >
                  <img
                    src={taskCenterLogo}
                    alt={label}
                    loading="eager"
                    decoding="sync"
                    className="h-full w-full scale-[1.06] object-cover"
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
