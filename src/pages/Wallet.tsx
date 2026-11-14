import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Wallet as WalletIcon,
  History,
  TrendingUp,
  Users,
  Clock,
  Headphones,
  MessageSquare
} from 'lucide-react';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { openTelegramChat } from '../lib/telegram';

export function Wallet() {
  const { user, config } = useAuth();
  const db = useAppStore();
  const navigate = useNavigate();

  const liveUser = (user?.telegramId && db.users[user.telegramId]) ? db.users[user.telegramId] : user;

  if (!liveUser) return null;

  const referralsNeeded = Math.max(0, config.minReferralsForWithdraw - liveUser.referralCount);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayActionsCount = db.logs.filter(
    (log) => log.telegramId === liveUser.telegramId && log.createdAt.slice(0, 10) === todayStr
  ).length;

  return (
    <main className="min-h-screen bg-gray-50 px-3 pt-3 pb-8">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-card active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-ink" />
          </button>
          <h1 className="text-[15px] font-extrabold text-ink">Wallet</h1>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink shadow-card">
          USDT <ChevronDown className="h-3 w-3 text-gray-400" />
        </span>
      </header>

      {/* Total Earnings Card */}
      <section className="relative overflow-hidden rounded-2xl border border-orange-200/60 bg-gradient-to-br from-[#fff3eb] via-[#fffaf6] to-[#ffedf1] p-4 text-center shadow-card">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-200/35 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-rose-200/30 blur-2xl"
        />

        <div className="relative">
          <p className="text-[12px] font-semibold text-gray-500">Total Balance</p>
          <p className="mt-0.5 text-[32px] font-extrabold leading-tight text-ink tabular-nums">
            ${liveUser.balance.toFixed(2)}
          </p>
          <p className="text-[11px] font-semibold text-orange-600/80 tabular-nums">
            Lifetime Earnings: ${liveUser.lifetimeEarned.toFixed(2)}
          </p>

          <div className="mt-3.5 flex gap-2">
            <button
              onClick={() => navigate("/wallet/cashout")}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-[13px] font-bold text-white shadow-md shadow-orange-500/20 active:scale-98 transition hover:opacity-95 cursor-pointer"
            >
              <WalletIcon className="h-4 w-4" /> Cash Out
            </button>
            <button
              onClick={() => navigate("/wallet/payments")}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-black/5 bg-white text-[13px] font-bold text-ink shadow-xs transition hover:bg-gray-50 active:scale-98 cursor-pointer"
            >
              <History className="h-4 w-4 text-orange-500" /> Payments
            </button>
          </div>
        </div>
      </section>

      {/* 2 Stats Cards */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-white p-3 shadow-card">
          <div className="flex items-start justify-between">
            <p className="text-[12px] font-medium text-gray-500">Today's earnings</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
              <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
            </span>
          </div>
          <p className="mt-1 text-[22px] font-extrabold text-ink">
            ${liveUser.todayEarned.toFixed(2)}
          </p>
          <p className="text-[10px] text-gray-400">
            {todayActionsCount} earning actions
          </p>
        </div>

        <div className="rounded-2xl bg-white p-3 shadow-card">
          <div className="flex items-start justify-between">
            <p className="text-[12px] font-medium text-gray-500">Total Referrals</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
              <Users className="h-3.5 w-3.5 text-rose-500" />
            </span>
          </div>
          <p className="mt-1 text-[22px] font-extrabold text-ink">
            {liveUser.referralCount}
          </p>
          <p className="text-[10px] text-gray-400">
            {referralsNeeded > 0 ? `${referralsNeeded} more needed` : "Withdraw unlocked!"}
          </p>
        </div>
      </div>

      {/* Support Section */}
      <h2 className="mt-4 text-[15px] font-extrabold text-ink">Support</h2>
      <section className="mt-2 rounded-2xl bg-white p-3 shadow-card">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-orange-500 shadow-sm">
            <Headphones className="h-5 w-5 text-white" />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-ink">Chat with Support</p>
            <p className="text-[11px] text-gray-400">Withdrawals • Balance • Account help</p>
          </div>
          <span className="rounded-full border border-emerald-200 px-2 py-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50">
            ● Online
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button
            onClick={() => openTelegramChat(config.supportUrl)}
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-gray-100 text-[12px] font-semibold text-ink active:scale-95 transition"
          >
            <MessageSquare className="h-3.5 w-3.5 text-brand-500" /> Live Agent
          </button>
          <button
            onClick={() => openTelegramChat(config.supportUrl)}
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-gray-100 text-[12px] font-semibold text-ink active:scale-95 transition"
          >
            <Clock className="h-3.5 w-3.5 text-orange-500" /> Quick Replies
          </button>
        </div>

        <button
          onClick={() => openTelegramChat(config.supportUrl)}
          className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-[13px] font-bold text-white shadow-md active:scale-98 transition"
        >
          <MessageSquare className="h-4 w-4" /> Telegram Support Group
        </button>
      </section>
    </main>
  );
}
