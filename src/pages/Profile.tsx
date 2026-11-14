import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Settings as SettingsIcon,
  BadgeCheck,
  User as UserIcon,
  Send,
  Link as LinkIcon,
  Trophy,
  ChevronRight
} from 'lucide-react';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import { formatDate } from '../lib/format';
import { AdsterraBanner } from '../components/AdsterraBanner';
import { triggerHaptic } from '../lib/telegram';

export function Profile() {
  const { user: authUser } = useAuth();
  const db = useAppStore();
  const config = db.config;
  const navigate = useNavigate();

  const user = (authUser?.telegramId && db.users[authUser.telegramId]) ? db.users[authUser.telegramId] : authUser;

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
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-card active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-ink" />
          </button>
          <h1 className="text-[15px] font-extrabold text-ink">Profile</h1>
        </div>

        <button
          type="button"
          onClick={() => navigate("/profile/settings")}
          aria-label="Settings"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-card active:scale-95 transition cursor-pointer"
        >
          <SettingsIcon className="h-4 w-4 text-brand-500" />
        </button>
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
                ✅ Channel Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9.5px] font-bold text-red-600 border border-red-200">
                ❌ Unverified
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

        {/* 3 Stats: Balance, Referrals, Referral Earnings */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatBox label="BALANCE" value={`$${user.balance.toFixed(2)}`} />
          <StatBox label="REFERRALS" value={String(user.referralCount)} />
          <StatBox label="REF EARNED" value={`$${(Number(user.referralEarned) || 0).toFixed(2)}`} />
        </div>

        {/* Dedicated Leaderboard Action Button */}
        <button
          onClick={() => {
            triggerHaptic('medium');
            navigate('/rank');
          }}
          className="mt-2.5 flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-3 py-2 border border-amber-200/80 transition hover:bg-amber-500/15 active:scale-98 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
              <Trophy className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="text-[12px] font-extrabold text-ink leading-tight">View Leaderboard</p>
              <p className="text-[10px] text-gray-500">Top 50 users ranking & earnings</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-amber-600" />
        </button>
      </section>

      {/* 300x250 Banner Ad on Profile Page */}
      <div className="mt-4 flex flex-col items-center">
        <AdsterraBanner
          index={1}
          adKey={config.videoBannerAds?.adKey || '911ee250303f0d466e6e2cab58b077e0'}
          scriptHost={config.videoBannerAds?.scriptHost || 'https://bauval.org/22'}
        />
      </div>
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
