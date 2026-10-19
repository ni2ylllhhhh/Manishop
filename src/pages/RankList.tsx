import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Crown, Flame, TrendingUp, Sparkles, UserCheck } from 'lucide-react';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import { maskUid } from '../lib/format';
import { subscribeAllUsers } from '../lib/firebase';
import type { User } from '../types';

export function RankList() {
  const db = useAppStore();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  // Real-time synchronization with 100% genuine Firebase RTDB users
  const [remoteUsers, setRemoteUsers] = useState<Record<string, User>>({});

  useEffect(() => {
    const unsub = subscribeAllUsers((users) => {
      if (users && typeof users === 'object') {
        setRemoteUsers(users);
      }
    });
    return () => unsub();
  }, []);

  // Filter 100% original users and sort strictly from highest earner to lowest
  const sortedUsers = useMemo(() => {
    const merged: Record<string, User> = { ...db.users, ...remoteUsers };
    const fakeIds = new Set(["984210452", "742189301", "610928374", "528401923", "419401859", "724910385"]);

    const list = Object.values(merged)
      .filter((u): u is User => Boolean(u && u.telegramId && !u.banned && !fakeIds.has(String(u.telegramId)) && String(u.telegramId) !== "724910385" && u.username !== "demo_user"))
      .sort((a, b) => {
        const earnA = Math.max(Number(a.lifetimeEarned || 0), Number(a.balance || 0));
        const earnB = Math.max(Number(b.lifetimeEarned || 0), Number(b.balance || 0));
        if (earnB !== earnA) {
          return earnB - earnA;
        }
        return (Number(b.referralCount) || 0) - (Number(a.referralCount) || 0);
      });

    return list;
  }, [db.users, remoteUsers]);

  const [first, second, third] = sortedUsers;
  const remaining = sortedUsers.slice(3);

  // Current user rank calculation
  const myIndex = currentUser ? sortedUsers.findIndex((u) => u.telegramId === currentUser.telegramId) : -1;
  const myRank = myIndex !== -1 ? myIndex + 1 : null;
  const myEarned = currentUser ? Math.max(Number(currentUser.lifetimeEarned || 0), Number(currentUser.balance || 0)) : 0;

  return (
    <main className="pb-24">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-black/5 bg-cream px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-[15px] font-extrabold text-ink leading-tight">লিডারবোর্ড (Rank List)</h1>
            <p className="text-[10px] text-gray-400 font-medium">রিয়েল ইউজারদের সর্বোচ্চ আয়ের তালিকা</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          লাইভ
        </span>
      </header>

      {/* Podium for 2nd, 1st, 3rd */}
      <section className="mx-3 mt-3 rounded-3xl bg-brand-50/70 px-2 pb-2 pt-5 border border-brand-100 shadow-sm">
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
          <h2 className="text-[14px] font-extrabold text-ink">শীর্ষ আয়ের তালিকা (Top Earners)</h2>
        </div>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-extrabold text-brand-600 border border-brand-200">
          {sortedUsers.length} জন মোট
        </span>
      </div>

      {/* Ranks 4+ List */}
      <ul className="mt-2 space-y-2 px-3">
        {remaining.length === 0 && (
          <li className="rounded-2xl bg-white px-3 py-5 text-center text-[11px] text-gray-400 shadow-card">
            {sortedUsers.length === 0 ? "ইউজার ডেটা লোড হচ্ছে..." : "শীর্ষ ৩ জনের বাইরে অতিরিক্ত ইউজার নেই।"}
          </li>
        )}
        {remaining.map((user, idx) => {
          const rank = idx + 4;
          const isMe = user.telegramId === currentUser?.telegramId;
          const userMoney = Math.max(Number(user.lifetimeEarned || 0), Number(user.balance || 0));

          return (
            <li
              key={user.telegramId}
              className={`flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-card transition-all ${
                isMe ? "ring-2 ring-brand-400 bg-brand-50/30" : ""
              }`}
            >
              <div className="flex h-9 w-9 flex-col items-center justify-center rounded-xl bg-cream border border-brand-100">
                <span className="text-[13px] font-extrabold text-ink">{rank}</span>
                <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
              </div>
              <Avatar src={user.photoUrl} name={user.firstName} size={36} ring="ring-brand-200" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-ink">
                  {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : `UID: ${maskUid(user.telegramId)}`}
                  {isMe && <span className="ml-1 text-[10px] text-brand-600 font-extrabold">(আপনি)</span>}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9.5px] text-gray-400 font-mono">
                    UID: {maskUid(user.telegramId)}
                  </span>
                  <span className="rounded-full bg-brand-50 px-1.5 py-[1px] text-[9px] font-bold text-brand-600">
                    রেংক #{rank}
                  </span>
                  {user.referralCount > 0 && (
                    <span className="flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-[1px] text-[9px] font-bold text-blue-600">
                      👥 {user.referralCount} রেফারেল
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 rounded-full bg-orange-50 px-1.5 py-[1px] text-[9px] font-bold text-orange-500">
                    <Flame className="h-2.5 w-2.5" /> HOT
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-brand-500 px-2.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm inline-block">
                  ${userMoney.toFixed(2)}
                </span>
                <p className="text-[9px] text-gray-400 mt-0.5 font-medium">USDT</p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Pinned Bottom Banner for Logged In User Position */}
      {currentUser && (
        <aside aria-label="আপনার অবস্থান" className="fixed bottom-16 left-0 right-0 z-20 px-3 pointer-events-none">
          <div className="mx-auto max-w-md pointer-events-auto rounded-2xl border border-brand-300 bg-gradient-to-r from-[#20150d] via-[#160d07] to-[#20150d] p-2.5 text-white shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar src={currentUser.photoUrl} name={currentUser.firstName} size={32} ring="ring-brand-400" />
              <div>
                <p className="text-[11px] font-extrabold flex items-center gap-1 text-white">
                  <UserCheck className="h-3 w-3 text-brand-400" />
                  আপনার অবস্থান: {myRank ? `#${myRank} স্থান` : "তালিকায় নেই"}
                </p>
                <p className="text-[9.5px] text-brand-200">
                  মোট ইনকাম: ${myEarned.toFixed(2)} USDT • রেফারেল: {currentUser.referralCount || 0} জন
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-brand-500 px-3 py-1.5 text-center shadow-md">
              <span className="block text-[8px] font-bold uppercase text-brand-100">ইনকাম</span>
              <span className="block text-[13px] font-black text-white">${myEarned.toFixed(2)}</span>
            </div>
          </div>
        </aside>
      )}
    </main>
  );
}

function PodiumColumn({ place, user }: { place: 1 | 2 | 3; user?: User }) {
  const config = {
    1: {
      h: "h-[84px]",
      bar: "bg-gradient-to-b from-amber-400 to-amber-600",
      crown: "text-amber-400",
      ring: "ring-amber-400",
      pill: "bg-amber-500 text-white shadow-sm",
      label: "১ম স্থান (1ST)",
      size: 64,
      badge: "bg-amber-400 text-slate-900 font-black"
    },
    2: {
      h: "h-[62px]",
      bar: "bg-gradient-to-b from-slate-400 to-slate-600",
      crown: "text-slate-300",
      ring: "ring-slate-300",
      pill: "bg-slate-700 text-white shadow-sm",
      label: "২য় স্থান (2ND)",
      size: 52,
      badge: "bg-slate-300 text-slate-900 font-black"
    },
    3: {
      h: "h-[50px]",
      bar: "bg-gradient-to-b from-amber-700 to-amber-900",
      crown: "text-amber-600",
      ring: "ring-amber-600",
      pill: "bg-amber-800 text-white shadow-sm",
      label: "৩য় স্থান (3RD)",
      size: 48,
      badge: "bg-amber-600 text-white font-black"
    }
  }[place];

  const userMoney = user ? Math.max(Number(user.lifetimeEarned || 0), Number(user.balance || 0)) : 0;

  return (
    <div className="flex flex-1 flex-col items-center">
      <Crown className={`h-6 w-6 ${config.crown} drop-shadow-sm animate-bounce`} fill="currentColor" />
      <div className="relative mt-0.5">
        {user ? (
          <Avatar src={user.photoUrl} name={user.firstName} size={config.size} ring={config.ring} />
        ) : (
          <div
            className="flex items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white/70 text-slate-400"
            style={{ width: config.size, height: config.size }}
          >
            <span className="text-[10px] font-bold">খালি</span>
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] shadow ${config.badge}`}
        >
          {place}
        </span>
      </div>
      <p className="mt-1.5 text-center text-[11px] font-bold text-gray-800 max-w-[85px] truncate">
        {user ? (user.firstName ? `${user.firstName}` : `UID: ${maskUid(user.telegramId)}`) : "অপেক্ষমান"}
      </p>
      {user && (
        <p className="text-[8.5px] text-gray-400 font-mono">
          UID: {maskUid(user.telegramId)}
        </p>
      )}
      <span className={`mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${config.pill}`}>
        ${userMoney.toFixed(2)}
      </span>
      <div
        className={`mt-1.5 flex w-full ${config.h} items-start justify-center rounded-t-xl ${config.bar} pt-2 text-[11px] font-black tracking-tight text-white shadow-sm`}
      >
        {config.label}
      </div>
    </div>
  );
}
