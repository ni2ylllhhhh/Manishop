import type { AppConfig, AppDatabase, User, Referral, Withdrawal, Post, EarningLog } from '../types';
import {
  syncUserToFirebase,
  fetchUserFromFirebase,
  syncWithdrawalToFirebase,
  syncReferralToFirebase
} from './firebase';

export const defaultConfig: AppConfig = {
  appName: "ManeiShopBD",
  botUsername: "ManeiShopBD_Bot",
  botToken: "",
  supportUrl: "https://t.me/ManeiShopBD_Site",
  imgbbApiKey: "f7be34ce0b6f4d15277479fb781d6607",
  adminPassword: "445566",
  allowDemoLogin: true,
  adSlots: [
    { id: "slot1", title: "AD SLOT 1", zone: "10635966", reward: 0.05 },
    { id: "slot2", title: "AD SLOT 2", zone: "10635966", reward: 0.05 }
  ],
  adMinSeconds: 60,
  adMaxMinutes: 5,
  adDailyLimitPerSlot: 200,
  adHourlyLimitPerSlot: 10,
  tasks: [
    { id: "t1", title: "Video watch 1", url: "https://ads.ziniyaapu7.workers.dev/", reward: 0.05, minSeconds: 60, maxMinutes: 5 },
    { id: "t2", title: "Video track 2", url: "https://ads.ziniyaapu7.workers.dev/", reward: 0.05, minSeconds: 60, maxMinutes: 5 },
    { id: "t3", title: "Video tax 3", url: "https://ads.ziniyaapu7.workers.dev/", reward: 0.05, minSeconds: 60, maxMinutes: 5 },
    { id: "t4", title: "Special task 4", url: "https://ads.ziniyaapu7.workers.dev/", reward: 0.05, minSeconds: 60, maxMinutes: 5 }
  ],
  referralBonus: 0.5,
  level2Bonus: 0.1,
  minWithdraw: 5,
  minReferralsForWithdraw: 15,
  withdrawAmounts: [5, 10, 15, 30, 60, 100]
};

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function generateId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const STORAGE_KEY = "maneishopbd_db";

const initialSeedUsers: Record<string, User> = {
  "984210452": {
    telegramId: "984210452",
    username: "tanvir_pro",
    firstName: "Tanvir",
    lastName: "Hossain",
    photoUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    bio: "Top crypto earner & trader | Click2Cash Diamond member",
    balance: 84.50,
    lifetimeEarned: 182.40,
    todayEarned: 3.25,
    todayDate: getTodayDateString(),
    adsWatchedToday: 4,
    referralCount: 68,
    level2Count: 142,
    referralEarned: 48.20,
    referredBy: null,
    binanceId: "84729104",
    following: [],
    verified: true,
    banned: false,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    lastLogin: new Date().toISOString()
  },
  "742189301": {
    telegramId: "742189301",
    username: "rashid_bd",
    firstName: "Rashid",
    lastName: "Khan",
    photoUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
    bio: "Daily task worker. Fast withdrawal guarantee!",
    balance: 52.80,
    lifetimeEarned: 134.75,
    todayEarned: 2.10,
    todayDate: getTodayDateString(),
    adsWatchedToday: 5,
    referralCount: 42,
    level2Count: 88,
    referralEarned: 29.80,
    referredBy: "984210452",
    binanceId: "19402834",
    following: ["984210452"],
    verified: true,
    banned: false,
    createdAt: new Date(Date.now() - 24 * 86400000).toISOString(),
    lastLogin: new Date().toISOString()
  },
  "610928374": {
    telegramId: "610928374",
    username: "sultana_earn",
    firstName: "Sultana",
    lastName: "Begum",
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    bio: "Online freelance earner | USDT withdrawal verified",
    balance: 31.40,
    lifetimeEarned: 96.20,
    todayEarned: 1.85,
    todayDate: getTodayDateString(),
    adsWatchedToday: 3,
    referralCount: 29,
    level2Count: 54,
    referralEarned: 19.90,
    referredBy: "742189301",
    binanceId: "93847102",
    following: [],
    verified: true,
    banned: false,
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    lastLogin: new Date().toISOString()
  },
  "528401923": {
    telegramId: "528401923",
    username: "arif_earn",
    firstName: "Ariful",
    lastName: "Islam",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    bio: "Student & part-time earner",
    balance: 18.25,
    lifetimeEarned: 67.50,
    todayEarned: 1.20,
    todayDate: getTodayDateString(),
    adsWatchedToday: 4,
    referralCount: 18,
    level2Count: 22,
    referralEarned: 11.20,
    referredBy: "984210452",
    binanceId: "62910482",
    following: [],
    verified: false,
    banned: false,
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    lastLogin: new Date().toISOString()
  },
  "419204859": {
    telegramId: "419204859",
    username: "mehedi_dev",
    firstName: "Mehedi",
    lastName: "Hasan",
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    bio: "Watch ads & daily tasks lover",
    balance: 14.10,
    lifetimeEarned: 48.90,
    todayEarned: 0.90,
    todayDate: getTodayDateString(),
    adsWatchedToday: 2,
    referralCount: 16,
    level2Count: 19,
    referralEarned: 9.90,
    referredBy: "742189301",
    binanceId: "49201948",
    following: [],
    verified: false,
    banned: false,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    lastLogin: new Date().toISOString()
  }
};

const initialSeedPosts: Post[] = [
  {
    id: "post_seed_1",
    authorId: "984210452",
    authorName: "Tanvir Hossain",
    authorPhoto: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    text: "Just received another $30 USDT payout in my Binance account! Thanks Click2Cash team for super fast payment. 🔥💰",
    imageUrl: null,
    likes: ["742189301", "610928374", "528401923"],
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
  },
  {
    id: "post_seed_2",
    authorId: "742189301",
    authorName: "Rashid Khan",
    authorPhoto: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
    text: "Tip for everyone: Complete all 3 video tasks daily and invite active members to reach your 15 referral target quickly!",
    imageUrl: null,
    likes: ["984210452"],
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString()
  }
];

const initialDatabase: AppDatabase = {
  rev: 0,
  users: initialSeedUsers,
  referrals: [
    {
      id: "ref_seed_1",
      referrerTelegramId: "984210452",
      referredTelegramId: "742189301",
      level: 1,
      bonus: 0.50,
      createdAt: new Date(Date.now() - 24 * 86400000).toISOString()
    },
    {
      id: "ref_seed_2",
      referrerTelegramId: "742189301",
      referredTelegramId: "610928374",
      level: 1,
      bonus: 0.50,
      createdAt: new Date(Date.now() - 18 * 86400000).toISOString()
    },
    {
      id: "ref_seed_3",
      referrerTelegramId: "984210452",
      referredTelegramId: "610928374",
      level: 2,
      bonus: 0.10,
      createdAt: new Date(Date.now() - 18 * 86400000).toISOString()
    }
  ],
  withdrawals: [
    {
      id: "wd_seed_1",
      telegramId: "984210452",
      name: "Tanvir Hossain",
      amount: 30,
      method: "Binance (USDT BEP20)",
      account: "84729104",
      status: "approved",
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      id: "wd_seed_2",
      telegramId: "742189301",
      name: "Rashid Khan",
      amount: 15,
      method: "Binance (USDT BEP20)",
      account: "19402834",
      status: "approved",
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
    }
  ],
  posts: initialSeedPosts,
  logs: [
    {
      id: "log_seed_1",
      telegramId: "984210452",
      kind: "ad",
      label: "AD SLOT 1 (slot1)",
      amount: 0.05,
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: "log_seed_2",
      telegramId: "984210452",
      kind: "task",
      label: "Video watch",
      amount: 0.05,
      createdAt: new Date(Date.now() - 7200000).toISOString()
    }
  ],
  config: defaultConfig
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function loadInitialData(): AppDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(initialDatabase);
    const parsed = JSON.parse(raw);
    const mergedConfig: AppConfig = { ...defaultConfig, ...(parsed.config || {}) };
    mergedConfig.appName = "ManeiShopBD";
    mergedConfig.adMinSeconds = 60;
    mergedConfig.adHourlyLimitPerSlot = 10;
    
    // Ensure all 4 tasks use the requested link
    mergedConfig.tasks = defaultConfig.tasks;

    return {
      ...deepClone(initialDatabase),
      ...parsed,
      users: { ...initialSeedUsers, ...(parsed.users || {}) },
      config: mergedConfig
    };
  } catch {
    return deepClone(initialDatabase);
  }
}

export async function sendTelegramBotMessage(
  botToken: string,
  chatId: string | number,
  text: string
): Promise<boolean> {
  if (!botToken || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML"
      })
    });
    return res.ok;
  } catch (err) {
    console.warn("Failed to send telegram bot message:", err);
    return false;
  }
}

let currentDb: AppDatabase = loadInitialData();
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((fn) => fn());
}

function persistLocally() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentDb));
  } catch (err) {
    console.error("Local persistence error:", err);
  }
}

export const appStore = {
  get(): AppDatabase {
    return currentDb;
  },
  subscribe(fn: () => void): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
  update(updater: (draft: AppDatabase) => void): AppDatabase {
    const draft = deepClone(currentDb);
    updater(draft);
    draft.rev = currentDb.rev + 1;
    currentDb = draft;
    persistLocally();
    notifySubscribers();
    return currentDb;
  },
  reset(): void {
    currentDb = {
      ...deepClone(initialDatabase),
      rev: currentDb.rev + 1
    };
    persistLocally();
    notifySubscribers();
  }
};

export async function loginOrRegisterUser(
  telegramUser: {
    id: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  },
  referredBy?: string | null
): Promise<User> {
  const tid = String(telegramUser.id);
  const now = new Date().toISOString();
  let user: User;
  let parentToSync: User | null = null;
  let refToSync: Referral | null = null;

  // Check remote Firebase Firestore first if exists
  let remoteUser: User | null = null;
  try {
    remoteUser = await fetchUserFromFirebase(tid);
  } catch {}

  appStore.update((db) => {
    let existing = db.users[tid];
    if (!existing && remoteUser) {
      existing = { ...remoteUser };
      db.users[tid] = existing;
    }
    const cleanReferrer = referredBy && referredBy !== tid ? String(referredBy).trim() : null;

    if (existing) {
      existing.firstName = telegramUser.first_name || existing.firstName;
      existing.lastName = telegramUser.last_name || existing.lastName;
      existing.username = telegramUser.username || existing.username;
      if (telegramUser.photo_url && !existing.photoUrl.startsWith("http")) {
        existing.photoUrl = telegramUser.photo_url;
      }
      existing.lastLogin = now;
      if (existing.todayDate !== getTodayDateString()) {
        existing.todayDate = getTodayDateString();
        existing.todayEarned = 0;
        existing.adsWatchedToday = 0;
      }

      // If user wasn't referred before and now came with referral link
      if (!existing.referredBy && cleanReferrer && cleanReferrer !== tid) {
        existing.referredBy = cleanReferrer;
        if (!db.users[cleanReferrer]) {
          db.users[cleanReferrer] = {
            telegramId: cleanReferrer,
            username: `user_${cleanReferrer}`,
            firstName: `User ${cleanReferrer}`,
            lastName: "",
            photoUrl: "",
            bio: "",
            balance: 0,
            lifetimeEarned: 0,
            todayEarned: 0,
            todayDate: getTodayDateString(),
            adsWatchedToday: 0,
            referralCount: 0,
            level2Count: 0,
            referralEarned: 0,
            referredBy: null,
            binanceId: "",
            following: [],
            verified: false,
            banned: false,
            createdAt: now,
            lastLogin: now
          };
        }
        const parentUser = db.users[cleanReferrer];
        parentUser.referralCount += 1;
        parentUser.balance += db.config.referralBonus;
        parentUser.lifetimeEarned += db.config.referralBonus;
        parentUser.referralEarned += db.config.referralBonus;

        const newRef: Referral = {
          id: generateId("ref"),
          referrerTelegramId: parentUser.telegramId,
          referredTelegramId: tid,
          level: 1,
          bonus: db.config.referralBonus,
          createdAt: now
        };
        db.referrals.unshift(newRef);
        refToSync = { ...newRef };
        parentToSync = { ...parentUser };

        db.logs.unshift({
          id: generateId("log"),
          telegramId: parentUser.telegramId,
          kind: "referral",
          label: `Level 1 referral bonus (${telegramUser.first_name || 'User'})`,
          amount: db.config.referralBonus,
          createdAt: now
        });

        const token = db.config.botToken || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BOT_TOKEN) || "";
        if (token) {
          sendTelegramBotMessage(token, parentUser.telegramId, "আপনার মাধ্যমে একটা নতুন ইউজার জয়েন হয়েছে।");
        }
      }

      user = existing;
      return;
    }

    const newUser: User = {
      telegramId: tid,
      username: telegramUser.username || "",
      firstName: telegramUser.first_name || "User",
      lastName: telegramUser.last_name || "",
      photoUrl: telegramUser.photo_url || "",
      bio: "",
      balance: 0,
      lifetimeEarned: 0,
      todayEarned: 0,
      todayDate: getTodayDateString(),
      adsWatchedToday: 0,
      referralCount: 0,
      level2Count: 0,
      referralEarned: 0,
      referredBy: cleanReferrer,
      binanceId: "",
      following: [],
      verified: false,
      banned: false,
      createdAt: now,
      lastLogin: now
    };

    // Credit referrer (Level 1)
    if (cleanReferrer) {
      if (!db.users[cleanReferrer]) {
        db.users[cleanReferrer] = {
          telegramId: cleanReferrer,
          username: `user_${cleanReferrer}`,
          firstName: `User ${cleanReferrer}`,
          lastName: "",
          photoUrl: "",
          bio: "",
          balance: 0,
          lifetimeEarned: 0,
          todayEarned: 0,
          todayDate: getTodayDateString(),
          adsWatchedToday: 0,
          referralCount: 0,
          level2Count: 0,
          referralEarned: 0,
          referredBy: null,
          binanceId: "",
          following: [],
          verified: false,
          banned: false,
          createdAt: now,
          lastLogin: now
        };
      }

      const parentUser = db.users[cleanReferrer];
      parentUser.referralCount += 1;
      parentUser.balance += db.config.referralBonus;
      parentUser.lifetimeEarned += db.config.referralBonus;
      parentUser.referralEarned += db.config.referralBonus;

      const newRef: Referral = {
        id: generateId("ref"),
        referrerTelegramId: parentUser.telegramId,
        referredTelegramId: tid,
        level: 1,
        bonus: db.config.referralBonus,
        createdAt: now
      };
      db.referrals.unshift(newRef);
      refToSync = { ...newRef };
      parentToSync = { ...parentUser };

      db.logs.unshift({
        id: generateId("log"),
        telegramId: parentUser.telegramId,
        kind: "referral",
        label: `Level 1 referral bonus (${telegramUser.first_name || 'User'})`,
        amount: db.config.referralBonus,
        createdAt: now
      });

      // Send join notification to referrer bot chat
      const token = db.config.botToken || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BOT_TOKEN) || "";
      if (token) {
        sendTelegramBotMessage(
          token,
          parentUser.telegramId,
          "আপনার মাধ্যমে একটা নতুন ইউজার জয়েন হয়েছে।"
        );
      }

      // Credit grandparent (Level 2)
      if (parentUser.referredBy && db.users[parentUser.referredBy]) {
        const grandParent = db.users[parentUser.referredBy];
        grandParent.level2Count += 1;
        grandParent.balance += db.config.level2Bonus;
        grandParent.lifetimeEarned += db.config.level2Bonus;
        grandParent.referralEarned += db.config.level2Bonus;

        db.referrals.unshift({
          id: generateId("ref"),
          referrerTelegramId: grandParent.telegramId,
          referredTelegramId: tid,
          level: 2,
          bonus: db.config.level2Bonus,
          createdAt: now
        });
      }
    }

    // Send Welcome message to the new user in bot
    const token = db.config.botToken || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BOT_TOKEN) || "";
    if (token) {
      sendTelegramBotMessage(
        token,
        tid,
        `স্বাগতম ${db.config.appName} এ! প্রতিদিন অ্যাড ও টাস্ক সম্পন্ন করে সরাসরি USDT ইনকাম করুন।`
      );
    }

    db.users[tid] = newUser;
    user = newUser;
  });

  // Sync to Firebase in background
  if (user!) {
    syncUserToFirebase(user!);
  }
  if (parentToSync) {
    syncUserToFirebase(parentToSync);
  }
  if (refToSync) {
    syncReferralToFirebase(refToSync);
  }

  return user!;
}

export async function creditUserEarning(
  telegramId: string,
  kind: 'ad' | 'task',
  label: string,
  amount: number
): Promise<User | null> {
  let updated: User | null = null;

  appStore.update((db) => {
    const u = db.users[telegramId];
    if (!u) return;

    if (u.todayDate !== getTodayDateString()) {
      u.todayDate = getTodayDateString();
      u.todayEarned = 0;
      u.adsWatchedToday = 0;
    }

    u.balance += amount;
    u.todayEarned += amount;
    u.lifetimeEarned += amount;

    if (kind === "ad") {
      u.adsWatchedToday += 1;
    }

    db.logs.unshift({
      id: generateId("log"),
      telegramId,
      kind,
      label,
      amount,
      createdAt: new Date().toISOString()
    });

    updated = { ...u };
  });

  if (updated) {
    syncUserToFirebase(updated);
  }

  return updated;
}

export async function requestWithdrawal(
  telegramId: string,
  amount: number,
  account: string,
  method: string = "bKash"
): Promise<{ success: boolean; reason?: string; withdrawal?: Withdrawal }> {
  let result: { success: boolean; reason?: string; withdrawal?: Withdrawal } = {
    success: false,
    reason: "unknown"
  };

  appStore.update((db) => {
    const u = db.users[telegramId];
    const cfg = db.config;

    if (!u) {
      result = { success: false, reason: "user_not_found" };
      return;
    }
    if (!account.trim()) {
      result = { success: false, reason: "missing_account" };
      return;
    }
    if (amount < cfg.minWithdraw) {
      result = { success: false, reason: "below_minimum" };
      return;
    }
    if (u.balance < amount) {
      result = { success: false, reason: "insufficient_balance" };
      return;
    }
    if (u.referralCount < cfg.minReferralsForWithdraw) {
      result = { success: false, reason: "not_enough_referrals" };
      return;
    }

    u.balance -= amount;
    if (method.toLowerCase().includes("binance")) {
      u.binanceId = account;
    }

    const wd: Withdrawal = {
      id: generateId("wd"),
      telegramId,
      name: `${u.firstName} ${u.lastName}`.trim(),
      amount,
      method,
      account,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    db.withdrawals.unshift(wd);
    result = { success: true, withdrawal: wd };
  });

  if (result.success && result.withdrawal) {
    syncWithdrawalToFirebase(result.withdrawal);
    const u = appStore.get().users[telegramId];
    if (u) syncUserToFirebase(u);
  }

  return result;
}

export function createCommunityPost(author: User, text: string, imageUrl: string | null): void {
  appStore.update((db) => {
    const p: Post = {
      id: generateId("post"),
      authorId: author.telegramId,
      authorName: `${author.firstName} ${author.lastName}`.trim(),
      authorPhoto: author.photoUrl,
      text,
      imageUrl,
      likes: [],
      createdAt: new Date().toISOString()
    };
    db.posts.unshift(p);
  });
}

export function togglePostLike(postId: string, userId: string): void {
  appStore.update((db) => {
    const p = db.posts.find((item) => item.id === postId);
    if (!p) return;
    if (p.likes.includes(userId)) {
      p.likes = p.likes.filter((id) => id !== userId);
    } else {
      p.likes = [...p.likes, userId];
    }
  });
}

export function updateUserProfile(telegramId: string, patch: Partial<User>): void {
  appStore.update((db) => {
    const u = db.users[telegramId];
    if (u) {
      Object.assign(u, patch);
    }
  });
  const u = appStore.get().users[telegramId];
  if (u) {
    syncUserToFirebase(u);
  }
}
