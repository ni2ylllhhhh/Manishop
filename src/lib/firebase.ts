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
import type { User, Withdrawal, Referral, AppConfig } from "../types";

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
 */
export async function deleteUserFromFirebase(telegramId: string): Promise<boolean> {
  if (!telegramId) return false;
  try {
    const userRef = rtdbRef(rtdb, `users/${telegramId}`);
    await remove(userRef);
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
        onConfig(snap.val() as Partial<AppConfig>);
      }
    };
    onValue(cfgRef, handler);
    return () => off(cfgRef, "value", handler);
  } catch (err) {
    console.warn("[Firebase RTDB] subscribeConfig error:", err);
    return () => {};
  }
}
