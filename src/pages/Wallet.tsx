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
import { formatDate } from '../lib/format';
import { openTelegramChat } from '../lib/telegram';

export function Wallet() {
  const { user, config } = useAuth();
  const db = useAppStore();
  const navigate = useNavigate();

  if (!user) return null;

  const myWithdrawals = db.withdrawals.filter((w) => w.telegramId === user.telegramId);
  const referralsNeeded = Math.max(0, config.minReferralsForWithdraw - user.referralCount);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayActionsCount = db.logs.filter(
    (log) => log.telegramId === user.telegramId && log.createdAt.slice(0, 10) === todayStr
  ).length;

  return (
    <main className="min-h-screen bg-gray-50 px-3 pt-3 pb-8">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-card active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-ink" />
        </button>
        <h1 className="text-[15px] font-extrabold text-ink">Wallet</h1>
        <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink shadow-card">
          USDT <ChevronDown className="h-3 w-3 text-gray-400" />
        </span>
      </header>

      {/* Total Earnings Card */}
      <section className="rounded-2xl bg-white p-4 text-center shadow-card">
        <p className="text-[12px] font-medium text-gray-400">Total Balance</p>
        <p className="mt-0.5 text-[32px] font-extrabold leading-tight text-ink">
          ${user.balance.toFixed(3)}
        </p>
        <p className="text-[11px] text-gray-400 font-medium">
          Lifetime Earnings: ${user.lifetimeEarned.toFixed(3)}
        </p>

        <div className="mt-3.5 flex gap-2">
          <button
            onClick={() => navigate("/wallet/cashout")}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-[13px] font-bold text-white shadow-md active:scale-98 transition hover:opacity-95"
          >
            <WalletIcon className="h-4 w-4" /> Cash Out
          </button>
          <button
            onClick={() => {
              document.getElementById("payments")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-gray-100 text-[13px] font-bold text-ink transition active:scale-98"
          >
            <History className="h-4 w-4 text-gray-500" /> Payments
          </button>
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
            ${user.todayEarned.toFixed(3)}
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
            {user.referralCount}
          </p>
          <p className="text-[10px] text-gray-400">
            {referralsNeeded > 0 ? `${referralsNeeded} more needed` : "Withdraw unlocked!"}
          </p>
        </div>
      </div>

      {/* Minimum Requirements Notice */}
      <div className="mt-2.5 rounded-2xl border border-rose-200 bg-rose-50/70 p-3">
        <p className="text-[12px] font-extrabold text-rose-600">
          ⚠️ নূন্যতম {config.minReferralsForWithdraw} জন রেফার ছাড়া টাকা তোলা যাবে না
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-700">
          উইথড্র করতে সর্বনিম্ন <b>${config.minWithdraw.toFixed(2)} USDT</b> ব্যালেন্স এবং{" "}
          <b>{config.minReferralsForWithdraw} জন</b> সক্রিয় রেফারেল সম্পূর্ণ করতে হবে।
        </p>
      </div>

      {/* Payments History */}
      <h2 id="payments" className="mt-4 text-[15px] font-extrabold text-ink">
        Payments
      </h2>

      <ul className="mt-2 space-y-2">
        {myWithdrawals.length === 0 && (
          <li className="rounded-2xl bg-white px-3 py-4 text-center text-[11px] text-gray-400 shadow-card">
            এখনও কোনো উইথড্রয়াল রেকর্ড নেই।
          </li>
        )}
        {myWithdrawals.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-card"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <Clock className="h-4 w-4 text-gray-500" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-ink">
                ${item.amount.toFixed(2)} • {item.method}
              </p>
              <p className="truncate text-[10px] text-gray-400 font-mono">
                {item.account} • {formatDate(item.createdAt)}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-bold capitalize ${
                item.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-600'
                  : item.status === 'rejected'
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              {item.status}
            </span>
          </li>
        ))}
      </ul>

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
