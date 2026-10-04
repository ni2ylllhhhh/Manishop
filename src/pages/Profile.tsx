import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  BadgeCheck,
  User as UserIcon,
  Send,
  Link as LinkIcon,
  Trophy,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import { formatDate } from '../lib/format';

export function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const rankTier = useMemo(() => {
    const refs = user?.referralCount ?? 0;
    if (refs >= 50) return "Diamond";
    if (refs >= 25) return "Gold";
    if (refs >= 10) return "Silver";
    return "Bronze";
  }, [user?.referralCount]);

  if (!user) return null;

  return (
    <main className="px-3 pt-3 pb-8">
      {/* Top Header */}
      <header className="mb-3 flex items-center gap-2">
        <button
          onClick={() => navigate("/profile/settings")}
          aria-label="Settings"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-card active:scale-95 transition"
        >
          <SettingsIcon className="h-4 w-4 text-brand-500" />
        </button>
        <h1 className="text-[15px] font-extrabold text-ink">Profile</h1>
      </header>

      {/* Main Profile Info Card */}
      <section className="rounded-2xl bg-white p-3 shadow-card">
        <div>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1 text-[16px] font-extrabold text-ink">
              {user.firstName} {user.lastName}
              {user.verified && <BadgeCheck className="h-4 w-4 text-emerald-500 fill-emerald-500" />}
            </p>
            {user.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-600 border border-emerald-200">
                ✅ চ্যানেল ভেরিফাইড
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9.5px] font-bold text-red-600 border border-red-200">
                ❌ আনভেরিফাইড
              </span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400 font-mono">
            <UserIcon className="h-3 w-3" /> User ID: {user.telegramId}
          </p>
          {user.bio && (
            <p className="mt-1 text-[11.5px] text-gray-600 italic">
              "{user.bio}"
            </p>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          <Avatar src={user.photoUrl} name={user.firstName} size={62} ring="ring-brand-100" />
          <div className="flex-1 space-y-1">
            <ProfileRow
              icon={<Send className="h-3.5 w-3.5 text-[#229ED9]" />}
              label="Telegram ID:"
              value={user.telegramId}
            />
            <ProfileRow
              icon={<LinkIcon className="h-3.5 w-3.5 text-gray-400" />}
              label="Ref ID:"
              value={user.telegramId}
              valueClass="text-indigo-600 font-mono"
            />
            <ProfileRow
              icon={<Trophy className="h-3.5 w-3.5 text-yellow-500" />}
              label="Ref Level:"
              value={`${rankTier} (${user.referralCount} refs)`}
            />
          </div>
        </div>

        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
          <BadgeCheck className="h-3.5 w-3.5 text-yellow-500" />
          {user.verified ? "Verified Member" : "Standard Member"} • Joined {formatDate(user.createdAt)}
        </div>

        {/* 3 Stats: Balance, Referrals, Earned */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatBox label="Balance" value={`$${user.balance.toFixed(2)}`} />
          <StatBox label="Referrals" value={String(user.referralCount)} />
          <StatBox label="Earned" value={`$${user.lifetimeEarned.toFixed(2)}`} />
        </div>

        {/* Direct Admin Panel Access */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 py-2.5 px-4 text-xs font-bold text-white shadow-sm transition active:scale-98"
          >
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            <span>অ্যাডমিন প্যানেল (Admin Panel)</span>
          </button>
        </div>
      </section>
    </main>
  );
}

function ProfileRow({
  icon,
  label,
  value,
  valueClass = "text-ink"
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <p className="flex items-center gap-1.5 text-[11.5px] text-gray-500">
      {icon}
      <span>{label}</span>
      <span className={`font-bold ${valueClass}`}>{value}</span>
    </p>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream py-2 text-center border border-black/5">
      <p className="text-[13px] font-extrabold text-ink">{value}</p>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
    </div>
  );
}
