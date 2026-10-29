import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Flame, TrendingUp } from 'lucide-react';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import { maskUid } from '../lib/format';
import { subscribeAllUsers } from '../lib/firebase';
import type { User } from '../types';

// Format USD/USDT currency with dollar symbol ($)
function formatDollar(amount: number): string {
  const num = Number(amount) || 0;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CrownIcon({ color, className = "w-7 h-7" }: { color: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 17C4 17.5523 4.44772 18 5 18H19C19.5523 18 20 17.5523 20 17L18.5 7.5L14.5 12L12 4.5L9.5 12L5.5 7.5L4 17Z" />
      <circle cx="5.5" cy="7.5" r="1.5" />
      <circle cx="12" cy="4.5" r="1.5" />
      <circle cx="18.5" cy="7.5" r="1.5" />
    </svg>
  );
}

export function RankList() {
  const db = useAppStore();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  // Real-time synchronization with Firebase RTDB users
  const [remoteUsers, setRemoteUsers] = useState<Record<string, User>>({});

  useEffect(() => {
    const unsub = subscribeAllUsers((users) => {
      if (users && typeof users === 'object') {
        setRemoteUsers(users);
      }
    });
    return () => unsub();
  }, []);

  // Filter 100% genuine real users: strictly exclude demo users, fake IDs, or test accounts
  // Sort strictly by highest total income (Math.max(lifetimeEarned, balance)) descending
  // Maximum 10 users displayed
  const top10Users = useMemo(() => {
    const merged: Record<string, User> = { ...db.users, ...remoteUsers };
    const fakeIds = new Set([
      "984210452", "742189301", "610928374", "528401923", "419401859", "724910385", "0"
    ]);

    const isDemoUser = (u: User) => {
      if (!u || !u.telegramId) return true;
      const tid = String(u.telegramId).trim();
      if (fakeIds.has(tid) || tid === "724910385" || tid === "0") return true;
      if (tid.startsWith("demo") || tid.startsWith("seed_") || tid.startsWith("test_")) return true;
      if (u.username === "demo_user" || u.username === "tg_user") return true;
      const fn = (u.firstName || "").toLowerCase();
      const ln = (u.lastName || "").toLowerCase();
      if (fn.includes("demo") || ln.includes("demo")) return true;
      if (!/^-?\d+$/.test(tid)) return true;
      return false;
    };

    const list = Object.values(merged)
      .filter((u): u is User => Boolean(u && u.telegramId && !u.banned && !isDemoUser(u)))
      .sort((a, b) => {
        const earnA = Math.max(Number(a.lifetimeEarned || 0), Number(a.balance || 0));
        const earnB = Math.max(Number(b.lifetimeEarned || 0), Number(b.balance || 0));
        if (earnB !== earnA) {
          return earnB - earnA;
        }
        return (Number(b.referralCount) || 0) - (Number(a.referralCount) || 0);
      });

    return list.slice(0, 10);
  }, [db.users, remoteUsers]);

  const first = top10Users[0];
  const second = top10Users[1];
  const third = top10Users[2];
  const remaining = top10Users.slice(3);

  return (
    <main className="min-h-screen bg-[#fafbfc] pb-24 text-gray-800">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3.5 bg-white/95 px-4 py-3.5 backdrop-blur-sm border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50/70 text-gray-700 active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[17px] font-bold text-gray-900 tracking-tight">Rank List</h1>
      </header>

      {/* Podium Card for Top 3 */}
      <section className="mx-3.5 mt-3.5 rounded-[1.75rem] bg-white p-4 pb-0 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100">
        <div className="flex items-end justify-center gap-2">
          {/* 2nd Place (Left) */}
          <div className="flex flex-1 flex-col items-center">
            <CrownIcon color="#3b82f6" className="w-6 h-6 -mb-1 animate-pulse" />
            <div className="relative mt-1">
              {second ? (
                <Avatar src={second.photoUrl} name={second.firstName} size={54} ring="ring-4 ring-blue-200" />
              ) : (
                <div className="h-[54px] w-[54px] rounded-full border-2 border-dashed border-blue-200 bg-blue-50/50 flex items-center justify-center text-[10px] text-blue-300 font-bold">
                  #2
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#3b82f6] text-[10.5px] font-black text-white shadow ring-2 ring-white">
                2
              </span>
            </div>
            <p className="mt-2 text-center text-[11px] font-bold text-gray-800 truncate max-w-[85px]">
              {second ? `UID: ${maskUid(second.telegramId)}` : 'অপেক্ষমান'}
            </p>
            <span className="mt-1.5 rounded-full bg-[#e2efff] px-2.5 py-1 text-[11px] font-bold text-[#2563eb]">
              {second ? formatDollar(Math.max(Number(second.lifetimeEarned || 0), Number(second.balance || 0))) : '$0.00'}
            </span>
            <div className="mt-2.5 flex h-14 w-full items-center justify-center rounded-t-2xl bg-[#3b82f6] text-xs font-black tracking-wider text-white shadow-sm">
              2ND
            </div>
          </div>

          {/* 1st Place (Center) */}
          <div className="flex flex-1 flex-col items-center">
            <CrownIcon color="#eab308" className="w-8 h-8 -mb-1 drop-shadow-sm animate-bounce" />
            <div className="relative mt-0.5">
              {first ? (
                <Avatar src={first.photoUrl} name={first.firstName} size={68} ring="ring-4 ring-amber-400" />
              ) : (
                <div className="h-[68px] w-[68px] rounded-full border-2 border-dashed border-amber-300 bg-amber-50/50 flex items-center justify-center text-[10px] text-amber-400 font-bold">
                  #1
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-white shadow ring-2 ring-white">
                1
              </span>
            </div>
            <p className="mt-2 text-center text-xs font-bold text-gray-900 truncate max-w-[95px]">
              {first ? `UID: ${maskUid(first.telegramId)}` : 'অপেক্ষমান'}
            </p>
            <span className="mt-1.5 rounded-full bg-[#c68338] px-3.5 py-1 text-xs font-bold text-white shadow-sm">
              {first ? formatDollar(Math.max(Number(first.lifetimeEarned || 0), Number(first.balance || 0))) : '$0.00'}
            </span>
            <div className="mt-2.5 flex h-20 w-full items-center justify-center rounded-t-2xl bg-[#dfa25b] text-sm font-black tracking-wider text-white shadow-sm">
              1ST
            </div>
          </div>

          {/* 3rd Place (Right) */}
          <div className="flex flex-1 flex-col items-center">
            <CrownIcon color="#cb6525" className="w-6 h-6 -mb-1 animate-pulse" />
            <div className="relative mt-1">
              {third ? (
                <Avatar src={third.photoUrl} name={third.firstName} size={50} ring="ring-4 ring-orange-200" />
              ) : (
                <div className="h-[50px] w-[50px] rounded-full border-2 border-dashed border-orange-200 bg-orange-50/50 flex items-center justify-center text-[10px] text-orange-300 font-bold">
                  #3
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#cb6525] text-[10.5px] font-black text-white shadow ring-2 ring-white">
                3
              </span>
            </div>
            <p className="mt-2 text-center text-[11px] font-bold text-gray-800 truncate max-w-[85px]">
              {third ? `UID: ${maskUid(third.telegramId)}` : 'অপেক্ষমান'}
            </p>
            <span className="mt-1.5 rounded-full bg-[#faebe0] px-2.5 py-1 text-[11px] font-bold text-[#c26123]">
              {third ? formatDollar(Math.max(Number(third.lifetimeEarned || 0), Number(third.balance || 0))) : '$0.00'}
            </span>
            <div className="mt-2.5 flex h-11 w-full items-center justify-center rounded-t-2xl bg-[#cb6525] text-xs font-black tracking-wider text-white shadow-sm">
              3RD
            </div>
          </div>
        </div>
      </section>

      {/* Section Header */}
      <div className="mt-6 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-1.5 rounded-full bg-[#cb6525]" />
          <h2 className="text-[16px] font-bold text-gray-800">Top Earners</h2>
        </div>
        <span className="rounded-full bg-[#fdf5eb] px-3 py-1 text-xs font-bold text-[#cb6525] border border-orange-100">
          {top10Users.length} TOTAL
        </span>
      </div>

      {/* Ranks 4 to 10 List */}
      <ul className="mt-3 space-y-2.5 px-4">
        {remaining.length === 0 && (
          <li className="rounded-2xl bg-white px-4 py-8 text-center text-xs text-gray-400 shadow-sm border border-gray-100">
            {top10Users.length === 0 ? "লোড হচ্ছে..." : "শীর্ষ ৩ জনের বাইরে অতিরিক্ত তথ্য নেই"}
          </li>
        )}
        {remaining.map((user, idx) => {
          const rank = idx + 4;
          const userMoney = Math.max(Number(user.lifetimeEarned || 0), Number(user.balance || 0));
          const initial = (user.firstName || user.username || 'U').charAt(0).toUpperCase();
          const isMe = user.telegramId === currentUser?.telegramId;

          return (
            <li
              key={user.telegramId}
              className={`flex items-center justify-between rounded-2xl bg-white p-3 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] border transition-all ${
                isMe ? "border-amber-300 ring-1 ring-amber-300 bg-amber-50/20" : "border-gray-100"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Rank Circle with Green Trend Arrow */}
                <div className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-gray-50/90 border border-gray-100">
                  <span className="text-[13px] font-bold text-gray-800 leading-tight">{rank}</span>
                  <TrendingUp className="h-3 w-3 text-emerald-500 stroke-[2.5]" />
                </div>

                {/* Avatar with initial badge */}
                <div className="relative flex-shrink-0">
                  <Avatar src={user.photoUrl} name={user.firstName} size={42} ring="ring-1 ring-gray-200" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#cb6525] text-white text-[9px] font-bold ring-2 ring-white">
                    {initial}
                  </span>
                </div>

                {/* Masked UID and Tags */}
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-gray-800">
                    UID: {maskUid(user.telegramId)}
                    {isMe && <span className="ml-1 text-[10px] text-amber-600 font-extrabold">(আপনি)</span>}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-[#cb6525]">
                      #{rank}
                    </span>
                    <span className="flex items-center gap-0.5 rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-[#cb6525]">
                      <Flame className="h-2.5 w-2.5 fill-[#cb6525] text-[#cb6525]" /> HOT
                    </span>
                  </div>
                </div>
              </div>

              {/* Amount pill in Dollar ($) */}
              <div className="flex-shrink-0 pl-2">
                <span className="rounded-full bg-[#c68338] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm inline-block">
                  {formatDollar(userMoney)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
