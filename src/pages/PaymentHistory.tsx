import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Headphones,
  ChevronDown,
  Clock,
  CheckCircle2,
  XCircle,
  ReceiptText,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { formatTimestamp } from '../lib/format';
import { openTelegramChat } from '../lib/telegram';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type TimeFilter = 'all' | 'today' | '7d' | '30d';

export function PaymentHistory() {
  const { user, config } = useAuth();
  const db = useAppStore();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const liveUser = (user?.telegramId && db.users[user.telegramId]) ? db.users[user.telegramId] : user;

  const myWithdrawals = useMemo(() => {
    if (!liveUser) return [];
    return db.withdrawals
      .filter((w) => w.telegramId === liveUser.telegramId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [db.withdrawals, liveUser]);

  const filteredWithdrawals = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    return myWithdrawals.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      if (timeFilter !== 'all') {
        const createdMs = new Date(item.createdAt).getTime();
        if (isNaN(createdMs)) return false;

        if (timeFilter === 'today' && createdMs < todayMs) return false;
        if (timeFilter === '7d' && now - createdMs > 7 * 24 * 60 * 60 * 1000) return false;
        if (timeFilter === '30d' && now - createdMs > 30 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    });
  }, [myWithdrawals, statusFilter, timeFilter]);

  if (!liveUser) return null;

  const hasActiveFilters = statusFilter !== 'all' || timeFilter !== 'all';

  const handleCopyId = (id: string) => {
    try {
      navigator.clipboard.writeText(id);
      toast.success('Record ID copied');
    } catch {
      // Clipboard may be restricted in some webviews
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      {/* Top App Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-black/5 bg-white/95 px-2.5 py-1.5 backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate('/wallet')}
          aria-label="Back to Wallet"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-ink transition hover:bg-slate-100 active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <h1 className="truncate text-[16px] font-extrabold tracking-tight text-ink">
          Payment History
        </h1>

        <button
          type="button"
          onClick={() => openTelegramChat(config.supportUrl)}
          aria-label="Contact Support"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-ink transition hover:bg-slate-100 active:scale-95 cursor-pointer"
        >
          <Headphones className="h-5 w-5" />
        </button>
      </header>

      {/* Filter Selectors Bar */}
      <section className="grid grid-cols-2 gap-2.5 bg-white px-3.5 py-3 border-b border-slate-100">
        <div className="relative">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200/80 bg-slate-50 pl-3 pr-8 text-[12.5px] font-semibold text-ink outline-none transition focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/20 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Cash Out Successful</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="relative">
          <select
            aria-label="Filter by time"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
            className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200/80 bg-slate-50 pl-3 pr-8 text-[12.5px] font-semibold text-ink outline-none transition focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/20 cursor-pointer"
          >
            <option value="all">Filter by Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </section>

      {/* Records List */}
      {filteredWithdrawals.length === 0 ? (
        <div className="mx-3.5 mt-4 rounded-2xl bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ReceiptText className="h-6 w-6" />
          </div>
          <p className="text-[14.5px] font-extrabold text-ink">
            {hasActiveFilters ? 'No matching records found' : 'No payment history yet'}
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            {hasActiveFilters
              ? 'Try changing your status or time filter to view other withdrawals.'
              : 'Your cash out requests and payout records will appear here.'}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setTimeFilter('all');
              }}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-5 py-2 text-[12.5px] font-bold text-white transition hover:bg-slate-800 active:scale-98 cursor-pointer"
            >
              Reset Filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/wallet/cashout')}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 px-5 py-2 text-[12.5px] font-bold text-white shadow-sm transition hover:opacity-95 active:scale-98 cursor-pointer"
            >
              Cash Out Now
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-200/70">
          {filteredWithdrawals.map((item) => {
            const fee = Number(item.fee ?? 0);
            const netAmount = Math.max(0, Number(item.amount) - fee);
            const isBdtMethod =
              item.method.toLowerCase().includes('bkash') ||
              item.method.toLowerCase().includes('nagad');

            return (
              <article key={item.id} className="bg-white px-4 py-4">
                {/* Record ID & Status Header Row */}
                <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleCopyId(item.id)}
                    title="Copy transaction ID"
                    className="inline-flex min-w-0 items-center gap-1.5 text-left font-mono text-[13.5px] font-bold text-ink tabular-nums hover:text-brand-600 cursor-pointer"
                  >
                    <span className="truncate">{item.id}</span>
                    <Copy className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </button>

                  {item.status === 'approved' ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-emerald-600 whitespace-nowrap">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Cash Out Successful</span>
                    </span>
                  ) : item.status === 'rejected' ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-rose-600 whitespace-nowrap">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Rejected</span>
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-amber-500 whitespace-nowrap">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>Pending Review</span>
                    </span>
                  )}
                </div>

                {/* Key-Value Breakdown Rows */}
                <dl className="mt-2.5 space-y-2 text-[12.5px]">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-400 font-medium">Amount</dt>
                    <dd className="font-bold text-ink tabular-nums">
                      ${Number(item.amount).toFixed(2)}
                      {isBdtMethod && (
                        <span className="ml-1 text-[11.5px] font-semibold text-slate-500">
                          (৳{Math.round(Number(item.amount) * 120)})
                        </span>
                      )}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-400 font-medium">Handling Fee</dt>
                    <dd className="font-semibold text-ink tabular-nums">
                      ${fee.toFixed(2)}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-400 font-medium">Net Credited</dt>
                    <dd className="font-bold text-ink tabular-nums">
                      ${netAmount.toFixed(2)}
                      {isBdtMethod && (
                        <span className="ml-1 text-[11.5px] font-semibold text-slate-500">
                          (৳{Math.round(netAmount * 120)})
                        </span>
                      )}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-400 font-medium">Payment Account</dt>
                    <dd className="truncate font-semibold text-ink font-mono text-[12px]">
                      {item.method} · {item.account}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-400 font-medium">Applied Time</dt>
                    <dd className="font-medium text-ink tabular-nums">
                      {formatTimestamp(item.createdAt)}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-400 font-medium">Updated Time</dt>
                    <dd className="font-medium text-ink tabular-nums">
                      {formatTimestamp(item.updatedAt || item.createdAt)}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
