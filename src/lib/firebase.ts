import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  getDocs,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
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

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firestore = getFirestore(app);

/**
 * Save / Update a user record to Firebase Firestore
 */
export async function syncUserToFirebase(user: User): Promise<void> {
  if (!user || !user.telegramId) return;
  try {
    const userDocRef = doc(firestore, "users", String(user.telegramId));
    await setDoc(
      userDocRef,
      {
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
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[Firebase] syncUserToFirebase error:", err);
  }
}

/**
 * Fetch a single user record from Firestore
 */
export async function fetchUserFromFirebase(telegramId: string): Promise<User | null> {
  if (!telegramId) return null;
  try {
    const userDocRef = doc(firestore, "users", String(telegramId));
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as User;
    }
  } catch (err) {
    console.warn("[Firebase] fetchUserFromFirebase error:", err);
  }
  return null;
}

/**
 * Listen in real time to the active user's document in Firestore
 */
export function subscribeToFirebaseUser(
  telegramId: string,
  onUpdate: (remoteUser: Partial<User>) => void
): () => void {
  if (!telegramId) return () => {};
  try {
    const userDocRef = doc(firestore, "users", String(telegramId));
    return onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data() as Partial<User>);
        }
      },
      (err) => {
        console.warn("[Firebase] Realtime user listener notice:", err.message);
      }
    );
  } catch (err) {
    console.warn("[Firebase] Failed to attach user listener:", err);
    return () => {};
  }
}

/**
 * Save withdrawal request to Firestore
 */
export async function syncWithdrawalToFirebase(wd: Withdrawal): Promise<void> {
  if (!wd || !wd.id) return;
  try {
    const wdRef = doc(firestore, "withdrawals", wd.id);
    await setDoc(
      wdRef,
      {
        ...wd,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[Firebase] syncWithdrawalToFirebase error:", err);
  }
}

/**
 * Save referral tracking document to Firestore
 */
export async function syncReferralToFirebase(ref: Referral): Promise<void> {
  if (!ref || !ref.id) return;
  try {
    const refDoc = doc(firestore, "referrals", ref.id);
    await setDoc(
      refDoc,
      {
        ...ref,
        createdAtTimestamp: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[Firebase] syncReferralToFirebase error:", err);
  }
}

/**
 * Update app config on Firebase
 */
export async function syncConfigToFirebase(config: AppConfig): Promise<void> {
  try {
    const cfgRef = doc(firestore, "settings", "app_config");
    await setDoc(cfgRef, { ...config, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn("[Firebase] syncConfigToFirebase error:", err);
  }
}
