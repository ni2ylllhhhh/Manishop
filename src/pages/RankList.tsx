import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Crown, Flame, TrendingUp } from 'lucide-react';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import { maskUid } from '../lib/format';
import type { User } from '../types';

export function RankList() {
  const db = useAppStore();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const sortedUsers = useMemo(() => {
    return Object.values(db.users)
      .filter((u) => !u.banned)
      .sort((a, b) => b.lifetimeEarned - a.lifetimeEarned)
      .slice(0, 10);
  }, [db.users]);

  const [first, second, third] = sortedUsers;
  const remaining = sortedUsers.slice(3);

  return (
    <main className="pb-3">
      {/* Header */}
      <header className="flex items-center gap-2.5 border-b border-black/5 bg-cream px-3 py-2.5">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className="text-[15px] font-extrabold text-ink">Rank List</h1>
      </header>

      {/* Podium for 2nd, 1st, 3rd */}
      <section className="mx-3 mt-3 rounded-3xl bg-brand-50/70 px-2 pb-2 pt-5 border border-brand-100">
        <div className="flex items-end justify-center gap-1.5">
          <PodiumColumn place={2} user={second} />
          <PodiumColumn place={1} user={first} />
          <PodiumColumn place={3} user={third} />
        </div>
      </section>

      {/* Leaderboard Title */}
      <div className="mt-4 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1.5 rounded-full bg-brand-500" />
          <h2 className="text-[15px] font-extrabold text-ink">Top Earners</h2>
        </div>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-extrabold text-brand-600">
          {Object.keys(db.users).length} TOTAL
        </span>
      </div>

      {/* Ranks 4-10 List */}
      <ul className="mt-2 space-y-2 px-3">
        {remaining.length === 0 && (
          <li className="rounded-2xl bg-white px-3 py-5 text-center text-[11px] text-gray-400 shadow-card">
            No additional ranked users yet.
          </li>
        )}
        {remaining.map((user, idx) => {
          const rank = idx + 4;
          const isMe = user.telegramId === currentUser?.telegramId;

          return (
            <li
              key={user.telegramId}
              className={`flex items-center gap-2.5 rounded-2xl bg-white p-2 shadow-card transition-all ${
                isMe ? "ring-1 ring-brand-300 bg-brand-50/20" : ""
              }`}
            >
              <div className="flex h-9 w-9 flex-col items-center justify-center rounded-xl bg-cream">
                <span className="text-[13px] font-extrabold text-ink">{rank}</span>
                <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
              </div>
              <Avatar src={user.photoUrl} name={user.firstName} size={34} ring="ring-brand-200" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-ink">
                  UID: {maskUid(user.telegramId)}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="rounded-full bg-brand-50 px-1.5 py-[1px] text-[9px] font-bold text-brand-600">
                    #{rank}
                  </span>
                  <span className="flex items-center gap-0.5 rounded-full bg-orange-50 px-1.5 py-[1px] text-[9px] font-bold text-orange-500">
                    <Flame className="h-2.5 w-2.5" /> HOT
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-brand-500 px-2.5 py-1.5 text-[12px] font-extrabold text-white">
                ${user.lifetimeEarned.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function PodiumColumn({ place, user }: { place: 1 | 2 | 3; user?: User }) {
  const config = {
    1: {
      h: "h-[74px]",
      bar: "bg-brand-400",
      crown: "text-yellow-400",
      ring: "ring-yellow-400",
      pill: "bg-brand-500 text-white",
      label: "1ST",
      size: 64,
      badge: "bg-yellow-400 text-white"
    },
    2: {
      h: "h-[54px]",
      bar: "bg-blue-500",
      crown: "text-blue-500",
      ring: "ring-blue-300",
      pill: "bg-blue-50 text-blue-600",
      label: "2ND",
      size: 50,
      badge: "bg-blue-500 text-white"
    },
    3: {
      h: "h-[44px]",
      bar: "bg-orange-600",
      crown: "text-orange-500",
      ring: "ring-orange-200",
      pill: "bg-orange-50 text-orange-600",
      label: "3RD",
      size: 46,
      badge: "bg-orange-500 text-white"
    }
  }[place];

  return (
    <div className="flex flex-1 flex-col items-center">
      <Crown className={`h-5 w-5 ${config.crown}`} fill="currentColor" />
      <div className="relative mt-0.5">
        <Avatar src={user?.photoUrl} name={user?.firstName || " "} size={config.size} ring={config.ring} />
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold ${config.badge}`}
        >
          {place}
        </span>
      </div>
      <p className="mt-1.5 text-center text-[10.5px] font-semibold text-gray-600">
        {user ? `UID: ${maskUid(user.telegramId)}` : "Empty"}
      </p>
      <span className={`mt-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${config.pill}`}>
        ${(user?.lifetimeEarned ?? 0).toFixed(2)}
      </span>
      <div
        className={`mt-1.5 flex w-full ${config.h} items-start justify-center rounded-t-xl ${config.bar} pt-2 text-[12px] font-extrabold tracking-wide text-white shadow-sm`}
      >
        {config.label}
      </div>
    </div>
  );
}
