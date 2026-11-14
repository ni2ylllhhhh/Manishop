import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Gift,
  ExternalLink,
  Camera,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  Upload,
  X,
  LoaderCircle,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { submitTaskProof } from '../lib/store';
import { uploadProofImage } from '../lib/uploadImage';
import { openExternalLink, triggerHaptic } from '../lib/telegram';

export function TaskDetails() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user, config } = useAuth();
  const db = useAppStore();

  const liveUser = (user?.telegramId && db.users[user.telegramId]) ? db.users[user.telegramId] : user;

  const taskPost = useMemo(() => {
    const posts = Array.isArray(config.taskPosts) ? config.taskPosts : [];
    return posts.find((p) => p.id === taskId) || null;
  }, [config.taskPosts, taskId]);

  const existingSubmission = useMemo(() => {
    if (!liveUser || !taskPost) return null;
    const subs = Array.isArray(db.taskSubmissions) ? db.taskSubmissions : [];
    return (
      subs.find((s) => s.taskId === taskPost.id && s.telegramId === liveUser.telegramId) || null
    );
  }, [db.taskSubmissions, liveUser, taskPost]);

  const requiredCount = Math.max(1, Math.min(3, Number(taskPost?.requiredScreenshots || 1)));

  const [screenshots, setScreenshots] = useState<(string | null)[]>(() =>
    Array.from({ length: 3 }, () => null)
  );
  const [fileNames, setFileNames] = useState<string[]>(() =>
    Array.from({ length: 3 }, () => '')
  );
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);

  if (!taskPost) {
    return (
      <main className="px-3 pt-4 pb-8">
        <header className="mb-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/tasks')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card text-indigo-600 active:scale-95 transition"
            aria-label="Back to Tasks"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[17px] font-extrabold text-ink">Task Details</h1>
        </header>
        <div className="rounded-2xl bg-white p-6 text-center shadow-card">
          <p className="text-[14px] font-bold text-ink">টাস্কটি খুঁজে পাওয়া যায়নি</p>
          <p className="mt-1 text-[12px] text-gray-500">
            এই টাস্কটি বর্তমানে বন্ধ থাকতে পারে বা মুছে ফেলা হয়েছে।
          </p>
          <button
            onClick={() => navigate('/tasks')}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-indigo-700"
          >
            টাস্ক পেজে ফিরে যান
          </button>
        </div>
      </main>
    );
  }

  const handleFilePick = async (slotIdx: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('অনুগ্রহ করে একটি ছবি/স্ক্রিনশট সিলেক্ট করুন');
      return;
    }

    setUploadingSlot(slotIdx);
    triggerHaptic('light');
    try {
      const uploadedUrl = await uploadProofImage(file, config.imgbbApiKey);
      setScreenshots((prev) => {
        const next = [...prev];
        next[slotIdx] = uploadedUrl;
        return next;
      });
      setFileNames((prev) => {
        const next = [...prev];
        next[slotIdx] = file.name;
        return next;
      });
      toast.success(`স্ক্রিনশট ${slotIdx + 1} আপলোড হয়েছে`);
    } catch {
      toast.error('স্ক্রিনশট আপলোড করতে সমস্যা হয়েছে, আবার চেষ্টা করুন');
    } finally {
      setUploadingSlot(null);
    }
  };

  const removeScreenshot = (slotIdx: number) => {
    setScreenshots((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
    setFileNames((prev) => {
      const next = [...prev];
      next[slotIdx] = '';
      return next;
    });
  };

  const handleOpenTaskLink = () => {
    triggerHaptic('medium');
    openExternalLink(taskPost.taskUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveUser) return;

    const selected = screenshots.slice(0, requiredCount).filter((s): s is string => Boolean(s));
    if (selected.length < requiredCount) {
      toast.error(`অনুগ্রহ করে সবগুলো (${requiredCount}টি) প্রমাণ স্ক্রিনশট আপলোড করুন`);
      return;
    }

    setSubmitting(true);
    triggerHaptic('medium');
    try {
      const res = await submitTaskProof({
        taskId: taskPost.id,
        taskTitle: taskPost.title,
        taskBannerUrl: taskPost.bannerUrl,
        telegramId: liveUser.telegramId,
        userName: `${liveUser.firstName} ${liveUser.lastName}`.trim() || liveUser.username || liveUser.telegramId,
        reward: Number(taskPost.reward) || 0,
        screenshots: selected,
        note
      });

      if (!res.success) {
        if (res.reason === 'already_approved') {
          toast.info('এই টাস্কের রিওয়ার্ড আপনি ইতিমধ্যে পেয়েছেন!');
        } else if (res.reason === 'already_pending') {
          toast.info('এই টাস্কের প্রমাণ ইতিমধ্যে রিভিউয়ের জন্য জমা আছে।');
        } else {
          toast.error('সাবমিট করতে সমস্যা হয়েছে।');
        }
        return;
      }

      triggerHaptic('success');
      toast.success('✅ প্রমাণ সফলভাবে সাবমিট হয়েছে! অ্যাডমিন যাচাই করে ব্যালেন্স যোগ করে দেবেন।', {
        duration: 5000
      });
      setScreenshots(Array.from({ length: 3 }, () => null));
      setFileNames(Array.from({ length: 3 }, () => ''));
      setNote('');
    } catch {
      toast.error('সাবমিট ব্যর্থ হয়েছে, আবার চেষ্টা করুন।');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmitForm =
    !existingSubmission || existingSubmission.status === 'rejected';

  return (
    <main className="px-3 pt-3 pb-10 space-y-3.5">
      {/* Top App Bar matching Screenshot 1 */}
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
            Task Details
          </h1>
        </div>

        <Link
          to="/tasks/history"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-bold text-indigo-600 shadow-card border border-black/5 transition active:scale-95"
        >
          <History className="h-3.5 w-3.5" />
          <span>History</span>
        </Link>
      </header>

      {/* Main Details Card (Banner + Title + Reward + Numbered Instructions) */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-card">
        {/* Top Banner Image */}
        <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
          {!bannerFailed && taskPost.bannerUrl ? (
            <img
              src={taskPost.bannerUrl}
              alt={taskPost.title}
              referrerPolicy="no-referrer"
              onError={() => setBannerFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-indigo-600 to-blue-700 p-4 text-center text-white">
              <ImageIcon className="h-9 w-9 opacity-80 mb-1.5" />
              <p className="text-[14px] font-extrabold line-clamp-2">{taskPost.title}</p>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4">
          <h2 className="text-[17px] font-extrabold leading-snug text-ink">
            {taskPost.title}
          </h2>

          <div className="mt-2.5 flex items-center gap-2 text-indigo-600">
            <Gift className="h-5 w-5 shrink-0 text-indigo-600" />
            <span className="text-[15px] font-extrabold tabular-nums">
              Reward: ${Number(taskPost.reward || 0).toFixed(2)}
            </span>
          </div>

          <hr className="my-3.5 border-slate-100" />

          <p className="text-[13px] font-semibold text-slate-500 mb-3">
            কাজ করার বিবরণ:
          </p>

          <ol className="space-y-3">
            {(Array.isArray(taskPost.steps) && taskPost.steps.length > 0
              ? taskPost.steps
              : [
                  'প্রথমে "GO TO TASK LINK" বাটনে ক্লিক করুন।',
                  'নির্দেশনা অনুযায়ী কাজ সম্পন্ন করুন।',
                  'সবশেষে প্রমাণ হিসেবে স্ক্রিনশট সাবমিট করুন।'
                ]
            ).map((stepText, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink/90"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-500 text-[11px] font-extrabold text-white shadow-2xs tabular-nums">
                  {idx + 1}
                </span>
                <span className="flex-1">{stepText}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Primary GO TO TASK LINK Button matching Screenshots 1 & 2 */}
      <button
        type="button"
        onClick={handleOpenTaskLink}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3.5 text-[14px] font-extrabold tracking-wide text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.98] cursor-pointer"
      >
        <ExternalLink className="h-4.5 w-4.5" />
        <span>GO TO TASK LINK</span>
      </button>

      {/* Submit Proof Screenshot(s) Card matching Screenshot 2 */}
      <section className="rounded-2xl bg-white p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3.5">
          <Camera className="h-5 w-5 text-ink" />
          <h3 className="text-[15px] font-extrabold text-ink">
            Submit Proof Screenshot(s)
          </h3>
        </div>

        {/* Status notice if already pending or approved or rejected */}
        {existingSubmission && (
          <div
            className={`mb-4 rounded-xl border p-3.5 ${
              existingSubmission.status === 'approved'
                ? 'border-emerald-200 bg-emerald-50/70'
                : existingSubmission.status === 'rejected'
                ? 'border-rose-200 bg-rose-50/70'
                : 'border-amber-200 bg-amber-50/70'
            }`}
          >
            <div className="flex items-center gap-2">
              {existingSubmission.status === 'approved' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : existingSubmission.status === 'rejected' ? (
                <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
              ) : (
                <Clock className="h-5 w-5 shrink-0 text-amber-600" />
              )}
              <p className="text-[13px] font-extrabold text-ink">
                {existingSubmission.status === 'approved'
                  ? `অনুমোদিত! +$${existingSubmission.reward.toFixed(2)} ব্যালেন্সে যোগ হয়েছে`
                  : existingSubmission.status === 'rejected'
                  ? 'আগের সাবমিশন বাতিল হয়েছে — পুনরায় জমা দিন'
                  : 'আপনার প্রমাণ রিভিউয়ের জন্য জমা আছে'}
              </p>
            </div>

            {existingSubmission.status === 'rejected' && existingSubmission.rejectReason && (
              <p className="mt-1.5 text-[12px] text-rose-700 font-medium">
                কারণ: {existingSubmission.rejectReason}
              </p>
            )}

            {existingSubmission.status !== 'rejected' && (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {existingSubmission.screenshots.map((src, i) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-lg border border-black/10 aspect-square bg-white"
                    >
                      <img
                        src={src}
                        alt={`Submitted Proof ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
                <Link
                  to="/tasks/history"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-white py-2 text-[12px] font-bold text-indigo-600 border border-black/10 shadow-2xs"
                >
                  হিস্টোরিতে স্ট্যাটাস দেখুন
                </Link>
              </>
            )}
          </div>
        )}

        {canSubmitForm && (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {Array.from({ length: requiredCount }).map((_, idx) => {
              const previewUrl = screenshots[idx];
              const fileName = fileNames[idx];
              const isUploadingThis = uploadingSlot === idx;

              return (
                <div key={idx}>
                  <label className="mb-1.5 block text-[12.5px] font-bold text-ink">
                    Upload Screenshot {idx + 1} <span className="text-rose-500">*</span>
                  </label>

                  {previewUrl ? (
                    <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-slate-50 p-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={previewUrl}
                          alt={`Screenshot ${idx + 1} preview`}
                          className="h-16 w-16 shrink-0 rounded-lg object-cover border border-black/10 bg-white"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-bold text-ink">
                            {fileName || `Screenshot_${idx + 1}.jpg`}
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> আপলোড সম্পন্ন
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeScreenshot(idx)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                          aria-label="Remove screenshot"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex min-h-[58px] cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-indigo-200 bg-slate-50/70 px-3 py-2.5 transition hover:border-indigo-400 hover:bg-indigo-50/30">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={isUploadingThis || submitting}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          handleFilePick(idx, file);
                        }}
                      />
                      <span className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink shadow-2xs">
                        {isUploadingThis ? (
                          <>
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5 text-slate-600" />
                            Choose File
                          </>
                        )}
                      </span>
                      <span className="truncate text-[12.5px] text-slate-500">
                        {isUploadingThis ? 'ছবি প্রসেস হচ্ছে...' : 'No file chosen'}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}

            <div>
              <label className="mb-1 block text-[12px] font-semibold text-slate-600">
                ইউজারনেম / অতিরিক্ত তথ্য (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="যেমন: একাউন্টের নাম বা ইমেইল..."
                className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-[13px] text-ink outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || uploadingSlot !== null}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#181c2e] py-3 text-[14px] font-extrabold text-white shadow-md transition hover:bg-[#232840] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>সাবমিট হচ্ছে...</span>
                </>
              ) : (
                <span>সাবমিট করুন</span>
              )}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
