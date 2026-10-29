import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { User, AppConfig, AdSlot, Task, PendingAction } from '../types';
import { appStore, loginOrRegisterUser, creditUserEarning, getTodayDateString } from '../lib/store';
import {
  subscribeToFirebaseUser,
  subscribeConfig,
  syncUserToFirebase,
  subscribeAllReferrals,
  subscribeAllUsers
} from '../lib/firebase';
import {
  initTelegramWebApp,
  getTelegramInitData,
  getTelegramUser,
  getReferralStartParam,
  triggerHaptic,
  openExternalLink,
  getTelegramWebApp,
  checkTelegramMembership
} from '../lib/telegram';

export interface SessionNotice {
  type: 'early_exit' | 'expired' | 'success';
  title: string;
  stayedSeconds: number;
  remainingSeconds: number;
  reward?: number;
  label: string;
}

interface AuthContextType {
  status: 'idle' | 'connecting' | 'verifying' | 'success' | 'ready' | 'error';
  statusLabel: string;
  error: string | null;
  user: User | null;
  config: AppConfig;
  inTelegram: boolean;
  retry: () => void;
  demoLogin: () => void;
  logout: () => void;
  startAd: (slot: AdSlot) => Promise<void>;
  startTask: (task: Task) => Promise<void>;
  claimPendingReward: (isManual?: boolean) => Promise<void>;
  cancelPendingAction: () => void;
  pending: PendingAction | null;
  pendingSecondsElapsed: number;
  pendingMinSeconds: number;
  isClaimReady: boolean;
  sessionNotice: SessionNotice | null;
  clearSessionNotice: () => void;
  adsWatchedToday: number;
  slotCountToday: (slotId: string) => number;
  slotCountThisHour: (slotId: string) => number;
  totalAdsWatchedThisHour: number;
  hourlyLimitPerSlot: number;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_PENDING = "c2c_pending_session";
const STORAGE_TID = "c2c_session_tid";

export function useAppStore() {
  return React.useSyncExternalStore(appStore.subscribe, appStore.get, appStore.get);
}

export function getCurrentHourString(): string {
  return new Date().toISOString().slice(0, 13); // e.g. "2026-10-02T14"
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const db = useAppStore();
  const config = db.config;

  const [status, setStatus] = useState<AuthContextType['status']>(() => {
    try {
      const savedTid = localStorage.getItem(STORAGE_TID);
      if (savedTid && appStore.get().users[savedTid]) {
        return 'ready';
      }
    } catch {}
    return 'idle';
  });
  const [statusLabel, setStatusLabel] = useState<string>('Connecting Telegram...');
  const [error, setError] = useState<string | null>(null);
  const [sessionTid, setSessionTid] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_TID);
    } catch {
      return null;
    }
  });
  const [inTelegram, setInTelegram] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(() => getPendingAction());
  const [pendingElapsed, setPendingElapsed] = useState<number>(0);
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null);
  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);
  const initRef = useRef(false);

  const currentUser = sessionTid ? db.users[sessionTid] ?? null : null;
  const hourlyLimitPerSlot = config.adHourlyLimitPerSlot || 10;

  const performLogin = useCallback(async () => {
    setError(null);
    const hasExistingSession = !!(sessionTid && db.users[sessionTid]);
    if (!hasExistingSession) {
      setStatus('connecting');
      setStatusLabel('Connecting Telegram...');
    }

    const tg = await initTelegramWebApp();
    setInTelegram(!!tg);

    // Request write access only if supported by Telegram WebApp version 6.9+
    try {
      if (
        tg &&
        typeof (tg as any).requestWriteAccess === 'function' &&
        typeof tg.isVersionAtLeast === 'function' &&
        tg.isVersionAtLeast('6.9')
      ) {
        (tg as any).requestWriteAccess();
      }
    } catch {}

    const initData = getTelegramInitData();
    const tgUser = getTelegramUser();
    const refStartParam = getReferralStartParam();

    if (!tg || (!initData && !tgUser)) {
      // If outside Telegram and demo login is enabled, auto-activate demo user or show friendly gate
      if (config.allowDemoLogin) {
        if (!hasExistingSession) {
          setStatus('connecting');
          setStatusLabel('Connecting session...');
        }
        const demoId = localStorage.getItem("c2c_demo_id") || "724910385";
        localStorage.setItem("c2c_demo_id", demoId);

        const demoUser = await loginOrRegisterUser({
          id: Number(demoId),
          first_name: "Demo",
          last_name: "User",
          username: "demo_user",
          photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        }, refStartParam);

        localStorage.setItem(STORAGE_TID, demoUser.telegramId);
        setSessionTid(demoUser.telegramId);
        setStatus('ready');
        return;
      }

      if (!hasExistingSession) {
        setStatus('error');
        setError('Telegram session not found. Please open inside Telegram Mini App.');
      }
      return;
    }

    if (!hasExistingSession) {
      setStatus('verifying');
      setStatusLabel('Verifying Account...');
    }

    try {
      const userToRegister = tgUser || {
        id: 700000000 + Math.floor(Math.random() * 99999999),
        first_name: "Telegram",
        last_name: "User",
        username: "tg_user"
      };

      const user = await loginOrRegisterUser(userToRegister, refStartParam);
      if (user.banned) {
        setStatus('error');
        setError('Your account is banned. Contact support for assistance.');
        return;
      }

      localStorage.setItem(STORAGE_TID, user.telegramId);
      setSessionTid(user.telegramId);
      setStatus('ready');
    } catch (err) {
      console.error(err);
      if (!hasExistingSession) {
        setStatus('error');
        setError('Authentication failed. Please try again.');
      }
    }
  }, [config.allowDemoLogin, sessionTid, db.users]);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      performLogin();
    }
  }, [performLogin]);

  // Real-time listener for remote Firebase user changes
  useEffect(() => {
    if (!sessionTid) return;
    const unsubscribe = subscribeToFirebaseUser(sessionTid, (remote) => {
      if (!remote) {
        // User was deleted by admin from Firebase
        localStorage.removeItem(STORAGE_TID);
        appStore.update((draft) => {
          delete draft.users[sessionTid];
        });
        setSessionTid(null);
        setStatus('error');
        setError('আপনার পূর্বের একাউন্টটি মুছে ফেলা হয়েছে। পুনরায় প্রবেশ করতে "Try Again" চাপলে আপনাকে সম্পূর্ণ নতুন ইউজার হিসেবে গ্রহণ করা হবে।');
        return;
      }

      appStore.update((draft) => {
        const cur = draft.users[sessionTid];
        draft.users[sessionTid] = {
          ...(cur || {}),
          ...remote,
          balance: Number(Math.max(Number(cur?.balance || 0), Number(remote.balance || 0)).toFixed(2)),
          lifetimeEarned: Number(Math.max(Number(cur?.lifetimeEarned || 0), Number(remote.lifetimeEarned || 0)).toFixed(2)),
          todayEarned: Number(Math.max(Number(cur?.todayEarned || 0), Number(remote.todayEarned || 0)).toFixed(2)),
          adsWatchedToday: Math.max(Number(cur?.adsWatchedToday || 0), Number(remote.adsWatchedToday || 0)),
          referralCount: Math.max(Number(cur?.referralCount || 0), Number(remote.referralCount || 0))
        } as User;
      });

      if (remote.banned) {
        setStatus('error');
        setError('Your account is banned. Contact support for assistance.');
      } else if (remote.banned === false && status === 'error' && error?.includes('banned')) {
        setStatus('ready');
        setError(null);
      }
    });
    return () => unsubscribe();
  }, [sessionTid, status, error]);

  // Real-time listener for remote AppConfig updates from Firebase RTDB
  useEffect(() => {
    const unsub = subscribeConfig((remoteCfg) => {
      if (remoteCfg && typeof remoteCfg === 'object') {
        appStore.update((d) => {
          d.config = { ...d.config, ...remoteCfg };
        });
      }
    });
    return () => unsub();
  }, []);

  // Real-time listener for referrals tracking
  useEffect(() => {
    const unsub = subscribeAllReferrals((remoteRefs) => {
      if (Array.isArray(remoteRefs)) {
        appStore.update((d) => {
          d.referrals = remoteRefs;
        });
      }
    });
    return () => unsub();
  }, []);

  // Real-time listener for all genuine users from Firebase RTDB (for Leaderboard/RankList)
  useEffect(() => {
    const unsub = subscribeAllUsers((remoteUsers) => {
      if (remoteUsers && typeof remoteUsers === 'object') {
        appStore.update((d) => {
          const fakeIds = new Set(["984210452", "742189301", "610928374", "528401923", "419401859"]);
          // Purge fake users
          for (const fid of fakeIds) {
            delete d.users[fid];
          }
          for (const [uid, u] of Object.entries(remoteUsers)) {
            if (!fakeIds.has(uid) && u && u.telegramId) {
              const cur = d.users[uid];
              d.users[uid] = {
                ...(cur || {}),
                ...u,
                balance: Number(Math.max(Number(cur?.balance || 0), Number(u.balance || 0)).toFixed(2)),
                lifetimeEarned: Number(Math.max(Number(cur?.lifetimeEarned || 0), Number(u.lifetimeEarned || 0)).toFixed(2)),
                todayEarned: Number(Math.max(Number(cur?.todayEarned || 0), Number(u.todayEarned || 0)).toFixed(2)),
                adsWatchedToday: Math.max(Number(cur?.adsWatchedToday || 0), Number(u.adsWatchedToday || 0)),
                referralCount: Math.max(Number(cur?.referralCount || 0), Number(u.referralCount || 0))
              };
            }
          }
        });
      }
    });
    return () => unsub();
  }, []);

  // 24/7 Channel Membership Background Surveillance
  // Automatically detects if a previously verified user leaves any required channel!
  useEffect(() => {
    if (!currentUser || !currentUser.verified || config.forceChannelVerification === false) {
      return;
    }

    const channels = config.requiredChannels || [];
    if (channels.length === 0) return;

    const checkChannelStatus = async () => {
      for (const ch of channels) {
        if (!ch.username) continue;
        try {
          const res = await checkTelegramMembership(ch.username, currentUser.telegramId);
          // Only revoke if Telegram confirmed user has left or been kicked
          if (res.ok && res.status && (res.status === 'left' || res.status === 'kicked')) {
            console.warn(`[Surveillance] User ${currentUser.telegramId} left @${ch.username}! Revoking access.`);
            appStore.update((draft) => {
              const u = draft.users[currentUser.telegramId];
              if (u) {
                u.verified = false;
              }
            });
            syncUserToFirebase({ ...currentUser, verified: false });
            triggerHaptic('error');
            toast.error(`⚠️ আপনি '${ch.name}' চ্যানেলে নেই! ওয়েবসাইট ব্যবহার করার জন্য আবার জয়েন করে ভেরিফাই করুন।`);
            break;
          }
        } catch {
          // Ignore network glitch
        }
      }
    };

    // Check immediately when user switches back to the tab/app
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkChannelStatus();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Periodic surveillance check every 35 seconds
    const interval = setInterval(checkChannelStatus, 35000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [currentUser?.telegramId, currentUser?.verified, config.forceChannelVerification, config.requiredChannels]);

  const handleDemoLogin = useCallback(async () => {
    setStatus('verifying');
    setStatusLabel('Verifying Account...');
    await new Promise((r) => setTimeout(r, 400));
    const demoId = localStorage.getItem("c2c_demo_id") || String(700000000 + Math.floor(Math.random() * 99999999));
    localStorage.setItem("c2c_demo_id", demoId);
    const refStartParam = getReferralStartParam();

    const user = await loginOrRegisterUser({
      id: Number(demoId),
      first_name: "Demo",
      last_name: "User",
      username: "demo_user",
      photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    }, refStartParam);

    localStorage.setItem(STORAGE_TID, user.telegramId);
    setSessionTid(user.telegramId);
    setStatus('success');
    setStatusLabel('Login Successful');
    setTimeout(() => setStatus('ready'), 400);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(STORAGE_TID);
    localStorage.removeItem(STORAGE_PENDING);
    setSessionTid(null);
    setPending(null);
    setStatus('error');
    setError('Logged out. Please log in again.');
  }, []);

  const claimPendingReward = useCallback(async (isManual: boolean = false) => {
    const act = getPendingAction();
    if (!act || !sessionTid) return;

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - act.startedAt) / 1000));
    const minSeconds = act.minSeconds || 60;
    const maxSeconds = (act.maxMinutes || 6) * 60;

    // 1. User returned before minimum 1 minute (60 seconds):
    // IMMEDIATELY CANCEL, DO NOT CREDIT, AND SHOW NOTICE!
    if (elapsedSeconds < minSeconds) {
      const stayed = Math.max(1, elapsedSeconds);
      const remaining = Math.max(1, minSeconds - stayed);

      clearPendingAction();
      setPending(null);
      setPendingElapsed(0);
      triggerHaptic('error');

      setSessionNotice({
        type: 'early_exit',
        title: '⚠️ সেশন বাতিল হয়েছে!',
        stayedSeconds: stayed,
        remainingSeconds: remaining,
        label: act.label
      });

      toast.error('⚠️ সেশন বাতিল! নতুন করে কাজ শুরু করুন', {
        description: `আপনি সাইটে ছিলেন ${stayed} সেকেন্ড, এখনো ${remaining} সেকেন্ড বাকি ছিল। ৬০ সেকেন্ডের আগে ফিরে আসায় কোনো টাকা যোগ হয়নি।`,
        duration: 8000
      });
      return;
    }

    // 2. User returned after maximum 6 minutes (expired):
    if (elapsedSeconds > maxSeconds) {
      clearPendingAction();
      setPending(null);
      setPendingElapsed(0);
      triggerHaptic('error');

      setSessionNotice({
        type: 'expired',
        title: '⚠️ সেশন এক্সপায়ার হয়েছে!',
        stayedSeconds: elapsedSeconds,
        remainingSeconds: 0,
        label: act.label
      });

      toast.error('⚠️ সেশন এক্সপায়ার হয়েছে!', {
        description: 'বিজ্ঞাপনে যাওয়ার পর সর্বোচ্চ ৬ মিনিটের মধ্যে ফিরে আসতে হবে। অতিরিক্ত সময় পার হওয়ায় সেশন বাতিল করা হয়েছে।',
        duration: 8000
      });
      return;
    }

    // 3. User stayed full 60 seconds and returned within 6 minutes (SUCCESS!):
    clearPendingAction();
    setPending(null);
    setPendingElapsed(0);

    const updated = await creditUserEarning(sessionTid, act.kind, act.label, act.reward);
    if (updated) {
      triggerHaptic('success');

      setSessionNotice({
        type: 'success',
        title: '🎉 রিওয়ার্ড সফলভাবে যোগ হয়েছে!',
        stayedSeconds: elapsedSeconds,
        remainingSeconds: 0,
        reward: act.reward,
        label: act.label
      });

      toast.success(`🎉 +$${act.reward.toFixed(2)} মূল ব্যালেন্সে যোগ হয়েছে!`, {
        description: `${act.label} সফলভাবে সম্পন্ন হয়েছে। বর্তমান ব্যালেন্স: $${updated.balance.toFixed(2)} USDT`,
        duration: 7000
      });
    }
  }, [sessionTid]);

  const cancelPendingAction = useCallback(() => {
    clearPendingAction();
    setPending(null);
    setPendingElapsed(0);
    toast.info('বিজ্ঞাপন সেশন বাতিল করা হয়েছে।');
  }, []);

  // When user returns to app from external website, immediately verify session
  useEffect(() => {
    const handleReturn = () => {
      if (document.visibilityState === 'visible') {
        const act = getPendingAction();
        if (act && sessionTid) {
          claimPendingReward(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('focus', handleReturn);

    return () => {
      document.removeEventListener('visibilitychange', handleReturn);
      window.removeEventListener('focus', handleReturn);
    };
  }, [claimPendingReward, sessionTid]);

  // Check on initial app load if pending action exists in storage
  useEffect(() => {
    if (status === 'ready' && sessionTid) {
      const act = getPendingAction();
      if (act) {
        claimPendingReward(false);
      }
    }
  }, [status, sessionTid, claimPendingReward]);

  const slotCountToday = useCallback(
    (slotId: string): number => {
      if (!sessionTid) return 0;
      const today = getTodayDateString();
      return db.logs.filter(
        (log) =>
          log.telegramId === sessionTid &&
          log.kind === 'ad' &&
          log.label.includes(slotId) &&
          log.createdAt.slice(0, 10) === today
      ).length;
    },
    [db.logs, sessionTid]
  );

  const slotCountThisHour = useCallback(
    (slotId: string): number => {
      if (!sessionTid) return 0;
      const currentHour = getCurrentHourString();
      return db.logs.filter(
        (log) =>
          log.telegramId === sessionTid &&
          log.kind === 'ad' &&
          log.label.includes(slotId) &&
          log.createdAt.slice(0, 13) === currentHour
      ).length;
    },
    [db.logs, sessionTid]
  );

  const totalAdsWatchedThisHour = useCallback((): number => {
    if (!sessionTid) return 0;
    const currentHour = getCurrentHourString();
    return db.logs.filter(
      (log) =>
        log.telegramId === sessionTid &&
        log.kind === 'ad' &&
        log.createdAt.slice(0, 13) === currentHour
    ).length;
  }, [db.logs, sessionTid])();

  const adsWatchedToday =
    currentUser?.todayDate === getTodayDateString() ? currentUser.adsWatchedToday : 0;

  const startAd = useCallback(
    async (slot: AdSlot) => {
      if (!sessionTid) return;
      const countThisHour = slotCountThisHour(slot.id);
      if (countThisHour >= hourlyLimitPerSlot) {
        toast.error(`এই বক্সে এই ঘণ্টার লিমিট শেষ (${hourlyLimitPerSlot}/${hourlyLimitPerSlot})!`, {
          description: 'পরবর্তী ঘণ্টায় আবার দেখতে পারবেন।'
        });
        return;
      }

      // Both buttons redirect directly to the requested worker URL without Monetag popup
      const targetAdUrl = "https://ads.ziniyaapu7.workers.dev/";
      const requiredSeconds = 60; // 1 minute required on ad site
      const maxMinutes = 6; // 6 minutes limit to return

      const action: PendingAction = {
        kind: 'ad',
        refId: slot.id,
        label: `${slot.title} (${slot.id})`,
        reward: slot.reward,
        minSeconds: requiredSeconds,
        maxMinutes: maxMinutes,
        startedAt: Date.now()
      };

      savePendingAction(action);
      setPending(action);
      setPendingElapsed(0);
      triggerHaptic('medium');

      toast('বিজ্ঞাপন ভিজিট শুরু হয়েছে', {
        description: 'বিজ্ঞাপনের লিঙ্কে নূন্যতম ১ মিনিট (৬০ সেকেন্ড) থাকুন। ১ মিনিট সম্পন্ন হলে টাকা ব্যালেন্সে যোগ হবে।'
      });

      openExternalLink(targetAdUrl);
    },
    [sessionTid, slotCountThisHour, hourlyLimitPerSlot]
  );

  const startTask = useCallback(
    async (task: Task) => {
      if (!sessionTid) return;

      const targetTaskUrl = task.url || "https://ads.ziniyaapu7.workers.dev/";
      const rewardAmt = Number(task.reward) || 0.05;
      const minSecs = Number((task as any).minSeconds) || Number(config.adMinSeconds) || 60;
      const maxMins = Number((task as any).maxMinutes) || Number(config.adMaxMinutes) || 6;

      const action: PendingAction = {
        kind: 'task',
        refId: task.id,
        label: task.title,
        reward: rewardAmt,
        minSeconds: minSecs,
        maxMinutes: maxMins,
        startedAt: Date.now()
      };

      savePendingAction(action);
      setPending(action);
      setPendingElapsed(0);
      triggerHaptic('medium');

      toast.info('⏱️ টাস্ক কাউন্টার শুরু হয়েছে', {
        description: `${task.title} শুরু হয়েছে। ৬০ সেকেন্ড কাউন্টার শেষে মূল ব্যালেন্সে +$${rewardAmt.toFixed(2)} USDT যোগ হবে।`
      });

      openExternalLink(targetTaskUrl);
    },
    [sessionTid, config.adMinSeconds, config.adMaxMinutes]
  );

  useEffect(() => {
    if (status === 'ready') {
      getTelegramWebApp()?.expand?.();
    }
  }, [status]);

  const value: AuthContextType = {
    status,
    statusLabel,
    error,
    user: currentUser,
    config,
    inTelegram,
    retry: performLogin,
    demoLogin: handleDemoLogin,
    logout: handleLogout,
    startAd,
    startTask,
    claimPendingReward,
    cancelPendingAction,
    pending,
    pendingSecondsElapsed: pendingElapsed,
    pendingMinSeconds: pending?.minSeconds || 60,
    isClaimReady: Boolean(pending && pendingElapsed >= (pending?.minSeconds || 60)),
    sessionNotice,
    clearSessionNotice,
    adsWatchedToday,
    slotCountToday,
    slotCountThisHour,
    totalAdsWatchedThisHour,
    hourlyLimitPerSlot
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

function getPendingAction(): PendingAction | null {
  try {
    const raw = localStorage.getItem(STORAGE_PENDING);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePendingAction(act: PendingAction): void {
  localStorage.setItem(STORAGE_PENDING, JSON.stringify(act));
}

function clearPendingAction(): void {
  localStorage.removeItem(STORAGE_PENDING);
}
