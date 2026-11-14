import { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Upload,
  LoaderCircle,
  ExternalLink,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Save,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import type { AppConfig, TaskPost, TaskSubmission } from '../types';
import { useAppStore } from '../contexts/AuthContext';
import { generateId, reviewTaskSubmission } from '../lib/store';
import { uploadProofImage } from '../lib/uploadImage';
import { deleteTaskSubmissionFromFirebase } from '../lib/firebase';
import { formatDate } from '../lib/format';

interface Props {
  cfg: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export function TaskPostsAdmin({ cfg, updateConfig }: Props) {
  const db = useAppStore();
  const [subTab, setSubTab] = useState<'proofs' | 'posts'>('proofs');
  const [proofFilter, setProofFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Task Post Create / Edit form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<TaskPost | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [form, setForm] = useState({
    title: '',
    bannerUrl: '',
    reward: '0.50',
    taskUrl: 'https://ads.ziniyaapu7.workers.dev/',
    stepsText:
      'প্রথমে "GO TO TASK LINK" বাটনে ক্লিক করুন।\nএকটি নতুন একাউন্ট তৈরি করুন এবং কাজ সম্পন্ন করুন।\nসবশেষে প্রমাণ হিসেবে স্ক্রিনশট সাবমিট করুন।',
    requiredScreenshots: '1',
    order: '1',
    active: true
  });

  const taskPosts = useMemo(() => {
    const list = Array.isArray(cfg.taskPosts) ? [...cfg.taskPosts] : [];
    return list.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
  }, [cfg.taskPosts]);

  const submissions = useMemo(() => {
    const list = Array.isArray(db.taskSubmissions) ? [...db.taskSubmissions] : [];
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [db.taskSubmissions]);

  const filteredSubs = useMemo(() => {
    if (proofFilter === 'all') return submissions;
    return submissions.filter((s) => s.status === proofFilter);
  }, [submissions, proofFilter]);

  const pendingCount = useMemo(
    () => submissions.filter((s) => s.status === 'pending').length,
    [submissions]
  );

  const openNewForm = () => {
    setEditingPost(null);
    setForm({
      title: '',
      bannerUrl: '',
      reward: '0.50',
      taskUrl: 'https://ads.ziniyaapu7.workers.dev/',
      stepsText:
        'প্রথমে "GO TO TASK LINK" বাটনে ক্লিক করুন।\nনির্দেশনা অনুযায়ী একাউন্ট তৈরি ও কাজ সম্পন্ন করুন।\nসবশেষে প্রমাণ হিসেবে স্ক্রিনশট সাবমিট করুন।',
      requiredScreenshots: '1',
      order: String(taskPosts.length + 1),
      active: true
    });
    setIsFormOpen(true);
  };

  const openEditForm = (post: TaskPost) => {
    setEditingPost(post);
    setForm({
      title: post.title,
      bannerUrl: post.bannerUrl,
      reward: String(post.reward),
      taskUrl: post.taskUrl,
      stepsText: (Array.isArray(post.steps) ? post.steps : []).join('\n'),
      requiredScreenshots: String(post.requiredScreenshots || 1),
      order: String(post.order || 1),
      active: post.active !== false
    });
    setIsFormOpen(true);
  };

  const handleBannerUpload = async (file?: File) => {
    if (!file) return;
    setUploadingBanner(true);
    try {
      const url = await uploadProofImage(file, cfg.imgbbApiKey);
      setForm((prev) => ({ ...prev, bannerUrl: url }));
      toast.success('ব্যানার ছবি আপলোড হয়েছে!');
    } catch {
      toast.error('ব্যানার ছবি আপলোড ব্যর্থ হয়েছে');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSavePost = () => {
    if (!form.title.trim()) {
      toast.error('টাস্কের টাইটেল লিখুন');
      return;
    }
    const rewardNum = Number(form.reward);
    if (isNaN(rewardNum) || rewardNum <= 0) {
      toast.error('সঠিক ডলার রিওয়ার্ড দিন');
      return;
    }
    if (!form.taskUrl.trim()) {
      toast.error('টাস্কের লিংক দিন');
      return;
    }

    const steps = form.stepsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const reqShots = Math.max(1, Math.min(3, parseInt(form.requiredScreenshots, 10) || 1));
    const current = Array.isArray(cfg.taskPosts) ? [...cfg.taskPosts] : [];

    if (editingPost) {
      const idx = current.findIndex((p) => p.id === editingPost.id);
      if (idx !== -1) {
        current[idx] = {
          ...editingPost,
          title: form.title.trim(),
          bannerUrl: form.bannerUrl.trim(),
          reward: rewardNum,
          taskUrl: form.taskUrl.trim(),
          steps,
          requiredScreenshots: reqShots,
          order: Number(form.order) || idx + 1,
          active: form.active
        };
      }
      toast.success('টাস্ক পোস্ট আপডেট ও লাইভ হয়েছে!');
    } else {
      const newPost: TaskPost = {
        id: generateId('tp'),
        title: form.title.trim(),
        bannerUrl: form.bannerUrl.trim(),
        reward: rewardNum,
        taskUrl: form.taskUrl.trim(),
        steps,
        requiredScreenshots: reqShots,
        order: Number(form.order) || current.length + 1,
        active: form.active,
        createdAt: new Date().toISOString()
      };
      current.push(newPost);
      toast.success('নতুন টাস্ক পোস্ট যোগ ও লাইভ হয়েছে!');
    }

    current.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
    updateConfig({ taskPosts: current });
    setIsFormOpen(false);
    setEditingPost(null);
  };

  const handleApprove = async (sub: TaskSubmission) => {
    setProcessingId(sub.id);
    try {
      await reviewTaskSubmission(sub.id, 'approved');
      toast.success(`অনুমোদিত! +$${sub.reward.toFixed(2)} ইউজারের ব্যালেন্সে যোগ হয়েছে।`);
    } catch {
      toast.error('অনুমোদন করতে সমস্যা হয়েছে');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectConfirm = async (sub: TaskSubmission) => {
    setProcessingId(sub.id);
    try {
      await reviewTaskSubmission(sub.id, 'rejected', rejectReason);
      toast.success('সাবমিশন বাতিল করা হয়েছে');
      setRejectingId(null);
      setRejectReason('');
    } catch {
      toast.error('বাতিল করতে সমস্যা হয়েছে');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation between Proof Reviews and Task Posts Management */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-2.5 shadow-sm border border-slate-200">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('proofs')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'proofs'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📸 Proof Reviews {pendingCount > 0 ? `(${pendingCount} Pending)` : ''}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('posts')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              subTab === 'posts'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📝 Task Posts ({taskPosts.length})
          </button>
        </div>

        {subTab === 'posts' && (
          <button
            type="button"
            onClick={openNewForm}
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-600 active:scale-95 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            নতুন টাস্ক পোস্ট তৈরি করুন
          </button>
        )}
      </div>

      {/* VIEW 1: PROOF SUBMISSIONS QUEUE */}
      {subTab === 'proofs' && (
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-ink">
              Submitted Proof Screenshots ({filteredSubs.length})
            </h3>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setProofFilter(st)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition cursor-pointer ${
                    proofFilter === st
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-ink'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {filteredSubs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400">
              এই ক্যাটাগরিতে কোনো টাস্ক প্রমাণ জমা নেই।
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubs.map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-extrabold text-ink">{sub.taskTitle}</p>
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        User: <b>{sub.userName}</b> (TID: <span className="font-mono">{sub.telegramId}</span>) ·{' '}
                        <span className="font-extrabold text-emerald-600">${Number(sub.reward).toFixed(2)}</span>
                      </p>
                      <p className="text-[10px] text-slate-400">{formatDate(sub.createdAt)}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${
                          sub.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : sub.status === 'rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {sub.status === 'approved' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : sub.status === 'rejected' ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {sub.status.toUpperCase()}
                      </span>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('এই সাবমিশন রেকর্ডটি মুছে ফেলবেন?')) return;
                          await deleteTaskSubmissionFromFirebase(sub.id);
                          toast.success('রেকর্ড মুছে ফেলা হয়েছে');
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 text-rose-500 hover:bg-rose-50"
                        title="Delete submission"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {sub.note && (
                    <p className="rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] text-slate-700 border border-slate-200">
                      <b>User Note:</b> {sub.note}
                    </p>
                  )}

                  {sub.rejectReason && sub.status === 'rejected' && (
                    <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11.5px] text-rose-700 border border-rose-200">
                      <b>Reject Reason:</b> {sub.rejectReason}
                    </p>
                  )}

                  {/* Screenshots Grid */}
                  <div className="flex flex-wrap gap-2">
                    {(sub.screenshots || []).map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setZoomImage(src)}
                        className="group relative h-20 w-24 overflow-hidden rounded-xl border border-slate-300 bg-white cursor-pointer"
                      >
                        <img src={src} alt={`Proof ${i + 1}`} className="h-full w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition text-white text-[10px] font-bold">
                          <Eye className="h-4 w-4 mr-1" /> View
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Approve / Reject Actions */}
                  {sub.status === 'pending' && (
                    <div className="pt-1 space-y-2">
                      {rejectingId === sub.id ? (
                        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl border border-rose-200">
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="বাতিলের কারণ লিখুন (ঐচ্ছিক)..."
                            className="flex-1 min-w-[160px] rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-rose-400"
                          />
                          <button
                            type="button"
                            disabled={processingId === sub.id}
                            onClick={() => handleRejectConfirm(sub)}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                          >
                            Confirm Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReason('');
                            }}
                            className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={processingId === sub.id}
                            onClick={() => handleApprove(sub)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                          >
                            <Check className="h-4 w-4" />
                            Approve & Pay +${Number(sub.reward).toFixed(2)}
                          </button>
                          <button
                            type="button"
                            disabled={processingId === sub.id}
                            onClick={() => {
                              setRejectingId(sub.id);
                              setRejectReason('');
                            }}
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-4 py-2 text-xs font-extrabold text-rose-600 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: MANAGE TASK POSTS */}
      {subTab === 'posts' && (
        <div className="space-y-4">
          {isFormOpen && (
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <h4 className="text-sm font-extrabold text-ink">
                  {editingPost ? 'টাস্ক পোস্ট এডিট করুন' : 'নতুন টাস্ক পোস্ট তৈরি করুন'}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingPost(null);
                  }}
                  className="rounded-lg bg-white p-1.5 text-slate-500 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  টাস্কের টাইটেল (Title) *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="যেমন: একাউন্ট করুন & WhatsApp এড এর কাজ"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-ink focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  ব্যানার ছবি (ছবি আপলোড করুন অথবা URL দিন)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={form.bannerUrl}
                    onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
                    placeholder="https://... বা ডানপাশের বাটন থেকে আপলোড করুন"
                    className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-ink focus:border-indigo-500 focus:outline-none"
                  />
                  <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={uploadingBanner}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        handleBannerUpload(f);
                      }}
                    />
                    {uploadingBanner ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    <span>{uploadingBanner ? 'আপলোড হচ্ছে...' : 'ছবি আপলোড'}</span>
                  </label>
                </div>
                {form.bannerUrl && (
                  <img
                    src={form.bannerUrl}
                    alt="Banner preview"
                    className="mt-2 h-28 w-48 rounded-xl object-cover border border-black/10 bg-white"
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    রিওয়ার্ড ($ USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.reward}
                    onChange={(e) => setForm({ ...form, reward: e.target.value })}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-emerald-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    প্রমাণ স্ক্রিনশট (১-৩)
                  </label>
                  <select
                    value={form.requiredScreenshots}
                    onChange={(e) => setForm({ ...form, requiredScreenshots: e.target.value })}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="1">1 Screenshot</option>
                    <option value="2">2 Screenshots</option>
                    <option value="3">3 Screenshots</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    সিরিয়াল (Order)
                  </label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: e.target.value })}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  টাস্ক লিংক (GO TO TASK LINK URL) *
                </label>
                <input
                  type="url"
                  value={form.taskUrl}
                  onChange={(e) => setForm({ ...form, taskUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-mono text-ink focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  কাজ করার বিবরণ (প্রতি লাইন একটি ধাপ ১, ২, ৩ হিসেবে দেখাবে):
                </label>
                <textarea
                  rows={4}
                  value={form.stepsText}
                  onChange={(e) => setForm({ ...form, stepsText: e.target.value })}
                  className="w-full rounded-xl border border-black/10 bg-white p-3 text-xs text-ink leading-relaxed focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span className="text-xs font-bold text-slate-700">Active (ইউজারদের কাছে দেখাবে)</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingPost(null);
                  }}
                  className="rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-bold text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleSavePost}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-indigo-700"
                >
                  <Save className="h-3.5 w-3.5" />
                  {editingPost ? 'আপডেট সেভ করুন' : 'পোস্ট পাবলিশ করুন'}
                </button>
              </div>
            </div>
          )}

          {/* Task Posts List */}
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 space-y-3">
            <h3 className="text-sm font-extrabold text-ink">
              All Task Posts ({taskPosts.length})
            </h3>

            {taskPosts.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                এখনো কোনো টাস্ক পোস্ট তৈরি করা হয়নি।
              </p>
            ) : (
              <div className="space-y-2.5">
                {taskPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 bg-slate-50/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-200 flex items-center justify-center">
                        {post.bannerUrl ? (
                          <img
                            src={post.bannerUrl}
                            alt={post.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-xs font-extrabold text-ink">
                          #{post.order || 1} · {post.title}
                        </p>
                        <p className="mt-0.5 text-[11px] font-bold text-emerald-600">
                          Reward: ${Number(post.reward).toFixed(2)} · {post.requiredScreenshots || 1} Screenshot(s) ·{' '}
                          <span className={post.active === false ? 'text-rose-500' : 'text-indigo-600'}>
                            {post.active === false ? 'Hidden' : 'Active'}
                          </span>
                        </p>
                        <p className="truncate text-[10px] font-mono text-slate-400">{post.taskUrl}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <a
                        href={post.taskUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        title="Open Task Link"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => openEditForm(post)}
                        className="flex h-8 items-center gap-1 rounded-xl bg-white border border-slate-200 px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit2 className="h-3 w-3" /> এডিট
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm(`"${post.title}" টাস্ক পোস্টটি ডিলিট করবেন?`)) return;
                          const remaining = taskPosts.filter((p) => p.id !== post.id);
                          updateConfig({ taskPosts: remaining });
                          toast.success('টাস্ক পোস্ট ডিলিট হয়েছে');
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Proof Screenshot Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomImage(null)}
        >
          <button
            type="button"
            onClick={() => setZoomImage(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-lg"
            aria-label="Close"
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
    </div>
  );
}
