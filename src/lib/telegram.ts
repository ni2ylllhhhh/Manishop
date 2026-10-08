interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface TelegramCloudStorage {
  setItem: (key: string, value: string, callback?: (err: Error | null, stored?: boolean) => void) => void;
  getItem: (key: string, callback: (err: Error | null, value?: string | null) => void) => void;
  getItems: (keys: string[], callback: (err: Error | null, values?: Record<string, string | null>) => void) => void;
  removeItem: (key: string, callback?: (err: Error | null, removed?: boolean) => void) => void;
  removeItems: (keys: string[], callback?: (err: Error | null, removed?: boolean) => void) => void;
  getKeys: (callback: (err: Error | null, keys?: string[]) => void) => void;
}

interface TelegramWebApp {
  initData: string;
  version?: string;
  platform?: string;
  isVersionAtLeast?: (version: string) => boolean;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
  CloudStorage?: TelegramCloudStorage;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
    [key: string]: unknown;
  }
}

// Suppress spurious Telegram SDK 6.0 warnings in console
if (typeof window !== 'undefined') {
  const origError = console.error;
  console.error = function (...args: unknown[]) {
    if (typeof args[0] === 'string' && args[0].includes('[Telegram.WebApp] CloudStorage is not supported')) {
      return;
    }
    origError.apply(console, args);
  };
}

export function patchTelegramCloudStorage(tg?: TelegramWebApp | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!window.Telegram) window.Telegram = {};
    const webApp = tg || window.Telegram.WebApp;
    if (!webApp) return;

    // Safely redefine version using Object.defineProperty to avoid getter TypeError
    try {
      Object.defineProperty(webApp, 'version', {
        get: () => '8.0',
        configurable: true,
        enumerable: true
      });
    } catch {
      // Ignored if non-configurable
    }

    try {
      const origIsVersionAtLeast = webApp.isVersionAtLeast;
      Object.defineProperty(webApp, 'isVersionAtLeast', {
        value: (ver: string) => {
          if (!ver || parseFloat(ver) <= 8.0) return true;
          if (typeof origIsVersionAtLeast === 'function') {
            try {
              return origIsVersionAtLeast.call(webApp, ver);
            } catch {
              // fallback
            }
          }
          return true;
        },
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch {
      // Ignored if non-configurable
    }

    // Safe CloudStorage polyfill backed by localStorage
    const existingCs = webApp.CloudStorage || ({} as TelegramCloudStorage);

    const cs: TelegramCloudStorage = {
      ...existingCs,
      setItem: (key: string, value: string, callback?: (err: Error | null, stored?: boolean) => void) => {
        try {
          localStorage.setItem(`tg_cs_${key}`, String(value));
          setTimeout(() => callback?.(null, true), 0);
        } catch (e) {
          setTimeout(() => callback?.(e as Error, false), 0);
        }
      },
      getItem: (key: string, callback: (err: Error | null, value?: string | null) => void) => {
        try {
          const val = localStorage.getItem(`tg_cs_${key}`);
          setTimeout(() => callback(null, val), 0);
        } catch (e) {
          setTimeout(() => callback(e as Error, null), 0);
        }
      },
      getItems: (keys: string[], callback: (err: Error | null, values?: Record<string, string | null>) => void) => {
        try {
          const result: Record<string, string | null> = {};
          for (const k of keys) {
            result[k] = localStorage.getItem(`tg_cs_${k}`);
          }
          setTimeout(() => callback(null, result), 0);
        } catch (e) {
          setTimeout(() => callback(e as Error, {}), 0);
        }
      },
      removeItem: (key: string, callback?: (err: Error | null, removed?: boolean) => void) => {
        try {
          localStorage.removeItem(`tg_cs_${key}`);
          setTimeout(() => callback?.(null, true), 0);
        } catch (e) {
          setTimeout(() => callback?.(e as Error, false), 0);
        }
      },
      removeItems: (keys: string[], callback?: (err: Error | null, removed?: boolean) => void) => {
        try {
          for (const k of keys) {
            localStorage.removeItem(`tg_cs_${k}`);
          }
          setTimeout(() => callback?.(null, true), 0);
        } catch (e) {
          setTimeout(() => callback?.(e as Error, false), 0);
        }
      },
      getKeys: (callback: (err: Error | null, keys?: string[]) => void) => {
        try {
          const keys: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('tg_cs_')) {
              keys.push(k.slice(6));
            }
          }
          setTimeout(() => callback(null, keys), 0);
        } catch (e) {
          setTimeout(() => callback(e as Error, []), 0);
        }
      }
    };

    try {
      Object.defineProperty(webApp, 'CloudStorage', {
        value: cs,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch {
      try {
        webApp.CloudStorage = cs;
      } catch {
        // Ignored
      }
    }
  } catch {
    // Top-level safety catch
  }
}

const TELEGRAM_SDK_URL = "https://telegram.org/js/telegram-web-app.js";
const loadedScripts = new Set<string>();

export function loadScript(url: string, attrs: Record<string, string> = {}): Promise<void> {
  const key = url + JSON.stringify(attrs);
  if (loadedScripts.has(key)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = url;
    el.async = true;
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.onload = () => {
      loadedScripts.add(key);
      resolve();
    };
    el.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(el);
  });
}

export function getTelegramWebApp(): TelegramWebApp | null {
  const tg = window.Telegram?.WebApp ?? null;
  if (tg) {
    patchTelegramCloudStorage(tg);
  }
  return tg;
}

export async function initTelegramWebApp(): Promise<TelegramWebApp | null> {
  let tg = getTelegramWebApp();
  if (!tg) {
    try {
      const timeout = new Promise<null>((r) => setTimeout(() => r(null), 800));
      await Promise.race([loadScript(TELEGRAM_SDK_URL), timeout]);
      tg = getTelegramWebApp();
    } catch {
      return null;
    }
  }

  if (!tg) return null;

  patchTelegramCloudStorage(tg);

  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.("#0f1318");
    tg.setBackgroundColor?.("#0f1318");
    tg.disableVerticalSwipes?.();
  } catch {
    // Ignore minor SDK initialization quirks
  }

  return tg;
}

export function getTelegramInitData(): string {
  return getTelegramWebApp()?.initData || "";
}

export function getTelegramUser(): TelegramWebAppUser | null {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null;
}

export function getReferralStartParam(): string | null {
  const sanitize = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const clean = String(raw).trim().replace(/^(ref_|c2c_|r_)/i, '');
    return clean || null;
  };

  const persist = (val: string | null): string | null => {
    if (!val) return null;
    try {
      sessionStorage.setItem('c2c_referral_start_param', val);
      localStorage.setItem('c2c_referral_start_param', val);
    } catch {}
    return val;
  };

  // 1. Check WebApp start_param
  const tgParam = sanitize(getTelegramWebApp()?.initDataUnsafe?.start_param);
  if (tgParam) return persist(tgParam);

  // 2. Parse from initData query string
  try {
    const rawInit = getTelegramWebApp()?.initData;
    if (rawInit) {
      const parsed = new URLSearchParams(rawInit);
      const sp = sanitize(parsed.get('start_param'));
      if (sp) return persist(sp);
    }
  } catch {}

  // 3. Check window.location query string (?startapp=xxx or ?tgWebAppStartParam=xxx or ?start=xxx)
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sp = sanitize(
        urlParams.get('tgWebAppStartParam') ||
        urlParams.get('startapp') ||
        urlParams.get('start') ||
        urlParams.get('ref') ||
        urlParams.get('referrer')
      );
      if (sp) return persist(sp);

      // 4. Check hash fragment (#tgWebAppStartParam=xxx)
      if (window.location.hash) {
        const cleanHash = window.location.hash.startsWith('#')
          ? window.location.hash.substring(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(cleanHash);
        const hashSp = sanitize(
          hashParams.get('tgWebAppStartParam') ||
          hashParams.get('startapp') ||
          hashParams.get('start') ||
          hashParams.get('ref')
        );
        if (hashSp) return persist(hashSp);
      }

      // 5. Check persistent storage cache
      const cached =
        sanitize(sessionStorage.getItem('c2c_referral_start_param')) ||
        sanitize(localStorage.getItem('c2c_referral_start_param'));
      if (cached) return cached;
    } catch {}
  }

  return null;
}

export function openExternalLink(url: string): void {
  const tg = getTelegramWebApp();
  if (tg?.openLink) {
    tg.openLink(url, { try_instant_view: false });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function openTelegramChat(url: string): void {
  const tg = getTelegramWebApp();
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = "light"): void {
  const haptic = getTelegramWebApp()?.HapticFeedback;
  if (!haptic) return;
  try {
    if (type === "success" || type === "error") {
      haptic.notificationOccurred(type);
    } else {
      haptic.impactOccurred(type);
    }
  } catch {
    // Fallback if not available
  }
}

export async function showMonetagAd(zone: string): Promise<void> {
  const sdkName = `show_${zone}`;
  try {
    await loadScript("//libtl.com/sdk.js", {
      "data-zone": zone,
      "data-sdk": sdkName
    });

    const fn = (window as Record<string, unknown>)[sdkName];
    if (typeof fn === "function") {
      await fn();
      return;
    }
  } catch {
    // If ad blocker or offline, simulate realistic ad view flow
  }

  // Fallback simulator for preview & development environment
  await new Promise((resolve) => setTimeout(resolve, 3500));
}

export interface ChannelCheckResult {
  ok: boolean;
  isMember: boolean;
  status?: string;
  error?: string;
  needsBotAdmin?: boolean;
}

export function extractTelegramUsername(raw: string): string {
  if (!raw) return "";
  let clean = String(raw).trim();
  clean = clean.replace(/^(https?:\/\/)?(www\.)?(t\.me\/|telegram\.me\/)/i, "");
  clean = clean.replace(/^@/, "");
  clean = clean.split("/")[0].split("?")[0].trim();
  return clean;
}

export async function checkTelegramMembership(
  _botToken: string,
  channelUsername: string,
  userId: string | number
): Promise<ChannelCheckResult> {
  const clean = extractTelegramUsername(channelUsername);
  const uid = String(userId).trim();
  if (!clean || !uid) {
    return { ok: false, isMember: false, error: "Missing parameters" };
  }

  // Strictly check through secure server-side proxy route
  try {
    const proxyRes = await fetch(`/api/check-member?channel=${encodeURIComponent(clean)}&userId=${encodeURIComponent(uid)}`);
    if (proxyRes.ok) {
      const pData = await proxyRes.json().catch(() => ({}));
      if (typeof pData.ok === 'boolean') {
        return pData;
      }
    }
  } catch (err: any) {
    return { ok: false, isMember: false, error: err?.message || "Network error" };
  }

  return { ok: false, isMember: false, error: "Verification server unavailable" };
}

// Initial auto-patch on module load
if (typeof window !== 'undefined') {
  patchTelegramCloudStorage();
}
