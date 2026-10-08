import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Send,
  Radio,
  Pause,
  Play,
  Square,
  Image as ImageIcon,
  Video,
  FileText,
  Type,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Columns2,
  Rows,
  Calendar,
  Key,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../contexts/AuthContext';
import {
  syncBroadcastToFirebase,
  subscribeAllBroadcasts,
  deleteBroadcastFromFirebase
} from '../lib/firebase';
import { formatDate } from '../lib/format';
import type {
  BroadcastCampaign,
  BroadcastButton,
  BroadcastMessageType,
  BroadcastTargetAudience
} from '../types';

export function BroadcastManager() {
  const db = useAppStore();
  const [broadcasts, setBroadcasts] = useState<BroadcastCampaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<BroadcastCampaign | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Form States
  const [title, setTitle] = useState('');
  const [messageType, setMessageType] = useState<BroadcastMessageType>('text');
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [targetAudience, setTargetAudience] = useState<BroadcastTargetAudience>('all');
  const [targetValue, setTargetValue] = useState('');
  const [buttons, setButtons] = useState<BroadcastButton[]>([]);
  const [buttonLayout, setButtonLayout] = useState<'single' | 'double'>('double');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active view tab: 'new' | 'progress' | 'history'
  const [viewTab, setViewTab] = useState<'new' | 'progress' | 'history'>('new');

  // Client-side execution refs (for fallback execution or monitoring)
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Subscribe to Firebase RTDB for all broadcasts
  useEffect(() => {
    const unsubscribe = subscribeAllBroadcasts((list) => {
      setBroadcasts(list);
      setLoadingHistory(false);

      // Check if there's any actively running or paused campaign
      const running = list.find((b) => b.status === 'running');
      const paused = list.find((b) => b.status === 'paused');
      if (running) {
        setActiveCampaign(running);
      } else if (paused && !activeCampaign) {
        setActiveCampaign(paused);
      }
    });

    return () => {
      unsubscribe();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // 2. Poll server status when campaign is running
  useEffect(() => {
    if (activeCampaign && activeCampaign.status === 'running') {
      const interval = setInterval(async () => {
        try {
          const res = await fetch('/api/broadcast/status');
          if (res.ok) {
            const data = await res.json();
            if (data.activeCampaign) {
              setActiveCampaign(data.activeCampaign);
              if (data.activeCampaign.status === 'completed' || data.activeCampaign.status === 'stopped') {
                clearInterval(interval);
              }
            }
          }
        } catch {
          // ignore network glitch
        }
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [activeCampaign?.status, activeCampaign?.id]);

  // Compute recipient list based on audience selection
  const allUsersList = useMemo(() => Object.values(db.users || {}), [db.users]);

  const resolvedRecipientIds = useMemo(() => {
    const now = new Date();
    switch (targetAudience) {
      case 'all':
        return allUsersList.map((u) => u.telegramId).filter(Boolean);

      case 'active': {
        // Logged in within last 7 days or today
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return allUsersList
          .filter((u) => {
            if (!u.lastLogin) return false;
            return new Date(u.lastLogin) >= sevenDaysAgo;
          })
          .map((u) => u.telegramId);
      }

      case 'recent': {
        if (!targetValue) {
          // Default: created in last 24h
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return allUsersList
            .filter((u) => u.createdAt && new Date(u.createdAt) >= oneDayAgo)
            .map((u) => u.telegramId);
        }
        const cutoff = new Date(targetValue);
        return allUsersList
          .filter((u) => u.createdAt && new Date(u.createdAt) >= cutoff)
          .map((u) => u.telegramId);
      }

      case 'specific': {
        if (!targetValue) return [];
        return targetValue
          .split(/[\s,;\n]+/)
          .map((s) => s.trim().replace(/^@/, ''))
          .filter((s) => /^\d+$/.test(s));
      }

      case 'verified_only':
        return allUsersList.filter((u) => u.verified).map((u) => u.telegramId);

      case 'unverified_only':
        return allUsersList.filter((u) => !u.verified).map((u) => u.telegramId);

      default:
        return allUsersList.map((u) => u.telegramId);
    }
  }, [allUsersList, targetAudience, targetValue]);

  // Button management
  const handleAddButton = () => {
    if (buttons.length >= 8) {
      toast.error('সর্বোচ্চ ৮টি বাটন যোগ করা যাবে');
      return;
    }
    setButtons([...buttons, { label: '', url: 'https://' }]);
  };

  const handleUpdateButton = (index: number, field: keyof BroadcastButton, val: string) => {
    const next = [...buttons];
    next[index] = { ...next[index], [field]: val };
    setButtons(next);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  // Launch Broadcast
  const handleStartBroadcast = async () => {
    if (!text.trim()) {
      toast.error('মেসেজের টেক্সট বা ক্যাপশন লিখুন!');
      return;
    }

    if (messageType !== 'text' && !mediaUrl.trim()) {
      toast.error(`দয়া করে ${messageType.toUpperCase()} এর সরাসরি URL দিন!`);
      return;
    }

    if (resolvedRecipientIds.length === 0) {
      toast.error('নির্বাচিত ক্যাটাগরিতে কোনো ইউজার পাওয়া যায়নি!');
      return;
    }

    // Validate buttons
    for (const b of buttons) {
      if (!b.label.trim() || !b.url.trim()) {
        toast.error('সব বাটনের নাম ও সঠিক URL পূরণ করুন!');
        return;
      }
      if (!b.url.startsWith('http://') && !b.url.startsWith('https://') && !b.url.startsWith('tg://')) {
        toast.error('বাটন লিংকে https:// অথবা tg:// থাকতে হবে!');
        return;
      }
    }

    setIsSubmitting(true);
    const serial = broadcasts.length + 1;
    const campaignId = `bc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newCampaign: BroadcastCampaign = {
      id: campaignId,
      serialNumber: serial,
      title: title.trim() || `Broadcast #${serial}`,
      messageType,
      text: text.trim(),
      mediaUrl: mediaUrl.trim() || undefined,
      buttons,
      buttonLayout,
      targetAudience,
      targetValue: targetValue.trim() || undefined,
      totalTarget: resolvedRecipientIds.length,
      sentCount: 0,
      failedCount: 0,
      status: 'running',
      currentIndex: 0,
      targetUserIds: resolvedRecipientIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Try server endpoint
      const res = await fetch('/api/broadcast/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCampaign)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.campaign) {
          setActiveCampaign(data.campaign);
          toast.success(`🚀 Broadcast #${serial} শুরু হয়েছে (${resolvedRecipientIds.length} জন ইউজার)`);
          setViewTab('progress');
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Fallback: Save to Firebase RTDB and update state
      await syncBroadcastToFirebase(newCampaign);
      setActiveCampaign(newCampaign);
      toast.success(`🚀 Broadcast #${serial} শুরু হয়েছে!`);
      setViewTab('progress');
    } catch (err: any) {
      console.warn('Error starting broadcast:', err);
      await syncBroadcastToFirebase(newCampaign);
      setActiveCampaign(newCampaign);
      setViewTab('progress');
      toast.success(`🚀 Broadcast #${serial} সংরক্ষিত ও চালু হয়েছে`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pause Broadcast
  const handlePauseBroadcast = async () => {
    if (!activeCampaign) return;
    try {
      await fetch('/api/broadcast/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeCampaign.id })
      });
    } catch {}

    const updated = {
      ...activeCampaign,
      status: 'paused' as const,
      updatedAt: new Date().toISOString()
    };
    setActiveCampaign(updated);
    await syncBroadcastToFirebase(updated);
    toast.info('⏸️ Broadcast সাময়িক স্থগিত (Paused) করা হয়েছে।');
  };

  // Resume Broadcast
  const handleResumeBroadcast = async (campaignToResume?: BroadcastCampaign) => {
    const target = campaignToResume || activeCampaign;
    if (!target) return;

    try {
      await fetch('/api/broadcast/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id })
      });
    } catch {}

    const updated = {
      ...target,
      status: 'running' as const,
      updatedAt: new Date().toISOString()
    };
    setActiveCampaign(updated);
    await syncBroadcastToFirebase(updated);
    setViewTab('progress');
    toast.success(`▶️ Broadcast #${target.serialNumber} পুনরায় চালু হয়েছে (${target.currentIndex}/${target.totalTarget})`);
  };

  // Stop Broadcast
  const handleStopBroadcast = async () => {
    if (!activeCampaign) return;
    if (!confirm('আপনি কি নিশ্চিত যে এই ব্রডকাস্টটি সম্পূর্ণ বন্ধ করতে চান?')) return;

    try {
      await fetch('/api/broadcast/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeCampaign.id })
      });
    } catch {}

    const updated = {
      ...activeCampaign,
      status: 'stopped' as const,
      updatedAt: new Date().toISOString()
    };
    setActiveCampaign(updated);
    await syncBroadcastToFirebase(updated);
    toast.warning('🛑 Broadcast সম্পূর্ণরূপে বন্ধ (Stopped) করা হয়েছে।');
  };

  // Delete Campaign
  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('আপনি কি এই ব্রডকাস্ট রেকর্ডটি মুছে ফেলতে চান?')) return;
    await deleteBroadcastFromFirebase(id);
    if (activeCampaign?.id === id) {
      setActiveCampaign(null);
    }
    toast.success('রেকর্ডটি মুছে ফেলা হয়েছে।');
  };

  // Reuse / Clone campaign into form
  const handleReuseCampaign = (c: BroadcastCampaign) => {
    setTitle(c.title || '');
    setMessageType(c.messageType || 'text');
    setText(c.text || '');
    setMediaUrl(c.mediaUrl || '');
    setTargetAudience(c.targetAudience || 'all');
    setTargetValue(c.targetValue || '');
    setButtons(c.buttons || []);
    setButtonLayout(c.buttonLayout || 'double');
    setViewTab('new');
    toast.info(`Broadcast #${c.serialNumber} এর মেসেজ ফর্মে লোড হয়েছে`);
  };

  // Calculate live progress metrics
  const progressMetrics = useMemo(() => {
    if (!activeCampaign) return null;
    const total = activeCampaign.totalTarget || 1;
    const sent = activeCampaign.sentCount || 0;
    const failed = activeCampaign.failedCount || 0;
    const processed = sent + failed;
    const remaining = Math.max(0, total - processed);
    const percent = Math.min(100, Math.round((processed / total) * 100));

    return { total, sent, failed, remaining, percent, processed };
  }, [activeCampaign]);

  return (
    <div className="space-y-4">
      {/* Top Header & View Tabs */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/20">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black text-ink">📢 Admin Broadcast System</h2>
              <p className="text-xs text-slate-500 font-medium">
                টেলিগ্রাম বটের মাধ্যমে সব বা নির্দিষ্ট ইউজারের কাছে মেসেজ ও বাটন ব্রডকাস্ট করুন
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setViewTab('new')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              viewTab === 'new'
                ? 'bg-white text-ink shadow-sm'
                : 'text-slate-600 hover:text-ink'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send Broadcast</span>
          </button>

          <button
            type="button"
            onClick={() => setViewTab('progress')}
            className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              viewTab === 'progress'
                ? 'bg-white text-ink shadow-sm'
                : 'text-slate-600 hover:text-ink'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Live Progress</span>
            {activeCampaign && (activeCampaign.status === 'running' || activeCampaign.status === 'paused') && (
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setViewTab('history')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              viewTab === 'history'
                ? 'bg-white text-ink shadow-sm'
                : 'text-slate-600 hover:text-ink'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>History ({broadcasts.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SEND BROADCAST TAB */}
      {/* ========================================================================= */}
      {viewTab === 'new' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Main Form (2 Columns) */}
          <div className="space-y-4 lg:col-span-2">
            {/* Message Type Selector */}
            <div className="rounded-2xl bg-white p-4 shadow-card">
              <label className="mb-2 block text-xs font-bold text-slate-700">
                ১. মেসেজের ধরণ নির্বাচন করুন (Message Type)
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { id: 'text', label: 'Text message', icon: Type, desc: 'শুধু টেক্সট মেসেজ' },
                  { id: 'photo', label: 'Photo + caption', icon: ImageIcon, desc: 'ছবি সহ মেসেজ' },
                  { id: 'video', label: 'Video + caption', icon: Video, desc: 'ভিডিও সহ মেসেজ' },
                  { id: 'document', label: 'Document', icon: FileText, desc: 'ডকুমেন্ট ফাইল' }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = messageType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMessageType(item.id as BroadcastMessageType)}
                      className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                        isSelected
                          ? 'border-red-500 bg-red-50/50 text-red-600 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-xs font-bold">{item.label}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Fields */}
            <div className="rounded-2xl bg-white p-4 shadow-card space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  ব্রডকাস্ট ক্যাম্পেইন নাম / টাইটেল (Title - ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: নতুন অফার, মেগা বোনাস ঘোষণা..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-ink focus:border-red-500 focus:outline-none"
                />
              </div>

              {/* Media URL if not text */}
              {messageType !== 'text' && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      {messageType === 'photo' && 'ছবির সরাসরি লিংক (Direct Photo URL)'}
                      {messageType === 'video' && 'ভিডিওর সরাসরি লিংক (Direct Video MP4 URL)'}
                      {messageType === 'document' && 'ডকুমেন্টের সরাসরি লিংক (Document URL)'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      (ImgBB, Cloudinary, বা সরাসরি https:// লিংক)
                    </span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/media.jpg"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-ink focus:border-red-500 focus:outline-none"
                  />
                  {mediaUrl && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                      <span className="text-[11px] font-bold text-slate-500">প্রিভিউ:</span>
                      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline truncate max-w-xs flex items-center gap-1">
                        {mediaUrl} <ExternalLink className="h-3 w-3 inline" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Message text / caption */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>
                    {messageType === 'text' ? 'মেসেজ টেক্সট (Message Body)' : 'ক্যাপশন (Caption)'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (HTML ফরম্যাট সমর্থিত: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;)
                  </span>
                </label>
                <textarea
                  rows={5}
                  placeholder={`🎉 বিশেষ ঘোষণা!\n\nআমাদের সাইটে নতুন অফার চালু হয়েছে। এখনই কাজ শুরু করে বোনাস সংগ্রহ করুন!`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium text-ink focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Button / Inline Keyboard Builder */}
            <div className="rounded-2xl bg-white p-4 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-700">
                    🔘 Button যোগ করার সুবিধা (Inline Keyboard)
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    মেসেজের নিচে ক্লিকেবল বাটন যুক্ত করুন (যেমন: ওয়েবসাইট বা চ্যাট খোলার বাটন)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Button layout switcher */}
                  <div className="flex rounded-lg bg-slate-100 p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setButtonLayout('single')}
                      className={`flex items-center gap-1 rounded px-2 py-1 ${
                        buttonLayout === 'single' ? 'bg-white text-ink shadow-xs' : 'text-slate-500'
                      }`}
                      title="১ সারিতে ১টি বাটন"
                    >
                      <Rows className="h-3 w-3" />
                      <span>1-Col</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setButtonLayout('double')}
                      className={`flex items-center gap-1 rounded px-2 py-1 ${
                        buttonLayout === 'double' ? 'bg-white text-ink shadow-xs' : 'text-slate-500'
                      }`}
                      title="১ সারিতে ২টি বাটন"
                    >
                      <Columns2 className="h-3 w-3" />
                      <span>2-Col</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>বাটন যোগ করুন</span>
                  </button>
                </div>
              </div>

              {buttons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  কোনো বাটন যোগ করা হয়নি। মেসেজের সাথে বাটন দিতে ওপরের <b>বাটন যোগ করুন</b> এ চাপুন।
                </div>
              ) : (
                <div className="space-y-2">
                  {buttons.map((btn, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 sm:flex-row sm:items-center"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-[10px] font-bold text-slate-700">
                        #{idx + 1}
                      </span>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Button Name (যেমন: 🚀 Open App)"
                          value={btn.label}
                          onChange={(e) => handleUpdateButton(idx, 'label', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink focus:border-red-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="url"
                          placeholder="Button URL (https://...)"
                          value={btn.url}
                          onChange={(e) => handleUpdateButton(idx, 'url', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink focus:border-red-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveButton(idx)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Target Audience & Launch Summary */}
          <div className="space-y-4">
            {/* Target Audience Selector */}
            <div className="rounded-2xl bg-white p-4 shadow-card space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                👥 কাদের কাছে যাবে (Target Audience)
              </label>

              <div className="space-y-1.5">
                {[
                  { id: 'all', label: 'সব User (All Registered Users)', count: allUsersList.length },
                  {
                    id: 'active',
                    label: 'Active Users (গত ৭ দিনে সক্রিয়)',
                    count: allUsersList.filter((u) => u.lastLogin && new Date(u.lastLogin) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length
                  },
                  { id: 'recent', label: 'নির্দিষ্ট সময়ের পর যারা Start করেছে', count: null },
                  { id: 'specific', label: 'নির্দিষ্ট User ID (Custom IDs)', count: null },
                  { id: 'verified_only', label: 'শুধুমাত্র Verified Users', count: allUsersList.filter((u) => u.verified).length },
                  { id: 'unverified_only', label: 'শুধুমাত্র Unverified Users', count: allUsersList.filter((u) => !u.verified).length }
                ].map((aud) => {
                  const isChecked = targetAudience === aud.id;
                  return (
                    <label
                      key={aud.id}
                      className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition ${
                        isChecked
                          ? 'border-red-500 bg-red-50/40 text-ink shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="targetAudience"
                          checked={isChecked}
                          onChange={() => setTargetAudience(aud.id as BroadcastTargetAudience)}
                          className="h-4 w-4 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-xs font-bold">{aud.label}</span>
                      </div>
                      {typeof aud.count === 'number' && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {aud.count} জন
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              {/* Sub-inputs for recent & specific */}
              {targetAudience === 'recent' && (
                <div className="rounded-xl bg-slate-50 p-2.5 space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>কোন তারিখের পর থেকে হিসাব হবে?</span>
                  </label>
                  <input
                    type="date"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    নির্বাচিত তারিখ থেকে যারা জয়েন করেছে কেবল তাদের পাঠানো হবে।
                  </p>
                </div>
              )}

              {targetAudience === 'specific' && (
                <div className="rounded-xl bg-slate-50 p-2.5 space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">
                    টেলিগ্রাম ইউজার আইডি (Telegram IDs):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="8235864550, 5569819998, 724910385..."
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono text-ink focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    কমা (,) অথবা নতুন লাইনে একাধিক Telegram ID লিখতে পারেন।
                  </p>
                </div>
              )}
            </div>

            {/* Launch Summary Card */}
            <div className="rounded-2xl bg-gradient-to-br from-[#120204] via-[#1c0307] to-black p-4 text-white shadow-xl border border-red-500/30 space-y-3">
              <div className="flex items-center justify-between border-b border-red-900/40 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-red-400">
                  ক্যাম্পেইন সামারি
                </span>
                <span className="rounded-full bg-red-600/30 px-2 py-0.5 text-[10px] font-bold text-red-300">
                  #{broadcasts.length + 1}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">মেসেজ টাইপ:</span>
                  <span className="font-bold uppercase text-white">{messageType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">বাটন সংখ্যা:</span>
                  <span className="font-bold text-white">{buttons.length} টি ({buttonLayout})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">টার্গেট ইউজার:</span>
                  <span className="font-black text-amber-300">
                    {resolvedRecipientIds.length.toLocaleString()} জন
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmitting || resolvedRecipientIds.length === 0}
                onClick={handleStartBroadcast}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 py-3 text-xs font-black text-white shadow-lg shadow-red-600/40 hover:brightness-110 active:scale-98 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>প্রস্তুত হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>📢 এখনই ব্রডকাস্ট শুরু করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. LIVE PROGRESS TAB */}
      {/* ========================================================================= */}
      {viewTab === 'progress' && (
        <div className="space-y-4">
          {!activeCampaign ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-card">
              <Radio className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-ink">বর্তমানে কোনো ব্রডকাস্ট চলছে না</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                নতুন ব্রডকাস্ট চালু করতে <b>Send Broadcast</b> ট্যাবে গিয়ে বার্তা পাঠান।
              </p>
              <button
                type="button"
                onClick={() => setViewTab('new')}
                className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                নতুন ব্রডকাস্ট তৈরি করুন
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-5 shadow-card space-y-5">
              {/* Active Campaign Header */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-600">
                      #{activeCampaign.serialNumber}
                    </span>
                    <h3 className="text-base font-black text-ink">{activeCampaign.title}</h3>
                    {activeCampaign.status === 'running' && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        চলছে (Running)
                      </span>
                    )}
                    {activeCampaign.status === 'paused' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        স্থগিত (Paused)
                      </span>
                    )}
                    {activeCampaign.status === 'stopped' && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        বন্ধ (Stopped)
                      </span>
                    )}
                    {activeCampaign.status === 'completed' && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        সম্পন্ন (Completed) ✅
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    শুরু: {formatDate(activeCampaign.createdAt)} • টাইপ: {activeCampaign.messageType.toUpperCase()}
                  </p>
                </div>

                {/* Engine Controls: Stop, Pause, Resume */}
                <div className="flex items-center gap-2">
                  {activeCampaign.status === 'running' && (
                    <button
                      type="button"
                      onClick={handlePauseBroadcast}
                      className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>Pause</span>
                    </button>
                  )}

                  {activeCampaign.status === 'paused' && (
                    <button
                      type="button"
                      onClick={() => handleResumeBroadcast()}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Resume (পুনরায় চালান)</span>
                    </button>
                  )}

                  {(activeCampaign.status === 'running' || activeCampaign.status === 'paused') && (
                    <button
                      type="button"
                      onClick={handleStopBroadcast}
                      className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                    >
                      <Square className="h-3.5 w-3.5" />
                      <span>Stop Broadcast</span>
                    </button>
                  )}

                  {(activeCampaign.status === 'completed' || activeCampaign.status === 'stopped') && (
                    <button
                      type="button"
                      onClick={() => handleReuseCampaign(activeCampaign)}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Re-send (আবার পাঠান)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4-Stat Metric Grid */}
              {progressMetrics && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Users
                    </span>
                    <span className="text-xl font-black text-ink mt-0.5 block">
                      {progressMetrics.total.toLocaleString()}
                    </span>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                      Sent (সফল)
                    </span>
                    <span className="text-xl font-black text-emerald-600 mt-0.5 block">
                      {progressMetrics.sent.toLocaleString()}
                    </span>
                  </div>

                  <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-center">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                      Failed (ব্যর্থ)
                    </span>
                    <span className="text-xl font-black text-rose-600 mt-0.5 block">
                      {progressMetrics.failed.toLocaleString()}
                    </span>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-center">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
                      Remaining (বাকি)
                    </span>
                    <span className="text-xl font-black text-amber-600 mt-0.5 block">
                      {progressMetrics.remaining.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Progress Bar & Percentage */}
              {progressMetrics && (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <Radio className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                      <span>অগ্রগতি (Progress):</span>
                    </span>
                    <span className="text-sm font-black text-red-600">
                      {progressMetrics.percent}%
                    </span>
                  </div>

                  {/* Visual Bar */}
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-rose-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${progressMetrics.percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                    <span>প্রসেসড: {progressMetrics.processed} জন</span>
                    <span>মোট: {progressMetrics.total} জন</span>
                  </div>
                </div>
              )}

              {/* Message Content Preview */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  মেসেজ প্রিভিউ
                </span>
                {activeCampaign.mediaUrl && (
                  <div className="max-w-xs overflow-hidden rounded-lg border border-slate-200">
                    {activeCampaign.messageType === 'photo' && (
                      <img src={activeCampaign.mediaUrl} alt="Preview" className="h-36 w-full object-cover" />
                    )}
                    {activeCampaign.messageType !== 'photo' && (
                      <div className="p-2 text-xs text-blue-600 underline">
                        Media: {activeCampaign.mediaUrl}
                      </div>
                    )}
                  </div>
                )}
                <p className="whitespace-pre-wrap text-xs text-slate-700 font-medium">
                  {activeCampaign.text}
                </p>

                {activeCampaign.buttons && activeCampaign.buttons.length > 0 && (
                  <div className={`mt-2 grid gap-1.5 ${activeCampaign.buttonLayout === 'double' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {activeCampaign.buttons.map((b, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-blue-50 py-1.5 px-2.5 text-center text-[11px] font-bold text-blue-600 border border-blue-200 truncate"
                      >
                        {b.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BROADCAST HISTORY TAB */}
      {/* ========================================================================= */}
      {viewTab === 'history' && (
        <div className="rounded-2xl bg-white p-4 shadow-card space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-ink">📜 Broadcast History</h3>
              <p className="text-xs text-slate-400">পূর্বে পাঠানো সকল ব্রডকাস্ট ক্যাম্পেইনের তালিকা</p>
            </div>
            <button
              type="button"
              onClick={() => setViewTab('new')}
              className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>নতুন ব্রডকাস্ট</span>
            </button>
          </div>

          {loadingHistory ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <RefreshCw className="mx-auto h-5 w-5 animate-spin mb-1 text-slate-400" />
              ইতিহাস লোড হচ্ছে...
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              এখনো কোনো ব্রডকাস্ট পাঠানো হয়নি।
            </div>
          ) : (
            <div className="space-y-2.5">
              {broadcasts.map((c) => {
                const total = c.totalTarget || 1;
                const percent = Math.min(100, Math.round(((c.sentCount + c.failedCount) / total) * 100));

                return (
                  <div
                    key={c.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3.5 hover:border-slate-300 transition sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-700">
                          #{c.serialNumber}
                        </span>
                        <h4 className="text-xs font-black text-ink">{c.title}</h4>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold uppercase text-slate-500">
                          {c.messageType}
                        </span>
                        {c.status === 'completed' && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700">
                            Completed ✅
                          </span>
                        )}
                        {c.status === 'running' && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9.5px] font-bold text-blue-700 animate-pulse">
                            Running 🚀
                          </span>
                        )}
                        {c.status === 'paused' && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9.5px] font-bold text-amber-700">
                            Paused ⏸️
                          </span>
                        )}
                        {c.status === 'stopped' && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9.5px] font-bold text-rose-700">
                            Stopped 🛑
                          </span>
                        )}
                      </div>

                      <p className="line-clamp-1 text-xs text-slate-600 font-medium">
                        {c.text}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>তারিখ: {formatDate(c.createdAt)}</span>
                        <span>• টার্গেট: <b className="text-ink">{c.totalTarget}</b></span>
                        <span>• Sent: <b className="text-emerald-600">{c.sentCount}</b></span>
                        <span>• Failed: <b className="text-rose-600">{c.failedCount}</b></span>
                        <span>• অগ্রগতি: <b className="text-ink">{percent}%</b></span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {c.status === 'paused' && (
                        <button
                          type="button"
                          onClick={() => handleResumeBroadcast(c)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          <Play className="h-3 w-3" />
                          <span>চালান</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActiveCampaign(c);
                          setViewTab('progress');
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        বিস্তারিত
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReuseCampaign(c)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        title="Re-send"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCampaign(c.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
