import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  RotateCcw,
  Ban,
  Check,
  Trash2,
  X,
  Plus,
  Edit2,
  Search,
  Eye,
  EyeOff,
  UserCheck,
  DollarSign,
  Users,
  CreditCard,
  Copy,
  ExternalLink,
  Save,
  KeyRound,
  RefreshCw,
  Radio,
  Send,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useAppStore } from '../contexts/AuthContext';
import { appStore, generateId } from '../lib/store';
import { formatDate } from '../lib/format';
import {
  syncUserToFirebase,
  syncWithdrawalToFirebase,
  syncConfigToFirebase,
  subscribeAllUsers,
  subscribeAllWithdrawals,
  subscribeAllReferrals,
  fetchAllUsers,
  deleteUserFromFirebase,
  deleteWithdrawalFromFirebase
} from '../lib/firebase';
import type { AppConfig, User, Withdrawal, RequiredChannel } from '../types';

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'channels', label: '📢 Channels Gate (অন/অফ)' },
  { id: 'users', label: 'Users' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'ads', label: 'Ad Slots' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'posts', label: 'Posts' },
  { id: 'settings', label: 'Settings' }
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]['id'];

const STORAGE_ADMIN_SESSION = "c2c_admin_ok";
const DEFAULT_PIN_HASH = "48e6f958531e543731746fd0a4fcba173e2ae226d60eb19a5d021be3c29f7a3e";

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function Admin() {
  const db = useAppStore();
  const [unlocked, setUnlocked] = useState<boolean>(
    () => sessionStorage.getItem(STORAGE_ADMIN_SESSION) === "1"
  );
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Search & Filter States
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<'all' | 'verified' | 'banned'>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Withdrawal States
  const [wdFilter, setWdFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [wdSearch, setWdSearch] = useState("");
  const [editingWd, setEditingWd] = useState<Withdrawal | null>(null);

  // Password Change State
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");

  // Live Firebase Sync States
  const [syncing, setSyncing] = useState(false);
  const [liveUserCount, setLiveUserCount] = useState<number | null>(null);

  // Telegram Channel Management States
  const [editingChannel, setEditingChannel] = useState<RequiredChannel | null>(null);
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [newChannelData, setNewChannelData] = useState<{
    name: string;
    tag: string;
    subtitle: string;
    username: string;
    url: string;
  }>({
    name: '',
    tag: 'Channel',
    subtitle: '',
    username: '',
    url: ''
  });
  const [channelTestStatus, setChannelTestStatus] = useState<Record<string, { loading: boolean; ok?: boolean; message?: string }>>({});

  // Subscribe to real-time Firebase users, withdrawals, and referrals
  useEffect(() => {
    if (!unlocked) return;

    // Initial fetch from Firebase Realtime Database
    fetchAllUsers().then((remoteUsers) => {
      const usersMap = remoteUsers || {};
      const keys = Object.keys(usersMap);
      setLiveUserCount(keys.length);
      appStore.update((d) => {
        d.users = usersMap;
      });
    });

    // Real-time listener for users
    const unsubUsers = subscribeAllUsers((remoteUsers) => {
      const usersMap = remoteUsers || {};
      const keys = Object.keys(usersMap);
      setLiveUserCount(keys.length);
      appStore.update((d) => {
        d.users = usersMap;
      });
    });

    // Real-time listener for withdrawals
    const unsubWds = subscribeAllWithdrawals((remoteWds) => {
      appStore.update((d) => {
        d.withdrawals = remoteWds || [];
      });
    });

    // Real-time listener for referrals
    const unsubRefs = subscribeAllReferrals((remoteRefs) => {
      appStore.update((d) => {
        d.referrals = remoteRefs || [];
      });
    });

    return () => {
      unsubUsers();
      unsubWds();
      unsubRefs();
    };
  }, [unlocked]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const remoteUsers = await fetchAllUsers();
      const usersMap = remoteUsers || {};
      const keys = Object.keys(usersMap);
      setLiveUserCount(keys.length);
      appStore.update((d) => {
        d.users = usersMap;
      });
      toast.success(`ফায়ারবেস থেকে ${keys.length} জন ইউজার লাইভ সিঙ্ক হয়েছে!`);
    } catch {
      toast.error("সিঙ্ক ব্যর্থ হয়েছে");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteUser = async (u: User) => {
    const displayName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || u.telegramId;
    if (!window.confirm(`⚠️ আপনি কি নিশ্চিত ইউজার "${displayName}" (TID: ${u.telegramId})-কে ফায়ারবেস থেকে মুছে ফেলতে চান?\n\nমুছে ফেললে ফায়ারবেস থেকে তার সমস্ত তথ্য, ব্যালেন্স ও উইথড্রয়াল মুছে যাবে। পরবর্তীতে সে আবার সাইটে প্রবেশ করলে তাকে সম্পূর্ণ নতুন ইউজার হিসেবে গণ্য করা হবে।`)) {
      return;
    }

    try {
      // 1. Delete permanently from Firebase Realtime Database
      await deleteUserFromFirebase(u.telegramId);

      // 2. Remove from local store immediately
      appStore.update((d) => {
        delete d.users[u.telegramId];
        d.withdrawals = d.withdrawals.filter((w) => w.telegramId !== u.telegramId);
      });

      toast.success(`ইউজার "${displayName}" ফায়ারবেস থেকে সফলভাবে মুছে ফেলা হয়েছে!`);
    } catch (err) {
      console.error(err);
      toast.error("ইউজার ডিলিট করা সম্ভব হয়নি");
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    const hash = await sha256(passwordInput.trim());
    const expectedHash = db.config.adminPinHash || DEFAULT_PIN_HASH;

    if (hash === expectedHash) {
      sessionStorage.setItem(STORAGE_ADMIN_SESSION, "1");
      setUnlocked(true);
      toast.success("অ্যাডমিন প্যানেলে স্বাগতম!");
    } else {
      toast.error("ভুল সিকিউরিটি পিন!");
      setPasswordInput("");
    }
  };

  if (!unlocked) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-slate-900 px-6">
        <Toaster position="top-center" richColors />
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-[20rem] rounded-3xl bg-slate-800/90 p-7 text-center border border-slate-700/60 shadow-2xl backdrop-blur-xl"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-lg font-extrabold text-white">Admin Access</h1>
          <p className="mt-1 text-xs text-slate-400">Enter security PIN to manage system</p>
          
          <div className="relative mt-5">
            <input
              type={showPassword ? "text" : "password"}
              inputMode="numeric"
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••"
              className="h-11 w-full rounded-xl bg-slate-900/80 px-4 text-center text-lg font-mono tracking-widest text-white outline-none border border-slate-700 focus:border-brand-500 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <button
            type="submit"
            className="mt-4 h-11 w-full rounded-xl bg-brand-500 text-sm font-bold text-white hover:bg-brand-600 transition shadow-lg shadow-brand-500/20 active:scale-98"
          >
            Unlock Panel
          </button>
        </form>
      </main>
    );
  }

  const usersList = Object.values(db.users);
  const cfg = db.config;

  const filteredUsers = usersList.filter((u) => {
    const term = userSearch.toLowerCase().trim();
    const matchSearch =
      !term ||
      u.telegramId.includes(term) ||
      u.firstName.toLowerCase().includes(term) ||
      u.lastName.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      (u.binanceId && u.binanceId.toLowerCase().includes(term));

    if (!matchSearch) return false;
    if (userFilter === 'verified') return u.verified;
    if (userFilter === 'banned') return u.banned;
    return true;
  });

  const filteredWithdrawals = db.withdrawals.filter((w) => {
    const term = wdSearch.toLowerCase().trim();
    const matchSearch =
      !term ||
      w.telegramId.includes(term) ||
      w.name.toLowerCase().includes(term) ||
      w.account.toLowerCase().includes(term);

    if (!matchSearch) return false;
    if (wdFilter === 'all') return true;
    return w.status === wdFilter;
  });

  const updateConfig = (patch: Partial<AppConfig>) => {
    appStore.update((draft) => {
      Object.assign(draft.config, patch);
    });
    const updatedCfg = appStore.get().config;
    syncConfigToFirebase(updatedCfg);
    toast.success("Settings updated & synced!");
  };

  const testChannelBot = async (ch: RequiredChannel) => {
    if (!ch.username) return;
    setChannelTestStatus((prev) => ({ ...prev, [ch.id]: { loading: true } }));
    const token = cfg.botToken;
    try {
      const cleanUser = ch.username.replace(/^@/, '').trim();
      const res = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=@${encodeURIComponent(cleanUser)}`);
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setChannelTestStatus((prev) => ({
          ...prev,
          [ch.id]: { loading: false, ok: true, message: `সংযুক্ত: "${data.result?.title}"` }
        }));
        toast.success(`চ্যানেল কানেক্টেড: ${data.result?.title}`);
      } else {
        setChannelTestStatus((prev) => ({
          ...prev,
          [ch.id]: { loading: false, ok: false, message: data.description || "অ্যাক্সেস করা যায়নি" }
        }));
        toast.error(`এরর: ${data.description}`);
      }
    } catch (e: any) {
      setChannelTestStatus((prev) => ({
        ...prev,
        [ch.id]: { loading: false, ok: false, message: e.message || "নেটওয়ার্ক ত্রুটি" }
      }));
      toast.error("নেটওয়ার্ক ত্রুটি");
    }
  };

  const handleSaveChannel = (channel: RequiredChannel) => {
    const list = [...(cfg.requiredChannels || [])];
    const idx = list.findIndex((c) => c.id === channel.id);
    if (idx !== -1) {
      list[idx] = channel;
    } else {
      list.push(channel);
    }
    updateConfig({ requiredChannels: list });
    setEditingChannel(null);
    toast.success("চ্যানেল সফলভাবে আপডেট হয়েছে!");
  };

  const handleCreateChannel = () => {
    if (!newChannelData.name.trim() || !newChannelData.username.trim()) {
      toast.error("নাম ও ইউজারনেম আবশ্যক!");
      return;
    }
    const cleanUsername = newChannelData.username.replace(/^@/, '').trim();
    const cleanUrl = newChannelData.url.trim() || `https://t.me/${cleanUsername}`;
    const newChan: RequiredChannel = {
      id: generateId("ch"),
      name: newChannelData.name.trim(),
      tag: newChannelData.tag.trim() || "Channel",
      subtitle: newChannelData.subtitle.trim() || "Updates & News",
      username: cleanUsername,
      url: cleanUrl
    };

    const list = [...(cfg.requiredChannels || []), newChan];
    updateConfig({ requiredChannels: list });
    setIsAddingChannel(false);
    setNewChannelData({ name: '', tag: 'Channel', subtitle: '', username: '', url: '' });
    toast.success("নতুন চ্যানেল সফলভাবে যুক্ত হয়েছে!");
  };

  const handleDeleteChannel = (id: string) => {
    if (!confirm("আপনি কি নিশ্চিত এই চ্যানেলটি মুছে ফেলতে চান?")) return;
    const list = (cfg.requiredChannels || []).filter((c) => c.id !== id);
    updateConfig({ requiredChannels: list });
    toast.info("চ্যানেল মুছে ফেলা হয়েছে!");
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPinInput.trim() || !newPinInput.trim()) {
      toast.error("সবগুলো ঘর পূরণ করুন");
      return;
    }

    const curHash = await sha256(currentPinInput.trim());
    const expectedHash = db.config.adminPinHash || DEFAULT_PIN_HASH;

    if (curHash !== expectedHash) {
      toast.error("বর্তমান সিকিউরিটি পিন সঠিক নয়");
      return;
    }

    if (newPinInput.trim().length < 4) {
      toast.error("নতুন পিন নূন্যতম ৪ সংখ্যার হতে হবে");
      return;
    }

    const newHash = await sha256(newPinInput.trim());
    updateConfig({ adminPinHash: newHash });
    setCurrentPinInput("");
    setNewPinInput("");
    toast.success("অ্যাডমিন সিকিউরিটি পিন সফলভাবে পরিবর্তন হয়েছে!");
  };

  return (
    <main className="min-h-screen w-full bg-slate-100 pb-20 text-ink">
      <Toaster position="top-center" richColors />

      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-slate-900 px-4 py-2.5 text-white shadow-md">
        <ShieldCheck className="h-5 w-5 text-brand-400" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate">
            {cfg.appName} • Admin Panel
          </h1>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Sync active {liveUserCount !== null ? `(${liveUserCount} Firebase users)` : ""}</span>
          </div>
        </div>

        <button
          onClick={handleManualSync}
          disabled={syncing}
          title="Refresh from Firebase"
          className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-brand-400" : ""}`} />
          <span className="hidden sm:inline">Sync</span>
        </button>

        <button
          onClick={() => {
            sessionStorage.removeItem(STORAGE_ADMIN_SESSION);
            setUnlocked(false);
          }}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          Lock
        </button>
      </header>

      {/* Admin Nav Tabs */}
      <nav className="no-scrollbar sticky top-[48px] z-20 flex gap-1.5 overflow-x-auto bg-white px-3 py-2 shadow-sm border-b border-slate-200">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === tab.id
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Body */}
      <div className="space-y-4 p-3 max-w-5xl mx-auto">
        {/* 1. OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <MetricCard label="Total Users" value={String(usersList.length)} />
            <MetricCard
              label="User Balances"
              value={`$${usersList.reduce((acc, u) => acc + (u.balance || 0), 0).toFixed(2)}`}
            />
            <MetricCard label="Total Referrals" value={String(db.referrals.length)} />
            <MetricCard
              label="Pending Withdrawals"
              value={String(db.withdrawals.filter((w) => w.status === 'pending').length)}
              tone="text-amber-600"
            />
            <MetricCard label="Community Posts" value={String(db.posts.length)} />
            <MetricCard label="Earning Logs" value={String(db.logs.length)} />
            <MetricCard label="Active Ad Slots" value={String(cfg.adSlots.length)} />
            <MetricCard label="Tasks" value={String(cfg.tasks.length)} />
          </div>
        )}

        {/* 2. USERS */}
        {activeTab === 'users' && (
          <SectionCard
            title={`Users Management (${usersList.length} জন)`}
            action={
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Firebase Synced ({liveUserCount || usersList.length})
                </span>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition"
                  title="ফায়ারবেস থেকে লাইভ ডাটা রিফ্রেশ করুন"
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-brand-500' : ''}`} />
                  <span>{syncing ? 'সিঙ্ক হচ্ছে...' : 'রিফ্রেশ'}</span>
                </button>
              </div>
            }
          >
            {/* Filters & Search */}
            <div className="mb-3 flex flex-wrap gap-2 items-center justify-between">
              <div className="relative flex-1 min-w-[12rem]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, Telegram ID, or address..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="h-8 w-full rounded-xl bg-slate-50 pl-8 pr-3 text-xs outline-none border border-slate-200 focus:border-brand-500 focus:bg-white transition"
                />
              </div>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                {(['all', 'verified', 'banned'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setUserFilter(filter)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition ${
                      userFilter === filter
                        ? 'bg-white text-ink shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 border-b border-slate-200">
                  <tr>
                    <TableHeaderCell>User</TableHeaderCell>
                    <TableHeaderCell>Telegram ID</TableHeaderCell>
                    <TableHeaderCell>Balance ($)</TableHeaderCell>
                    <TableHeaderCell>Refs (L1/L2)</TableHeaderCell>
                    <TableHeaderCell>Payout Account / Number</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredUsers.map((u) => (
                    <tr key={u.telegramId} className="hover:bg-slate-50/80 transition">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img
                            src={u.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80"}
                            alt={u.firstName}
                            className="h-7 w-7 rounded-full object-cover bg-slate-100"
                          />
                          <div>
                            <p className="font-bold text-ink">
                              {u.firstName} {u.lastName}
                            </p>
                            {u.username && (
                              <p className="text-[10px] text-slate-400">@{u.username}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-slate-600 font-medium">
                        {u.telegramId}
                      </TableCell>
                      <TableCell>
                        <span className="font-extrabold text-emerald-600 text-[13px]">
                          ${u.balance.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-brand-600">{u.referralCount}</span>
                        <span className="text-slate-400 font-normal"> / {u.level2Count || 0}</span>
                      </TableCell>
                      <TableCell>
                        {u.binanceId ? (
                          <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            {u.binanceId}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {u.verified && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700">
                              VERIFIED
                            </span>
                          )}
                          {u.banned && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-700">
                              BANNED
                            </span>
                          )}
                          {!u.verified && !u.banned && (
                            <span className="text-[10px] text-slate-400 font-medium">Active</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <IconButton
                            title="Edit User Details (Balance, Referrals, Address)"
                            tone="bg-brand-500"
                            onClick={() => setEditingUser({ ...u })}
                          >
                            <Edit2 className="h-3 w-3" />
                          </IconButton>
                          <IconButton
                            title={u.banned ? "Unban User" : "Ban User"}
                            tone={u.banned ? "bg-emerald-500" : "bg-rose-500"}
                            onClick={() => {
                              let updated: User | null = null;
                              appStore.update((d) => {
                                if (d.users[u.telegramId]) {
                                  d.users[u.telegramId].banned = !u.banned;
                                  updated = { ...d.users[u.telegramId] };
                                }
                              });
                              if (updated) syncUserToFirebase(updated);
                              toast.info(u.banned ? "ইউজার আনব্যান করা হয়েছে" : "ইউজার ব্যান করা হয়েছে");
                            }}
                          >
                            <Ban className="h-3 w-3" />
                          </IconButton>
                          <IconButton
                            title="Toggle Verified Badge"
                            tone={u.verified ? "bg-amber-600" : "bg-slate-400"}
                            onClick={() => {
                              let updated: User | null = null;
                              appStore.update((d) => {
                                if (d.users[u.telegramId]) {
                                  d.users[u.telegramId].verified = !u.verified;
                                  updated = { ...d.users[u.telegramId] };
                                }
                              });
                              if (updated) syncUserToFirebase(updated);
                              toast.success("ভেরিফাইড স্ট্যাটাস আপডেট হয়েছে");
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </IconButton>
                          <IconButton
                            title="Delete User from Database (মুছে ফেলুন)"
                            tone="bg-rose-600 hover:bg-rose-700"
                            onClick={() => handleDeleteUser(u)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </IconButton>
                        </div>
                      </TableCell>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        কোনো ইউজার পাওয়া যায়নি।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* TELEGRAM CHANNELS MANAGEMENT */}
        {activeTab === 'channels' && (
          <SectionCard title="Telegram Verification Channels & Bot Surveillance">
            {/* Master Force Verification Switch */}
            <div className={`mb-4 rounded-2xl p-4 border transition-all ${
              cfg.forceChannelVerification !== false
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-rose-50/70 border-rose-200'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className={`h-5 w-5 ${
                      cfg.forceChannelVerification !== false ? 'text-emerald-600' : 'text-rose-500'
                    }`} />
                    <h4 className="text-sm font-bold text-slate-800">
                      চ্যানেল ভেরিফিকেশন গেট (Master Switch)
                    </h4>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                      cfg.forceChannelVerification !== false
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-rose-600 text-white shadow-xs'
                    }`}>
                      {cfg.forceChannelVerification !== false ? 'সক্রিয় (ON)' : 'নিষ্ক্রিয় (OFF)'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {cfg.forceChannelVerification !== false
                      ? '✅ ভেরিফিকেশন চালু রয়েছে: ইউজার সবকটি চ্যানেলে জয়েন না থাকলে ওয়েবসাইট লক থাকবে এবং ২৫ সেকেন্ড পর পর লাইভ নজরদারি চলবে।'
                      : '⛔ ভেরিফিকেশন বন্ধ রয়েছে: কোনো ইউজারকে চ্যানেল জয়েন করতে হবে না, সবাই সরাসরি ওয়েবসাইটে ঢুকতে পারবে।'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextVal = cfg.forceChannelVerification === false;
                    updateConfig({ forceChannelVerification: nextVal });
                    if (nextVal) {
                      toast.success("✅ চ্যানেল ভেরিফিকেশন সফলভাবে চালু করা হয়েছে!");
                    } else {
                      toast.info("⛔ চ্যানেল ভেরিফিকেশন বন্ধ করা হয়েছে!");
                    }
                  }}
                  className={`rounded-xl px-5 py-2.5 text-xs font-black text-white transition shadow-md active:scale-95 ${
                    cfg.forceChannelVerification !== false
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                  }`}
                >
                  {cfg.forceChannelVerification !== false
                    ? '🔴 ভেরিফিকেশন বন্ধ করুন (Turn OFF)'
                    : '🟢 ভেরিফিকেশন চালু করুন (Turn ON)'}
                </button>
              </div>
            </div>

            {/* Channels Header & Add Button */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-700">
                  বাধ্যতামূলক চ্যানেলের তালিকা ({cfg.requiredChannels?.length || 0} টি)
                </h4>
                <p className="text-[11px] text-slate-400">
                  নিচের চ্যানেলগুলোতে ইউজারকে বাধ্যতামূলক জয়েন করতে হবে
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingChannel(true)}
                className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-600 transition shadow-sm active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>+ চ্যানেল অ্যাড করুন (Add)</span>
              </button>
            </div>

            {/* Channels List */}
            <div className="space-y-3">
              {(cfg.requiredChannels || []).map((ch) => {
                const testStatus = channelTestStatus[ch.id];

                return (
                  <div
                    key={ch.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white p-3.5 border border-slate-200 shadow-xs hover:border-slate-300 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-red-500 to-red-700 text-white shadow-xs">
                        <Send className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="truncate text-xs font-bold text-slate-800">
                            {ch.name} <span className="text-brand-500">{ch.tag || 'Channel'}</span>
                          </h5>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                            @{ch.username}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-slate-400 mt-0.5">
                          {ch.subtitle || 'No subtitle'}
                        </p>
                        <a
                          href={ch.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[10px] text-brand-600 hover:underline"
                        >
                          <span>{ch.url}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </div>

                    {/* Actions and Status */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Test Bot Connection Button */}
                      <button
                        type="button"
                        disabled={testStatus?.loading}
                        onClick={() => testChannelBot(ch)}
                        className="flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition"
                        title="বটের চ্যানেল অ্যাক্সেস টেস্ট করুন"
                      >
                        {testStatus?.loading ? (
                          <RefreshCw className="h-3 w-3 animate-spin text-slate-500" />
                        ) : testStatus?.ok ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Radio className="h-3 w-3 text-brand-500" />
                        )}
                        <span>{testStatus?.loading ? 'টেস্ট হচ্ছে...' : 'Test Bot'}</span>
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => setEditingChannel({ ...ch })}
                        className="flex items-center gap-1 rounded-lg bg-brand-50 hover:bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Edit</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteChannel(ch.id)}
                        className="flex items-center gap-1 rounded-lg bg-rose-50 hover:bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-600 transition"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {(cfg.requiredChannels || []).length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
                  <p className="text-xs">কোনো চ্যানেল সেট করা হয়নি। 'Add Channel' বাটনে চাপ দিয়ে চ্যানেল যুক্ত করুন।</p>
                </div>
              )}
            </div>

            {/* Instruction Callout for Admin */}
            <div className="mt-4 rounded-xl bg-amber-50 p-3 border border-amber-200/80">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 leading-relaxed">
                  <span className="font-bold">গুরুত্বপূর্ণ নির্দেশনা:</span> বটের মাধ্যমে স্বয়ংক্রিয়ভাবে মেম্বারশিপ যাচাই ও ২৪/৭ নজরদারির জন্য আপনার টেলিগ্রাম বট{' '}
                  <span className="font-bold font-mono text-amber-900">@{cfg.botUsername}</span>-কে প্রতিটি চ্যানেলে অবশ্যই{' '}
                  <span className="font-bold underline">Administrator (অ্যাডমিন)</span> হিসেবে অ্যাড করতে হবে।
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* 3. WITHDRAWALS */}
        {activeTab === 'withdrawals' && (
          <SectionCard title={`Withdrawal Requests (${db.withdrawals.length})`}>
            {/* Filters & Search */}
            <div className="mb-3 flex flex-wrap gap-2 items-center justify-between">
              <div className="relative flex-1 min-w-[12rem]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search account number, name, or TID..."
                  value={wdSearch}
                  onChange={(e) => setWdSearch(e.target.value)}
                  className="h-8 w-full rounded-xl bg-slate-50 pl-8 pr-3 text-xs outline-none border border-slate-200 focus:border-brand-500 focus:bg-white transition"
                />
              </div>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setWdFilter(filter)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition ${
                      wdFilter === filter
                        ? 'bg-white text-ink shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Withdrawals List */}
            <ul className="space-y-2.5">
              {filteredWithdrawals.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3.5 border border-slate-200 shadow-xs"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 p-1 border border-slate-200 shrink-0">
                    {w.method.toLowerCase().includes('bkash') ? (
                      <img src="https://i.ibb.co.com/0VQMxDL6/images.png" alt="bKash" className="h-6 w-6 object-contain" />
                    ) : w.method.toLowerCase().includes('nagad') ? (
                      <img src="https://i.ibb.co.com/MzvRGdq/images.jpg" alt="Nagad" className="h-6 w-6 object-contain" />
                    ) : (
                      <img src="https://i.ibb.co.com/pjs0BQNc/images-1.png" alt="Binance" className="h-6 w-6 object-contain" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-ink">
                        ${w.amount.toFixed(2)} USDT
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold uppercase tracking-wider text-[9px] ${
                          w.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : w.status === 'rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {w.status}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-700 font-medium">
                      {w.name} • TID: <span className="font-mono text-slate-500">{w.telegramId}</span>
                    </p>

                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400">Payment Number / Address:</span>
                      <span className="font-mono text-xs font-black text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                        {w.account}
                      </span>
                      <button
                        title="Copy payment address"
                        onClick={() => {
                          navigator.clipboard.writeText(w.account);
                          toast.success("Account number copied!");
                        }}
                        className="text-slate-400 hover:text-ink transition"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="mt-1 text-[10px] text-slate-400">
                      {w.method} • {formatDate(w.createdAt)}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <IconButton
                      title="Edit Payment Details, Amount or Status"
                      tone="bg-brand-500"
                      onClick={() => setEditingWd({ ...w })}
                    >
                      <Edit2 className="h-3 w-3" />
                    </IconButton>

                    {w.status === 'pending' && (
                      <>
                        <IconButton
                          title="Approve Withdrawal"
                          tone="bg-emerald-500"
                          onClick={() => {
                            let updatedWd: Withdrawal | null = null;
                            appStore.update((d) => {
                              const target = d.withdrawals.find((item) => item.id === w.id);
                              if (target) {
                                target.status = "approved";
                                updatedWd = { ...target };
                              }
                            });
                            if (updatedWd) syncWithdrawalToFirebase(updatedWd);
                            toast.success(`উইথড্র $${w.amount.toFixed(2)} অ্যাপ্রুভ করা হয়েছে!`);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </IconButton>

                        <IconButton
                          title="Reject & Refund Balance"
                          tone="bg-rose-500"
                          onClick={() => {
                            let updatedWd: Withdrawal | null = null;
                            let updatedUser: User | null = null;
                            appStore.update((d) => {
                              const target = d.withdrawals.find((item) => item.id === w.id);
                              if (target) {
                                target.status = "rejected";
                                const u = d.users[target.telegramId];
                                if (u) {
                                  u.balance += target.amount;
                                  updatedUser = { ...u };
                                }
                                updatedWd = { ...target };
                              }
                            });
                            if (updatedWd) syncWithdrawalToFirebase(updatedWd);
                            if (updatedUser) syncUserToFirebase(updatedUser);
                            toast.error(`উইথড্র রিজেক্ট হয়েছে এবং ব্যালেন্স $${w.amount.toFixed(2)} রিফান্ড করা হয়েছে।`);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </IconButton>
                      </>
                    )}

                    <IconButton
                      title="Delete Withdrawal Record"
                      tone="bg-rose-500 hover:bg-rose-600"
                      onClick={async () => {
                        if (confirm("⚠️ আপনি কি নিশ্চিত এই উইথড্রয়াল রেকর্ডটি ফায়ারবেস থেকে মুছে ফেলতে চান?")) {
                          await deleteWithdrawalFromFirebase(w.id);
                          appStore.update((d) => {
                            d.withdrawals = d.withdrawals.filter((item) => item.id !== w.id);
                          });
                          toast.success("উইথড্রয়াল রেকর্ড ফায়ারবেস থেকে সফলভাবে মুছে ফেলা হয়েছে");
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </IconButton>
                  </div>
                </li>
              ))}
              {filteredWithdrawals.length === 0 && (
                <EmptyRow message="কোনো উইথড্রয়াল আবেদন পাওয়া যায়নি।" />
              )}
            </ul>
          </SectionCard>
        )}

        {/* 4. AD SLOTS */}
        {activeTab === 'ads' && (
          <SectionCard
            title="Monetag Ad Slots"
            action={
              <AddButton
                onClick={() => {
                  appStore.update((d) => {
                    const count = d.config.adSlots.length + 1;
                    d.config.adSlots.push({
                      id: `slot${Date.now()}`,
                      title: `AD SLOT ${count}`,
                      zone: "10635966",
                      reward: 0.05
                    });
                  });
                }}
              />
            }
          >
            <div className="space-y-2">
              {cfg.adSlots.map((slot, idx) => (
                <div key={slot.id} className="grid grid-cols-12 gap-1.5 items-center">
                  <InputText
                    className="col-span-4"
                    value={slot.title}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.adSlots[idx].title = val;
                      });
                    }}
                  />
                  <InputText
                    className="col-span-4"
                    value={slot.zone}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.adSlots[idx].zone = val;
                      });
                    }}
                  />
                  <InputText
                    className="col-span-3"
                    value={String(slot.reward)}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.adSlots[idx].reward = Number(val) || 0;
                      });
                    }}
                  />
                  <IconButton
                    title="Delete Slot"
                    tone="bg-rose-500"
                    onClick={() => {
                      appStore.update((d) => {
                        d.config.adSlots.splice(idx, 1);
                      });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </IconButton>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* 5. TASKS */}
        {activeTab === 'tasks' && (
          <SectionCard
            title="Direct Link Tasks"
            action={
              <AddButton
                onClick={() => {
                  appStore.update((d) => {
                    d.config.tasks.push({
                      id: generateId("task"),
                      title: "New Video Task",
                      url: "https://ads.ziniyaapu7.workers.dev/",
                      reward: 0.05,
                      minSeconds: 60,
                      maxMinutes: 5
                    });
                  });
                }}
              />
            }
          >
            <div className="space-y-2">
              {cfg.tasks.map((task, idx) => (
                <div key={task.id} className="grid grid-cols-12 gap-1.5 items-center">
                  <InputText
                    className="col-span-3"
                    value={task.title}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.tasks[idx].title = val;
                      });
                    }}
                  />
                  <InputText
                    className="col-span-5"
                    value={task.url}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.tasks[idx].url = val;
                      });
                    }}
                  />
                  <InputText
                    className="col-span-3"
                    value={String(task.reward)}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.tasks[idx].reward = Number(val) || 0;
                      });
                    }}
                  />
                  <IconButton
                    title="Delete Task"
                    tone="bg-rose-500"
                    onClick={() => {
                      appStore.update((d) => {
                        d.config.tasks.splice(idx, 1);
                      });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </IconButton>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* 6. POSTS */}
        {activeTab === 'posts' && (
          <SectionCard title={`Community Posts (${db.posts.length})`}>
            <ul className="space-y-2">
              {db.posts.map((post) => (
                <li
                  key={post.id}
                  className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-200"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{post.authorName}</p>
                    <p className="truncate text-slate-500">{post.text || "(Photo attachment)"}</p>
                  </div>
                  <IconButton
                    title="Delete Post"
                    tone="bg-rose-500"
                    onClick={() => {
                      appStore.update((d) => {
                        d.posts = d.posts.filter((p) => p.id !== post.id);
                      });
                      toast.success("Post removed");
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </IconButton>
                </li>
              ))}
              {db.posts.length === 0 && <EmptyRow message="ফিডে কোনো পোস্ট নেই।" />}
            </ul>
          </SectionCard>
        )}

        {/* 7. SETTINGS */}
        {activeTab === 'settings' && (
          <>
            <SectionCard title="Bot & Application Setup">
              <div className="grid grid-cols-2 gap-3">
                <TextConfig
                  label="App Name"
                  value={cfg.appName}
                  onChange={(v) => updateConfig({ appName: v })}
                />
                <TextConfig
                  label="Bot Username (without @)"
                  value={cfg.botUsername}
                  onChange={(v) => updateConfig({ botUsername: v })}
                />
                <div className="col-span-2">
                  <TextConfig
                    label="Bot Token (Telegram API Bot Token)"
                    value={cfg.botToken}
                    onChange={(v) => updateConfig({ botToken: v })}
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Active Token: {cfg.botToken ? `${cfg.botToken.slice(0, 15)}...${cfg.botToken.slice(-6)}` : "Not set"}
                  </p>
                </div>
                <TextConfig
                  label="Support Telegram Link"
                  value={cfg.supportUrl}
                  onChange={(v) => updateConfig({ supportUrl: v })}
                />
                <TextConfig
                  label="ImgBB API Key"
                  value={cfg.imgbbApiKey}
                  onChange={(v) => updateConfig({ imgbbApiKey: v })}
                />
              </div>
            </SectionCard>

            <SectionCard title="Economics & Withdrawal Limits">
              <div className="grid grid-cols-2 gap-3">
                <NumberConfig
                  label="Referral Bonus ($)"
                  step={0.01}
                  value={cfg.referralBonus}
                  onChange={(v) => updateConfig({ referralBonus: v })}
                />
                <NumberConfig
                  label="Level 2 Referral Bonus ($)"
                  step={0.01}
                  value={cfg.level2Bonus}
                  onChange={(v) => updateConfig({ level2Bonus: v })}
                />
                <NumberConfig
                  label="Minimum Withdrawal ($)"
                  step={1}
                  value={cfg.minWithdraw}
                  onChange={(v) => updateConfig({ minWithdraw: v })}
                />
                <NumberConfig
                  label="Required Referrals for Withdrawal"
                  step={1}
                  value={cfg.minReferralsForWithdraw}
                  onChange={(v) => updateConfig({ minReferralsForWithdraw: v })}
                />
              </div>
            </SectionCard>

            {/* Change Admin PIN */}
            <SectionCard title="Security PIN (Password)">
              <form onSubmit={handleChangePin} className="space-y-3 max-w-sm">
                <p className="text-xs text-slate-500">
                  নিরাপত্তার স্বার্থে কোনো পাসওয়ার্ড ডিসপ্লে করা হয় না। নতুন পিন সেট করতে বর্তমান পিন দিন।
                </p>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Current PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Current PIN"
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">New PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="New PIN (min 4 digits)"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black transition shadow-sm"
                >
                  <KeyRound className="h-3.5 w-3.5" /> Update Security PIN
                </button>
              </form>
            </SectionCard>
          </>
        )}
      </div>

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-ink">Edit User Details</h3>
                <p className="text-[11px] text-slate-400">
                  {editingUser.firstName} {editingUser.lastName} (TID: {editingUser.telegramId})
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              {/* Balance Editing & Quick Modifiers */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  User Balance ($ USDT)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={editingUser.balance}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, balance: Number(e.target.value) })
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-base font-bold text-emerald-600 outline-none focus:border-brand-500"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[1, 5, 10, 20].map((amt) => (
                    <button
                      key={`add-${amt}`}
                      type="button"
                      onClick={() =>
                        setEditingUser({
                          ...editingUser,
                          balance: Number((editingUser.balance + amt).toFixed(2))
                        })
                      }
                      className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100"
                    >
                      +${amt}
                    </button>
                  ))}
                  {[1, 5, 10].map((amt) => (
                    <button
                      key={`sub-${amt}`}
                      type="button"
                      onClick={() =>
                        setEditingUser({
                          ...editingUser,
                          balance: Math.max(0, Number((editingUser.balance - amt).toFixed(2)))
                        })
                      }
                      className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 border border-rose-200/60 hover:bg-rose-100"
                    >
                      -${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Referrals Editing (Level 1 & Level 2) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Level 1 Referrals
                  </label>
                  <input
                    type="number"
                    value={editingUser.referralCount}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        referralCount: Math.max(0, parseInt(e.target.value, 10) || 0)
                      })
                    }
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-brand-600 outline-none focus:border-brand-500"
                  />
                  <div className="mt-1.5 flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingUser({
                          ...editingUser,
                          referralCount: editingUser.referralCount + 1
                        })
                      }
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingUser({
                          ...editingUser,
                          referralCount: editingUser.referralCount + 5
                        })
                      }
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingUser({
                          ...editingUser,
                          referralCount: Math.max(0, editingUser.referralCount - 1)
                        })
                      }
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                    >
                      -1
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Level 2 Referrals
                  </label>
                  <input
                    type="number"
                    value={editingUser.level2Count || 0}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        level2Count: Math.max(0, parseInt(e.target.value, 10) || 0)
                      })
                    }
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-500"
                  />
                  <div className="mt-1.5 flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingUser({
                          ...editingUser,
                          level2Count: (editingUser.level2Count || 0) + 1
                        })
                      }
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingUser({
                          ...editingUser,
                          level2Count: Math.max(0, (editingUser.level2Count || 0) - 1)
                        })
                      }
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                    >
                      -1
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment Number / Address Editing */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Payment Number / Account (bKash/Nagad/Binance ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 017XXXXXXXX or Binance Pay ID"
                  value={editingUser.binanceId || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, binanceId: e.target.value })
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-mono font-semibold text-ink outline-none focus:border-brand-500"
                />
              </div>

              {/* Status Toggles */}
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingUser.verified}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, verified: e.target.checked })
                    }
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">Verified User</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingUser.banned}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, banned: e.target.checked })
                    }
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-semibold text-rose-700">Banned Account</span>
                </label>
              </div>

              {/* Modal Save Button */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const toSave = { ...editingUser };
                    appStore.update((d) => {
                      d.users[toSave.telegramId] = toSave;
                    });
                    await syncUserToFirebase(toSave);
                    toast.success("ইউজার ডাটা ও ব্যালেন্স সফলভাবে আপডেট ও ফায়ারবেসে সিঙ্ক হয়েছে!");
                    setEditingUser(null);
                  }}
                  className="flex-1 rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-white hover:bg-brand-600 transition shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT WITHDRAWAL MODAL */}
      {editingWd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-ink">Edit Withdrawal Details</h3>
                <p className="text-[11px] text-slate-400">
                  {editingWd.name} • TID: {editingWd.telegramId}
                </p>
              </div>
              <button
                onClick={() => setEditingWd(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 pt-4">
              {/* Payment Number / Address */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Payment Number / Account (যে নাম্বারে পেমেন্ট যাবে)
                </label>
                <input
                  type="text"
                  value={editingWd.account}
                  onChange={(e) => setEditingWd({ ...editingWd, account: e.target.value })}
                  placeholder="017XXXXXXXX or Binance Pay ID"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-mono font-bold text-brand-700 outline-none focus:border-brand-500"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Withdrawal Amount ($ USDT)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingWd.amount}
                  onChange={(e) => setEditingWd({ ...editingWd, amount: Number(e.target.value) })}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-emerald-600 outline-none focus:border-brand-500"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Payment Method
                </label>
                <select
                  value={editingWd.method}
                  onChange={(e) => setEditingWd({ ...editingWd, method: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs text-ink outline-none focus:border-brand-500 bg-white"
                >
                  <option value="Binance (USDT BEP20)">Binance (USDT BEP20)</option>
                  <option value="bKash Personal">bKash Personal</option>
                  <option value="Nagad Personal">Nagad Personal</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Request Status
                </label>
                <select
                  value={editingWd.status}
                  onChange={(e) =>
                    setEditingWd({
                      ...editingWd,
                      status: e.target.value as Withdrawal['status']
                    })
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs text-ink outline-none focus:border-brand-500 bg-white"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved (Paid)</option>
                  <option value="rejected">Rejected (Refunded)</option>
                </select>
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingWd(null)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    let savedWd: Withdrawal | null = null;
                    appStore.update((d) => {
                      const idx = d.withdrawals.findIndex((item) => item.id === editingWd.id);
                      if (idx !== -1) {
                        d.withdrawals[idx] = { ...editingWd };
                        savedWd = { ...editingWd };
                      }
                    });
                    if (savedWd) syncWithdrawalToFirebase(savedWd);
                    toast.success("উইথড্রয়াল আবেদন সফলভাবে আপডেট ও সিঙ্ক হয়েছে!");
                    setEditingWd(null);
                  }}
                  className="flex-1 rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-white hover:bg-brand-600 transition shadow-sm"
                >
                  Save Withdrawal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CHANNEL MODAL */}
      {editingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-ink">Edit Required Channel</h3>
                <p className="text-[11px] text-slate-400">
                  @{editingChannel.username}
                </p>
              </div>
              <button
                onClick={() => setEditingChannel(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Channel Name (নাম)
                  </label>
                  <input
                    type="text"
                    value={editingChannel.name}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, name: e.target.value })
                    }
                    placeholder="e.g. Main"
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tag / Type
                  </label>
                  <input
                    type="text"
                    value={editingChannel.tag || ''}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, tag: e.target.value })
                    }
                    placeholder="e.g. Channel"
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Subtitle (সাবটাইটেল)
                </label>
                <input
                  type="text"
                  value={editingChannel.subtitle || ''}
                  onChange={(e) =>
                    setEditingChannel({ ...editingChannel, subtitle: e.target.value })
                  }
                  placeholder="e.g. All Videos • Updates • News"
                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Telegram Username (@ ছাড়া)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">@</span>
                  <input
                    type="text"
                    value={editingChannel.username}
                    onChange={(e) =>
                      setEditingChannel({
                        ...editingChannel,
                        username: e.target.value.replace(/^@/, '').trim()
                      })
                    }
                    placeholder="jgjghjghh687"
                    className="h-9 w-full rounded-xl border border-slate-200 pl-7 pr-3 text-xs font-mono outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Full Telegram URL (লিংক)
                </label>
                <input
                  type="url"
                  value={editingChannel.url}
                  onChange={(e) =>
                    setEditingChannel({ ...editingChannel, url: e.target.value.trim() })
                  }
                  placeholder="https://t.me/jgjghjghh687"
                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingChannel(null)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveChannel(editingChannel)}
                  className="flex-1 rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-white hover:bg-brand-600 transition shadow-sm"
                >
                  Save Channel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD CHANNEL MODAL */}
      {isAddingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-ink">Add Required Channel</h3>
                <p className="text-[11px] text-slate-400">
                  নতুন চ্যানেল যুক্ত করুন যা ইউজারদের জন্য বাধ্যতামূলক হবে
                </p>
              </div>
              <button
                onClick={() => setIsAddingChannel(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Channel Name (নাম)
                  </label>
                  <input
                    type="text"
                    value={newChannelData.name}
                    onChange={(e) =>
                      setNewChannelData({ ...newChannelData, name: e.target.value })
                    }
                    placeholder="e.g. Support"
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tag / Type
                  </label>
                  <input
                    type="text"
                    value={newChannelData.tag}
                    onChange={(e) =>
                      setNewChannelData({ ...newChannelData, tag: e.target.value })
                    }
                    placeholder="e.g. Channel"
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Subtitle (সাবটাইটেল)
                </label>
                <input
                  type="text"
                  value={newChannelData.subtitle}
                  onChange={(e) =>
                    setNewChannelData({ ...newChannelData, subtitle: e.target.value })
                  }
                  placeholder="e.g. Help • Support • Updates"
                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Telegram Username (@ ছাড়া)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">@</span>
                  <input
                    type="text"
                    value={newChannelData.username}
                    onChange={(e) => {
                      const u = e.target.value.replace(/^@/, '').trim();
                      setNewChannelData({
                        ...newChannelData,
                        username: u,
                        url: u ? `https://t.me/${u}` : newChannelData.url
                      });
                    }}
                    placeholder="ManeiShopBD_Support"
                    className="h-9 w-full rounded-xl border border-slate-200 pl-7 pr-3 text-xs font-mono outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Full Telegram URL (লিংক)
                </label>
                <input
                  type="url"
                  value={newChannelData.url}
                  onChange={(e) =>
                    setNewChannelData({ ...newChannelData, url: e.target.value.trim() })
                  }
                  placeholder="https://t.me/ManeiShopBD_Support"
                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingChannel(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateChannel}
                  className="flex-1 rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-white hover:bg-brand-600 transition shadow-sm"
                >
                  Create Channel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone = "text-ink"
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-xs">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  children,
  action
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function TableHeaderCell({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 font-bold uppercase tracking-wider text-[10px]">{children}</th>;
}

function TableCell({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}

function InputText({
  value,
  onChange,
  className = ""
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 rounded-lg border border-slate-200 px-2 text-xs text-ink outline-none focus:border-brand-500 ${className}`}
    />
  );
}

function TextConfig({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-ink outline-none focus:border-brand-500"
      />
    </label>
  );
}

function NumberConfig({
  label,
  value,
  onChange,
  step = 1
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-ink outline-none focus:border-brand-500"
      />
    </label>
  );
}

function IconButton({
  children,
  onClick,
  tone,
  title
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: string;
  title: string;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-lg text-white transition hover:opacity-90 active:scale-95 shadow-xs ${tone}`}
    >
      {children}
    </button>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 shadow-xs"
    >
      <Plus className="h-3.5 w-3.5" /> Add New
    </button>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <li className="py-6 text-center text-xs text-slate-400">{message}</li>;
}
