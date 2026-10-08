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
  miniAppUrl: "https://manishop.ziniyaapu7.workers.dev/",
  supportUrl: "https://t.me/ManeiShopBD_Site",
  imgbbApiKey: "f7be34ce0b6f4d15277479fb781d6607",
  adminPinHash: "48e6f958531e543731746fd0a4fcba173e2ae226d60eb19a5d021be3c29f7a3e",
  allowDemoLogin: true,
  forceChannelVerification: true,
  requiredChannels: [
    {
      id: "main",
      name: "Main",
      tag: "Channel",
      subtitle: "All Videos • Updates • News",
      username: "ManiShop_Community",
      url: "https://t.me/ManiShop_Community"
    },
    {
      id: "payment",
      name: "Payment",
      tag: "Channel",
      subtitle: "Payment • Proofs • Updates",
      username: "Earning_Money_Lob",
      url: "https://t.me/Earning_Money_Lob"
    }
  ],
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
  welcomeBonus: 0.01,
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

const initialDatabase: AppDatabase = {
  rev: 0,
  users: {},
  referrals: [],
  withdrawals: [],
  posts: [],
  logs: [],
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
    delete (mergedConfig as any).botToken;
    mergedConfig.adminPinHash = mergedConfig.adminPinHash || defaultConfig.adminPinHash;
    delete mergedConfig.adminPassword;
    mergedConfig.adMinSeconds = 60;
    mergedConfig.adHourlyLimitPerSlot = 10;
    
    // Ensure all 4 tasks use the requested link
    mergedConfig.tasks = defaultConfig.tasks;

    if (!Array.isArray(mergedConfig.requiredChannels)) {
      mergedConfig.requiredChannels = defaultConfig.requiredChannels;
    } else {
      mergedConfig.requiredChannels = mergedConfig.requiredChannels.map((c) => {
        if (c.username === "jgjghjghh687") {
          return {
            ...c,
            username: "ManiShop_Community",
            url: "https://t.me/ManiShop_Community"
          };
        }
        return c;
      });
    }
    if (typeof mergedConfig.forceChannelVerification !== 'boolean') {
      mergedConfig.forceChannelVerification = true;
    }

    // Purge any legacy mock users, referrals, withdrawals
    const fakeIds = new Set(["984210452", "742189301", "610928374", "528401923", "419401859"]);
    const cleanedUsers: Record<string, User> = {};
    if (parsed.users && typeof parsed.users === 'object') {
      for (const [k, v] of Object.entries(parsed.users as Record<string, User>)) {
        if (!fakeIds.has(k) && !k.startsWith("seed_") && !k.startsWith("user_seed_")) {
          cleanedUsers[k] = v;
        }
      }
    }

    const cleanedReferrals = Array.isArray(parsed.referrals)
      ? parsed.referrals.filter((r: any) => !r.id?.startsWith("ref_seed") && !fakeIds.has(r.referrerTelegramId) && !fakeIds.has(r.referredTelegramId))
      : [];

    const cleanedWithdrawals = Array.isArray(parsed.withdrawals)
      ? parsed.withdrawals.filter((w: any) => !w.id?.startsWith("wd_seed") && !fakeIds.has(w.telegramId))
      : [];

    const cleanedLogs = Array.isArray(parsed.logs)
      ? parsed.logs.filter((l: any) => !l.id?.startsWith("log_seed") && !fakeIds.has(l.telegramId))
      : [];

    return {
      ...deepClone(initialDatabase),
      ...parsed,
      users: cleanedUsers,
      referrals: cleanedReferrals,
      withdrawals: cleanedWithdrawals,
      logs: cleanedLogs,
      config: mergedConfig
    };
  } catch {
    return deepClone(initialDatabase);
  }
}

export function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendTelegramBotMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: any
): Promise<boolean> {
  const cid = String(chatId).trim();
  if (!cid || !/^-?\d+$/.test(cid)) return false;

  // 1. Dispatch via local server proxy route
  try {
    const proxyRes = await fetch("/api/send-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: cid, text, replyMarkup })
    });
    if (proxyRes.ok) {
      const pData = await proxyRes.json().catch(() => ({}));
      return Boolean(pData.ok);
    }
  } catch (err) {
    console.warn("[Telegram Proxy] Message dispatch error:", err);
  }
  return false;
}

/**
 * Configure Telegram Bot menu button to open Mini App URL directly
 */
export async function syncBotMenuButton(
  miniAppUrl?: string
): Promise<boolean> {
  const url = miniAppUrl || "https://manishop.ziniyaapu7.workers.dev/";
  try {
    const res = await fetch("/api/set-menu-button", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await res.json().catch(() => ({}));
    return Boolean(data.ok);
  } catch (err) {
    console.warn("Failed to sync bot menu button:", err);
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
  let grandParentToSync: User | null = null;
  let grandRefToSync: Referral | null = null;
  const messagesToSend: Array<{ chatId: string | number; text: string; replyMarkup?: any }> = [];

  // Check if we already have the user cached locally in appStore
  const localExisting = appStore.get().users[tid];

  // Fetch latest state of this user from Firebase
  let remoteUser: User | null = null;
  try {
    const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), 3000));
    remoteUser = await Promise.race([fetchUserFromFirebase(tid), timeoutPromise]);
  } catch {}

  const cleanReferrer = referredBy && String(referredBy).trim() !== tid ? String(referredBy).trim() : null;
  let remoteParent: User | null = null;
  let remoteGrandParent: User | null = null;

  if (cleanReferrer) {
    try {
      const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), 3500));
      remoteParent = await Promise.race([fetchUserFromFirebase(cleanReferrer), timeoutPromise]);
    } catch {}

    if (remoteParent?.referredBy && remoteParent.referredBy !== tid && remoteParent.referredBy !== cleanReferrer) {
      try {
        const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), 2500));
        remoteGrandParent = await Promise.race([fetchUserFromFirebase(remoteParent.referredBy), timeoutPromise]);
      } catch {}
    }
  }

  appStore.update((db) => {
    // If user does not exist in Firebase (e.g. deleted by admin or brand new),
    // stale cached user data must be purged so they register completely fresh!
    let existing: User | null = null;
    if (remoteUser && remoteUser.telegramId) {
      existing = { ...remoteUser };
      db.users[tid] = existing;
    } else {
      delete db.users[tid];
      existing = null;
    }

    if (cleanReferrer && remoteParent) {
      db.users[cleanReferrer] = {
        ...(db.users[cleanReferrer] || {}),
        ...remoteParent
      };
    }

    if (remoteGrandParent && remoteGrandParent.telegramId) {
      db.users[remoteGrandParent.telegramId] = {
        ...(db.users[remoteGrandParent.telegramId] || {}),
        ...remoteGrandParent
      };
    }

    const displayName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ").trim() || "User";

    if (existing) {
      existing.firstName = telegramUser.first_name || existing.firstName;
      existing.lastName = telegramUser.last_name || existing.lastName;
      existing.username = telegramUser.username || existing.username;
      if (telegramUser.photo_url && !existing.photoUrl.startsWith("http")) {
        existing.photoUrl = telegramUser.photo_url;
      }
      if (remoteUser && typeof remoteUser.verified === 'boolean') {
        existing.verified = remoteUser.verified;
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
        parentUser.balance = Number((parentUser.balance + db.config.referralBonus).toFixed(2));
        parentUser.lifetimeEarned = Number((parentUser.lifetimeEarned + db.config.referralBonus).toFixed(2));
        parentUser.referralEarned = Number((parentUser.referralEarned + db.config.referralBonus).toFixed(2));

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
          label: `Level 1 referral bonus (${displayName})`,
          amount: db.config.referralBonus,
          createdAt: now
        });

        const miniUrl = db.config.miniAppUrl || "https://manishop.ziniyaapu7.workers.dev/";
        const referrerText = `🎉 <b>নতুন রেফারেল যুক্ত হয়েছে!</b>\n\n👤 <b>নতুন সদস্য:</b> ${escapeHtml(displayName)}\n📊 <b>আপনার বর্তমান রেফারেল:</b> ${parentUser.referralCount} জন\n💰 <b>রেফারেল বোনাস:</b> +$${db.config.referralBonus.toFixed(2)} USDT\n💵 <b>বর্তমান ব্যালেন্স:</b> $${parentUser.balance.toFixed(2)} USDT\n🎯 <b>উইথড্র রিকোয়ারমেন্ট:</b> ${parentUser.referralCount}/${db.config.minReferralsForWithdraw} জন`;
        messagesToSend.push({
          chatId: parentUser.telegramId,
          text: referrerText,
          replyMarkup: {
            inline_keyboard: [
              [{ text: "🚀 Open ManeiShop App", web_app: { url: miniUrl } }]
            ]
          }
        });
      }

      // Check if existing user never received welcome message or bonus
      if (!existing.welcomeSent) {
        existing.welcomeSent = true;
        const wb = typeof db.config.welcomeBonus === 'number' ? db.config.welcomeBonus : 0.01;
        if (existing.balance === 0 && existing.lifetimeEarned === 0 && wb > 0) {
          existing.balance = Number((existing.balance + wb).toFixed(2));
          existing.lifetimeEarned = Number((existing.lifetimeEarned + wb).toFixed(2));
          existing.todayEarned = Number((existing.todayEarned + wb).toFixed(2));
          db.logs.unshift({
            id: generateId("log"),
            telegramId: tid,
            kind: "task",
            label: "🎁 সাইনআপ ওয়েলকাম বোনাস",
            amount: wb,
            createdAt: now
          });
        }
        const miniUrl = db.config.miniAppUrl || "https://manishop.ziniyaapu7.workers.dev/";
        const welcomeMsg = `🎉 <b>স্বাগতম ${escapeHtml(telegramUser.first_name || 'ইউজার')}!</b>\n\n🎁 <b>নতুন জয়েনিং বোনাস:</b> +$${(wb > 0 ? wb : 0.01).toFixed(2)} USDT আপনার একাউন্টে যোগ হয়েছে!\n💵 <b>বর্তমান ব্যালেন্স:</b> $${existing.balance.toFixed(2)} USDT\n\n👉 প্রতিদিন ভিডিও অ্যাড দেখুন ও স্পেশাল টাস্ক পূরণ করে সরাসরি বিকাশ, নগদ বা বাইন্যান্সে টাকা তুলুন।\n👥 <b>প্রতি সফল রেফারে পাবেন:</b> +$${db.config.referralBonus.toFixed(2)} USDT!\n💰 <b>নূন্যতম উইথড্র:</b> $${db.config.minWithdraw} USDT\n\n🚀 এখনই কাজ শুরু করতে নিচের বাটনে চাপুন!`;
        messagesToSend.push({
          chatId: tid,
          text: welcomeMsg,
          replyMarkup: {
            inline_keyboard: [
              [{ text: "🚀 Open ManeiShop App", web_app: { url: miniUrl } }]
            ]
          }
        });
      }

      user = existing;
      return;
    }

    const wb = typeof db.config.welcomeBonus === 'number' ? db.config.welcomeBonus : 0.01;

    const newUser: User = {
      telegramId: tid,
      username: telegramUser.username || "",
      firstName: telegramUser.first_name || "User",
      lastName: telegramUser.last_name || "",
      photoUrl: telegramUser.photo_url || "",
      bio: "",
      balance: wb,
      lifetimeEarned: wb,
      todayEarned: wb,
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
      welcomeSent: true,
      createdAt: now,
      lastLogin: now
    };

    if (wb > 0) {
      db.logs.unshift({
        id: generateId("log"),
        telegramId: tid,
        kind: "task",
        label: "🎁 সাইনআপ ওয়েলকাম বোনাস",
        amount: wb,
        createdAt: now
      });
    }

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
      parentUser.balance = Number((parentUser.balance + db.config.referralBonus).toFixed(2));
      parentUser.lifetimeEarned = Number((parentUser.lifetimeEarned + db.config.referralBonus).toFixed(2));
      parentUser.referralEarned = Number((parentUser.referralEarned + db.config.referralBonus).toFixed(2));

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
        label: `Level 1 referral bonus (${displayName})`,
        amount: db.config.referralBonus,
        createdAt: now
      });

      // Prepare referrer notification
      const miniUrl = db.config.miniAppUrl || "https://manishop.ziniyaapu7.workers.dev/";
      const referrerText = `🎉 <b>নতুন রেফারেল যুক্ত হয়েছে!</b>\n\n👤 <b>নতুন সদস্য:</b> ${escapeHtml(displayName)}\n📊 <b>আপনার বর্তমান রেফারেল:</b> ${parentUser.referralCount} জন\n💰 <b>রেফারেল বোনাস:</b> +$${db.config.referralBonus.toFixed(2)} USDT\n💵 <b>বর্তমান ব্যালেন্স:</b> $${parentUser.balance.toFixed(2)} USDT\n🎯 <b>উইথড্র রিকোয়ারমেন্ট:</b> ${parentUser.referralCount}/${db.config.minReferralsForWithdraw} জন`;
      messagesToSend.push({
        chatId: parentUser.telegramId,
        text: referrerText,
        replyMarkup: {
          inline_keyboard: [
            [{ text: "🚀 Open ManeiShop App", web_app: { url: miniUrl } }]
          ]
        }
      });

      // Credit grandparent (Level 2)
      if (parentUser.referredBy && db.users[parentUser.referredBy]) {
        const grandParent = db.users[parentUser.referredBy];
        grandParent.level2Count += 1;
        grandParent.balance = Number((grandParent.balance + db.config.level2Bonus).toFixed(2));
        grandParent.lifetimeEarned = Number((grandParent.lifetimeEarned + db.config.level2Bonus).toFixed(2));
        grandParent.referralEarned = Number((grandParent.referralEarned + db.config.level2Bonus).toFixed(2));

        const grandRef: Referral = {
          id: generateId("ref"),
          referrerTelegramId: grandParent.telegramId,
          referredTelegramId: tid,
          level: 2,
          bonus: db.config.level2Bonus,
          createdAt: now
        };
        db.referrals.unshift(grandRef);
        grandRefToSync = { ...grandRef };
        grandParentToSync = { ...grandParent };

        messagesToSend.push({
          chatId: grandParent.telegramId,
          text: `🌟 <b>লেভেল ২ টিম মেম্বার যুক্ত হয়েছে!</b>\n\n📊 <b>লেভেল ২ টিম সাইজ:</b> ${grandParent.level2Count} জন\n💰 <b>লেভেল ২ বোনাস:</b> +$${db.config.level2Bonus.toFixed(2)} USDT\n💵 <b>বর্তমান ব্যালেন্স:</b> $${grandParent.balance.toFixed(2)} USDT`,
          replyMarkup: {
            inline_keyboard: [
              [{ text: "🚀 Open ManeiShop App", web_app: { url: miniUrl } }]
            ]
          }
        });
      }
    }

    // Welcome message to the new user in bot
    const miniUrl = db.config.miniAppUrl || "https://manishop.ziniyaapu7.workers.dev/";
    const welcomeMsg = `🎉 <b>স্বাগতম ${escapeHtml(telegramUser.first_name || 'ইউজার')}!</b>\n\n🎁 <b>নতুন জয়েনিং বোনাস:</b> +$${wb.toFixed(2)} USDT আপনার একাউন্টে যোগ হয়েছে!\n💵 <b>বর্তমান ব্যালেন্স:</b> $${newUser.balance.toFixed(2)} USDT\n\n👉 প্রতিদিন ভিডিও অ্যাড দেখুন ও স্পেশাল টাস্ক পূরণ করে সরাসরি বিকাশ, নগদ বা বাইন্যান্সে টাকা তুলুন।\n👥 <b>প্রতি সফল রেফারে পাবেন:</b> +$${db.config.referralBonus.toFixed(2)} USDT!\n💰 <b>নূন্যতম উইথড্র:</b> $${db.config.minWithdraw} USDT\n\n🚀 এখনই কাজ শুরু করতে নিচের বাটনে চাপুন!`;
    messagesToSend.push({
      chatId: tid,
      text: welcomeMsg,
      replyMarkup: {
        inline_keyboard: [
          [{ text: "🚀 Open ManeiShop App", web_app: { url: miniUrl } }]
        ]
      }
    });

    db.users[tid] = newUser;
    user = newUser;
  });

  // 1. Dispatch all pending bot messages immediately!
  for (const item of messagesToSend) {
    if (item.chatId && /^-?\d+$/.test(String(item.chatId))) {
      sendTelegramBotMessage(item.chatId, item.text, item.replyMarkup).catch((e) => {
        console.warn("[Telegram Proxy] Message dispatch error:", e);
      });
    }
  }

  // 2. Sync to Firebase in parallel
  await Promise.allSettled([
    user! ? syncUserToFirebase(user!) : Promise.resolve(),
    parentToSync ? syncUserToFirebase(parentToSync) : Promise.resolve(),
    refToSync ? syncReferralToFirebase(refToSync) : Promise.resolve(),
    grandParentToSync ? syncUserToFirebase(grandParentToSync) : Promise.resolve(),
    grandRefToSync ? syncReferralToFirebase(grandRefToSync) : Promise.resolve()
  ]);

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
    if (account.trim()) {
      u.binanceId = account.trim();
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
