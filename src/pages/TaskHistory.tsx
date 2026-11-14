import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  ExternalLink,
  History as HistoryIcon
} from 'lucide-react';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { formatDate } from '../lib/format';

type HistoryFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function TaskHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const db = useAppStore();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const liveUser = (user?.telegramId && db.users[user.telegramId]) ? db.users[user.telegramId] : user;

  const mySubmissions = useMemo(() => {
    if (!liveUser) return [];
    const list = Array.isArray(db.taskSubmissions) ? db.taskSubmissions : [];
    return list
      .filter((s) => s.telegramId === liveUser.telegramId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [db.taskSubmissions, liveUser]);

  const filtered = useMemo(() => {
    if (filter === 'all') return mySubmissions;
    return mySubmissions.filter((s) => s.status === filter);
  }, [mySubmissions, filter]);

  const counts = useMemo(() => {
    return {
      all: mySubmissions.length,
      pending: mySubmissions.filter((s) => s.status === 'pending').length,
      approved: mySubmissions.filter((s) => s.status === 'approved').length,
      rejected: mySubmissions.filter((s) => s.status === 'rejected').length
    };
  }, [mySubmissions]);

  return (
    <main className="px-3 pt-3 pb-10 space-y-3.5">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/tasks')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600 shadow-card transition active:scale-95 cursor-pointer"
            aria-label="Back to Tasks"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="truncate text-[17px] font-extrabold text-ink tracking-tight">
            Task History
          </h1>
        </div>
      </header>

      {/* Filter Segmented Control */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-white p-1 shadow-card border border-black/5">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((key) => {
          const active = filter === key;
          const label =
            key === 'all'
              ? `All (${counts.all})`
              : key === 'pending'
              ? `Pending (${counts.pending})`
              : key === 'approved'
              ? `Paid (${counts.approved})`
              : `Rejected (${counts.rejected})`;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`min-h-[36px] rounded-lg px-1.5 text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-ink hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Submissions List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-7 text-center shadow-card">
          <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <HistoryIcon className="h-6 w-6" />
          </div>
          <p className="text-[14px] font-extrabold text-ink">কোনো টাস্ক হিস্টোরি নেই</p>
          <p className="mt-1 text-[12px] text-slate-500">
            টাস্ক সম্পন্ন করে স্ক্রিনশট সাবমিট করলে এখানে স্ট্যাটাস দেখতে পাবেন।
          </p>
          <Link
            to="/tasks"
            className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-xl bg-indigo-600 px-5 py-2 text-[12.5px] font-bold text-white shadow-sm hover:bg-indigo-700"
          >
            টাস্ক দেখুন
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <article
              key={sub.id}
              className="rounded-2xl bg-white p-3.5 shadow-card space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[14px] font-extrabold text-ink leading-snug">
                    {sub.taskTitle}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span>{formatDate(sub.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-extrabold text-indigo-600 tabular-nums">
                      ${Number(sub.reward || 0).toFixed(2)}
                    </span>
                  </p>
                </div>

                {/* Status Indicator (Color + Icon + Explicit Label) */}
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${
                    sub.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700'
                      : sub.status === 'rejected'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {sub.status === 'approved' ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                    </>
                  ) : sub.status === 'rejected' ? (
                    <>
                      <XCircle className="h-3.5 w-3.5" /> Rejected
                    </>
                  ) : (
                    <>
                      <Clock className="h-3.5 w-3.5" /> Pending
                    </>
                  )}
                </span>
              </div>

              {sub.note && (
                <p className="text-[11.5px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">
                  নোট: {sub.note}
                </p>
              )}

              {sub.status === 'rejected' && sub.rejectReason && (
                <p className="text-[11.5px] text-rose-700 bg-rose-50 rounded-lg px-2.5 py-1.5 font-medium">
                  বাতিলের কারণ: {sub.rejectReason}
                </p>
              )}

              {/* Screenshots Row */}
              {Array.isArray(sub.screenshots) && sub.screenshots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sub.screenshots.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setZoomImage(src)}
                      className="h-16 w-16 overflow-hidden rounded-xl border border-black/10 bg-slate-50 cursor-pointer"
                    >
                      <img
                        src={src}
                        alt={`Proof ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {sub.status === 'rejected' && (
                <Link
                  to={`/tasks/${sub.taskId}`}
                  className="inline-flex items-center gap-1 text-[12px] font-bold text-indigo-600 hover:underline pt-0.5"
                >
                  <span>আবার সাবমিট করুন</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Fullscreen Screenshot Preview Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomImage(null)}
        >
          <button
            type="button"
            onClick={() => setZoomImage(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-lg"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={zoomImage}
            alt="Proof screenshot"
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}
