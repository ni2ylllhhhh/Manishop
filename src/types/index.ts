export interface User {
  telegramId: string;
  username: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
  bio: string;
  balance: number;
  lifetimeEarned: number;
  todayEarned: number;
  todayDate: string;
  adsWatchedToday: number;
  referralCount: number;
  level2Count: number;
  referralEarned: number;
  referredBy: string | null;
  binanceId: string;
  following: string[];
  verified: boolean;
  banned: boolean;
  welcomeSent?: boolean;
  createdAt: string;
  lastLogin: string;
}

export interface AdSlot {
  id: string;
  title: string;
  zone: string;
  reward: number;
}

export interface Task {
  id: string;
  title: string;
  url: string;
  reward: number;
  minSeconds: number;
  maxMinutes: number;
}

export interface Referral {
  id: string;
  referrerTelegramId: string;
  referredTelegramId: string;
  level: 1 | 2;
  bonus: number;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  telegramId: string;
  name: string;
  amount: number;
  method: string;
  account: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  text: string;
  imageUrl: string | null;
  likes: string[];
  createdAt: string;
}

export interface EarningLog {
  id: string;
  telegramId: string;
  kind: 'ad' | 'task' | 'referral';
  label: string;
  amount: number;
  createdAt: string;
}

export interface RequiredChannel {
  id: string;
  name: string;
  tag: string;
  subtitle: string;
  username: string;
  url: string;
}

export interface BroadcastButton {
  label: string;
  url: string;
}

export type BroadcastMessageType = 'text' | 'photo' | 'video' | 'document';
export type BroadcastTargetAudience = 'all' | 'active' | 'recent' | 'specific' | 'verified_only' | 'unverified_only';
export type BroadcastStatus = 'draft' | 'running' | 'paused' | 'stopped' | 'completed';

export interface BroadcastCampaign {
  id: string;
  serialNumber: number;
  title: string;
  messageType: BroadcastMessageType;
  text: string;
  mediaUrl?: string;
  buttons: BroadcastButton[];
  buttonLayout: 'single' | 'double';
  targetAudience: BroadcastTargetAudience;
  targetValue?: string;
  totalTarget: number;
  sentCount: number;
  failedCount: number;
  status: BroadcastStatus;
  currentIndex: number;
  targetUserIds: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AppConfig {
  appName: string;
  botUsername: string;
  miniAppUrl: string;
  supportUrl: string;
  imgbbApiKey: string;
  adminPassword?: string;
  adminPinHash?: string;
  allowDemoLogin: boolean;
  forceChannelVerification?: boolean;
  requiredChannels?: RequiredChannel[];
  adSlots: AdSlot[];
  adMinSeconds: number;
  adMaxMinutes: number;
  adDailyLimitPerSlot: number;
  adHourlyLimitPerSlot: number;
  tasks: Task[];
  referralBonus: number;
  level2Bonus: number;
  welcomeBonus: number;
  minWithdraw: number;
  minReferralsForWithdraw: number;
  withdrawAmounts: number[];
}

export interface AppDatabase {
  rev: number;
  users: Record<string, User>;
  referrals: Referral[];
  withdrawals: Withdrawal[];
  posts: Post[];
  logs: EarningLog[];
  broadcasts?: BroadcastCampaign[];
  config: AppConfig;
}

export interface PendingAction {
  kind: 'ad' | 'task';
  refId: string;
  label: string;
  reward: number;
  minSeconds: number;
  maxMinutes: number;
  startedAt: number;
}
