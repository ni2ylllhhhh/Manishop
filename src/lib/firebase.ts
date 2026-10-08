import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getDatabase,
  ref as rtdbRef,
  set,
  get,
  update,
  onValue,
  off,
  remove,
  DataSnapshot
} from "firebase/database";
import type { User, Withdrawal, Referral, AppConfig, BroadcastCampaign } from "../types";

export const firebaseConfig = {
  apiKey: "AIzaSyDZ5Ae1Y16fk_TsAQ-hc8MXJCmoSB2gbJY",
  authDomain: "maneishopbd.firebaseapp.com",
  databaseURL: "https://maneishopbd-default-rtdb.firebaseio.com",
  projectId: "maneishopbd",
  storageBucket: "maneishopbd.firebasestorage.app",
  messagingSenderId: "243803237820",
  appId: "1:243803237820:web:b2db8b2ca1a54afb47cfb9",
  measurementId: "G-FEX3E5VJ6Y"
};

// Initialize Firebase App & Realtime Database
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const rtdb = getDatabase(app);

/**
 * Save / Update a user record to Firebase Realtime Database
 */
export async function syncUserToFirebase(user: User): Promise<void> {
  if (!user || !user.telegramId) return;
  try {
    const userRef = rtdbRef(rtdb, `users/${user.telegramId}`);
    const dataToSave = {
      telegramId: String(user.telegramId),
      username: user.username || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      photoUrl: user.photoUrl || "",
      bio: user.bio || "",
      balance: Number(user.balance) || 0,
      lifetimeEarned: Number(user.lifetimeEarned) || 0,
      todayEarned: Number(user.todayEarned) || 0,
      todayDate: user.todayDate || "",
      adsWatchedToday: Number(user.adsWatchedToday) || 0,
      referralCount: Number(user.referralCount) || 0,
      level2Count: Number(user.level2Count) || 0,
      referralEarned: Number(user.referralEarned) || 0,
      referredBy: user.referredBy || null,
      binanceId: user.binanceId || "",
      verified: Boolean(user.verified),
      banned: Boolean(user.banned),
      welcomeSent: Boolean(user.welcomeSent),
      createdAt: user.createdAt || new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      updatedAt: Date.now()
    };
    await set(userRef, dataToSave);
  } catch (err) {
    console.warn("[Firebase RTDB] syncUserToFirebase error:", err);
  }
}

/**
 * Fetch a single user record from Firebase
 */
export async function fetchUserFromFirebase(telegramId: string): Promise<User | null> {
  if (!telegramId) return null;
  try {
    const userRef = rtdbRef(rtdb, `users/${telegramId}`);
    const snap = await get(userRef);
    if (snap.exists()) {
      return snap.val() as User;
    }
  } catch (err) {
    console.warn("[Firebase RTDB] fetchUserFromFirebase error:", err);
  }
  return null;
}

/**
 * Fetch all users from Firebase
 */
export async function fetchAllUsers(): Promise<Record<string, User>> {
  try {
    const usersRef = rtdbRef(rtdb, "users");
    const snap = await get(usersRef);
    if (snap.exists()) {
      return snap.val() as Record<string, User>;
    }
  } catch (err) {
    console.warn("[Firebase RTDB] fetchAllUsers error:", err);
  }
  return {};
}

/**
 * Listen in real time to all users in Firebase (for Admin Panel)
 */
export function subscribeAllUsers(
  onUsers: (users: Record<string, User>) => void
): () => void {
  try {
    const usersRef = rtdbRef(rtdb, "users");
    const handler = (snap: DataSnapshot) => {
      if (snap.exists()) {
        onUsers(snap.val() as Record<string, User>);
      } else {
        onUsers({});
      }
    };
    onValue(usersRef, handler);
    return () => off(usersRef, "value", handler);
  } catch (err) {
    console.warn("[Firebase RTDB] subscribeAllUsers error:", err);
    return () => {};
  }
}

/**
 * Listen in real time to the active user's document
 */
export function subscribeToFirebaseUser(
  telegramId: string,
  onUpdate: (remoteUser: Partial<User> | null) => void
): () => void {
  if (!telegramId) return () => {};
  try {
    const userRef = rtdbRef(rtdb, `users/${telegramId}`);
    const handler = (snap: DataSnapshot) => {
      if (snap.exists()) {
        onUpdate(snap.val() as Partial<User>);
      } else {
        onUpdate(null);
      }
    };
    onValue(userRef, handler);
    return () => off(userRef, "value", handler);
  } catch (err) {
    console.warn("[Firebase RTDB] subscribeToFirebaseUser error:", err);
    return () => {};
  }
}

/**
 * Delete a user from Firebase Realtime Database
 * Also removes all their withdrawal requests and referral entries
 */
export async function deleteUserFromFirebase(telegramId: string): Promise<boolean> {
  if (!telegramId) return false;
  try {
    // 1. Remove the user node
    const userRef = rtdbRef(rtdb, `users/${telegramId}`);
    await remove(userRef);

    // 2. Remove all withdrawal requests created by this user
    try {
      const wdsRef = rtdbRef(rtdb, "withdrawals");
      const snapW = await get(wdsRef);
      if (snapW.exists()) {
        const allWds = snapW.val();
        for (const [key, val] of Object.entries(allWds)) {
          if ((val as any)?.telegramId === telegramId) {
            await remove(rtdbRef(rtdb, `withdrawals/${key}`));
          }
        }
      }
    } catch (e) {
      console.warn("[Firebase RTDB] Error deleting user withdrawals:", e);
    }

    // 3. Remove all referral documents where this user is the referred person
    try {
      const refsRef = rtdbRef(rtdb, "referrals");
      const snapR = await get(refsRef);
      if (snapR.exists()) {
        const allRefs = snapR.val();
        for (const [key, val] of Object.entries(allRefs)) {
          if ((val as any)?.referredTelegramId === telegramId) {
            await remove(rtdbRef(rtdb, `referrals/${key}`));
          }
        }
      }
    } catch (e) {
      console.warn("[Firebase RTDB] Error deleting user referrals:", e);
    }

    return true;
  } catch (err) {
    console.warn("[Firebase RTDB] deleteUserFromFirebase error:", err);
    return false;
  }
}

/**
 * Delete a withdrawal request from Firebase Realtime Database
 */
export async function deleteWithdrawalFromFirebase(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const wdRef = rtdbRef(rtdb, `withdrawals/${id}`);
    await remove(wdRef);
    return true;
  } catch (err) {
    console.warn("[Firebase RTDB] deleteWithdrawalFromFirebase error:", err);
    return false;
  }
}

/**
 * Save withdrawal request to Firebase
 */
export async function syncWithdrawalToFirebase(wd: Withdrawal): Promise<void> {
  if (!wd || !wd.id) return;
  try {
    const wdRef = rtdbRef(rtdb, `withdrawals/${wd.id}`);
    await set(wdRef, {
      ...wd,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.warn("[Firebase RTDB] syncWithdrawalToFirebase error:", err);
  }
}

/**
 * Listen in real time to all withdrawals in Firebase (for Admin Panel)
 */
export function subscribeAllWithdrawals(
  onWithdrawals: (wds: Withdrawal[]) => void
): () => void {
  try {
    const wdsRef = rtdbRef(rtdb, "withdrawals");
    const handler = (snap: DataSnapshot) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.values(val) as Withdrawal[];
        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onWithdrawals(list);
      } else {
        onWithdrawals([]);
      }
    };
    onValue(wdsRef, handler);
    return () => off(wdsRef, "value", handler);
  } catch (err) {
    console.warn("[Firebase RTDB] subscribeAllWithdrawals error:", err);
    return () => {};
  }
}

/**
 * Save referral tracking document to Firebase
 */
export async function syncReferralToFirebase(refItem: Referral): Promise<void> {
  if (!refItem || !refItem.id) return;
  try {
    const refDoc = rtdbRef(rtdb, `referrals/${refItem.id}`);
    await set(refDoc, {
      ...refItem,
      createdAtTimestamp: Date.now()
    });
  } catch (err) {
    console.warn("[Firebase RTDB] syncReferralToFirebase error:", err);
  }
}

/**
 * Listen in real time to all referrals
 */
export function subscribeAllReferrals(
  onRefs: (refs: Referral[]) => void
): () => void {
  try {
    const refsRef = rtdbRef(rtdb, "referrals");
    const handler = (snap: DataSnapshot) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.values(val) as Referral[];
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onRefs(list);
      } else {
        onRefs([]);
      }
    };
    onValue(refsRef, handler);
    return () => off(refsRef, "value", handler);
  } catch (err) {
    console.warn("[Firebase RTDB] subscribeAllReferrals error:", err);
    return () => {};
  }
}

/**
 * Update app config on Firebase
 */
export async function syncConfigToFirebase(config: AppConfig): Promise<void> {
  try {
    const cfgRef = rtdbRef(rtdb, "config");
    await set(cfgRef, { ...config, updatedAt: Date.now() });
  } catch (err) {
    console.warn("[Firebase RTDB] syncConfigToFirebase error:", err);
  }
}

/**
 * Listen to app config in real time
 */
export function subscribeConfig(
  onConfig: (cfg: Partial<AppConfig>) => void
): () => void {
  try {
    const cfgRef = rtdbRef(rtdb, "config");
    const handler = (snap: DataSnapshot) => {
      if (snap.exists()) {
        const val = snap.val() as Partial<AppConfig>;
        if (val && typeof val === 'object') {
          if (!val.botToken || val.botToken.includes("AAFJufbT0i1oMQr6HihpdZVWX8BkqmJKC-E") || !val.botToken.startsWith("8922187032:AAG")) {
            val.botToken = "8922187032:AAGXcO_wReVHRab4ME-X_0-eBB1dixWer-c";
          }
        }
        onConfig(val);
      }
    };
    onValue(cfgRef, handler);
    return () => off(cfgRef, "value", handler);
  } catch (err) {
    console.warn("[Firebase RTDB] subscribeConfig error:", err);
    return () => {};
  }
}

/**
 * Save or update a broadcast campaign to Firebase RTDB
 */
export async function syncBroadcastToFirebase(campaign: BroadcastCampaign): Promise<void> {
  if (!campaign || !campaign.id) return;
  try {
    const bcRef = rtdbRef(rtdb, `broadcasts/${campaign.id}`);
    await set(bcRef, {
      ...campaign,
      updatedAtTimestamp: Date.now()
    });
  } catch (err) {
    console.warn("[Firebase RTDB] syncBroadcastToFirebase error:", err);
  }
}

/**
 * Subscribe in real time to all broadcast campaigns
 */
export function subscribeAllBroadcasts(
  onBroadcasts: (bcs: BroadcastCampaign[]) => void
): () => void {
  try {
    const bcsRef = rtdbRef(rtdb, "broadcasts");
    const handler = (snap: DataSnapshot) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.values(val) as BroadcastCampaign[];
        // Sort newest first
        list.sort((a, b) => (b.serialNumber || 0) - (a.serialNumber || 0));
        onBroadcasts(list);
      } else {
        onBroadcasts([]);
      }
    };
    onValue(bcsRef, handler);
    return () => off(bcsRef, "value", handler);
  } catch (err) {
    console.warn("[Firebase RTDB] subscribeAllBroadcasts error:", err);
    return () => {};
  }
}

/**
 * Delete a broadcast campaign from Firebase RTDB
 */
export async function deleteBroadcastFromFirebase(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const bcRef = rtdbRef(rtdb, `broadcasts/${id}`);
    await remove(bcRef);
    return true;
  } catch (err) {
    console.warn("[Firebase RTDB] deleteBroadcastFromFirebase error:", err);
    return false;
  }
}
