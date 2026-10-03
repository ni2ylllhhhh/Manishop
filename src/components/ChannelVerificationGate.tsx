import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, ShieldAlert, Sparkles, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { appStore } from '../lib/store';
import { syncUserToFirebase } from '../lib/firebase';
import { openTelegramChat, triggerHaptic, checkTelegramMembership } from '../lib/telegram';

export function ChannelVerificationGate({ children }: { children: React.ReactNode }) {
  const { user, config } = useAuth();

  // Loading state during initial entry check
  const [isVerifyingInitial, setIsVerifyingInitial] = useState(true);
  
  // Real-time verified state
  const [isVerifiedState, setIsVerifiedState] = useState<boolean>(() => {
    try {
      if (!user?.telegramId) return false;
      const ok = sessionStorage.getItem(`tg_gate_ok_${user.telegramId}`) === '1';
      return ok && Boolean(user.verified);
    } catch {
      return false;
    }
  });

  const [checking, setChecking] = useState(false);
  const [joinedMap, setJoinedMap] = useState<Record<string, boolean>>({});
  const [clickedMap, setClickedMap] = useState<Record<string, boolean>>({});
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  const channels = config.requiredChannels && config.requiredChannels.length > 0
    ? config.requiredChannels
    : [
        {
          id: 'main',
          name: 'Main',
          tag: 'Channel',
          subtitle: 'All Videos • Updates • News',
          username: 'jgjghjghh687',
          url: 'https://t.me/jgjghjghh687'
        },
        {
          id: 'payment',
          name: 'Payment',
          tag: 'Channel',
          subtitle: 'Payment • Proofs • Updates',
          username: 'Earning_Money_Lob',
          url: 'https://t.me/Earning_Money_Lob'
        }
      ];

  // Core verification worker - STRICT REAL-TIME BOT CHECK
  const performVerification = async (isManualClick = false) => {
    if (!user?.telegramId) {
      setIsVerifyingInitial(false);
      return;
    }

    if (isManualClick) setChecking(true);
    setAdminNotice(null);

    const token = config.botToken || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BOT_TOKEN) || "";
    if (!token) {
      if (isManualClick) toast.error("বট কনফিগারেশন পাওয়া যায়নি!");
      if (isManualClick) setChecking(false);
      setIsVerifyingInitial(false);
      return;
    }

    try {
      const nextJoined: Record<string, boolean> = {};
      const missingNames: string[] = [];
      let allMembers = true;

      for (const ch of channels) {
        if (!ch.username) {
          nextJoined[ch.id] = true;
          continue;
        }

        try {
          const res = await checkTelegramMembership(token, ch.username, user.telegramId);

          if (res.ok && res.isMember) {
            // Strictly verified as active member/creator/admin by Telegram Bot API
            nextJoined[ch.id] = true;
          } else if (res.needsBotAdmin) {
            // Bot is NOT yet an admin in this channel (Telegram returns member list is inaccessible)
            setAdminNotice(`⚠️ বটের মেম্বারশিপ চেকের জন্য @${ch.username} এ বটকে অ্যাডমিন করতে হবে`);
            // In manual verify mode or clicked, permit temporary pass
            const passed = Boolean(clickedMap[ch.id] || isManualClick);
            nextJoined[ch.id] = passed;
            if (!passed) {
              allMembers = false;
              missingNames.push(ch.name);
            }
          } else {
            // DEFINITIVELY NOT IN CHANNEL (User left, unjoined, or never joined)
            nextJoined[ch.id] = false;
            allMembers = false;
            missingNames.push(ch.name);
          }
        } catch (err) {
          console.warn("[Verification] Channel check error:", ch.username, err);
          nextJoined[ch.id] = false;
          allMembers = false;
          missingNames.push(ch.name);
        }
      }

      setJoinedMap(nextJoined);

      if (allMembers) {
        // User passed all channel checks!
        sessionStorage.setItem(`tg_gate_ok_${user.telegramId}`, '1');
        setIsVerifiedState(true);

        appStore.update((draft) => {
          const u = draft.users[user.telegramId];
          if (u) u.verified = true;
        });
        syncUserToFirebase({ ...user, verified: true });

        if (isManualClick) {
          triggerHaptic("success");
          toast.success("🎉 অভিনন্দন! চ্যানেল ভেরিফিকেশন সফল হয়েছে।");
        }
      } else {
        // User has LEFT or is NOT in channels! IMMEDIATELY LOCK!
        const wasVerified = isVerifiedState;
        sessionStorage.removeItem(`tg_gate_ok_${user.telegramId}`);
        setIsVerifiedState(false);

        appStore.update((draft) => {
          const u = draft.users[user.telegramId];
          if (u) u.verified = false;
        });
        syncUserToFirebase({ ...user, verified: false });

        if (isManualClick) {
          triggerHaptic("error");
          toast.error(`⚠️ আপনি এখনো ${missingNames.join(" ও ")} এ নেই! দয়া করে চ্যানেলে জয়েন করুন।`);
        } else if (wasVerified) {
          triggerHaptic("error");
          toast.error("⚠️ চ্যানেল ভেরিফিকেশন প্রয়োজন। দয়া করে চ্যানেলে জয়েন করুন।");
        }
      }
    } catch (err) {
      console.error("[Verification] General error:", err);
      if (isManualClick) {
        toast.error("যাচাইকরণে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      }
    } finally {
      if (isManualClick) setChecking(false);
      setIsVerifyingInitial(false);
    }
  };

  // 1. Initial verification every time user enters the website (On Every Entry / Page Reload)
  useEffect(() => {
    if (!user?.telegramId) {
      setIsVerifyingInitial(false);
      return;
    }

    if (config.forceChannelVerification === false) {
      setIsVerifyingInitial(false);
      setIsVerifiedState(true);
      return;
    }

    setIsVerifyingInitial(true);
    const startTime = Date.now();

    performVerification(false).finally(() => {
      const elapsed = Date.now() - startTime;
      const minDisplayMs = 450;
      if (elapsed < minDisplayMs) {
        setTimeout(() => setIsVerifyingInitial(false), minDisplayMs - elapsed);
      } else {
        setIsVerifyingInitial(false);
      }
    });
  }, [user?.telegramId, config.forceChannelVerification]);

  // 2. Visibility, Tab Switch, Focus Return & 25-Second Continuous Background Surveillance
  useEffect(() => {
    if (config.forceChannelVerification === false || !user?.telegramId) return;

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        performVerification(false);
      }
    };

    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);

    // Continuous 25-second background interval check
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        performVerification(false);
      }
    }, 25000);

    return () => {
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
      clearInterval(interval);
    };
  }, [user?.telegramId, config.forceChannelVerification, channels, config.botToken]);

  const handleOpenChannel = (id: string, url: string) => {
    triggerHaptic("medium");
    setClickedMap((prev) => ({ ...prev, [id]: true }));
    openTelegramChat(url);
  };

  // If forceChannelVerification is disabled by admin, render website normally
  if (config.forceChannelVerification === false) {
    return <>{children}</>;
  }

  // The website is ALWAYS rendered underneath so the user clearly sees the site! ZERO BLUR!
  return (
    <div className="relative min-h-screen w-full">
      {/* 1. Underlying Website Content (100% sharp, zero blur) */}
      <div
        className={`transition-opacity duration-200 ${
          isVerifyingInitial || !isVerifiedState
            ? "pointer-events-none select-none opacity-85"
            : ""
        }`}
        aria-hidden={!isVerifiedState || isVerifyingInitial}
      >
        {children}
      </div>

      {/* 2. Loading State Overlay (Clean translucent tint - zero blur) */}
      {isVerifyingInitial && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/35 px-6 select-none animate-fadeIn">
          {/* Futuristic Red Cyber Emblem */}
          <div className="relative flex items-center justify-center">
            <div className="absolute -inset-2 rounded-full bg-red-600/20 animate-pulse" />
            <div className="relative h-20 w-20 rounded-full border-2 border-red-500 bg-gradient-to-b from-[#180306] via-[#100203] to-black shadow-[0_0_20px_rgba(255,42,58,0.7)] flex items-center justify-center">
              {/* Spinning Neon Ring */}
              <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-red-500 animate-spin" />
              <TelegramIcon className="h-9 w-9 text-red-500 drop-shadow-[0_0_8px_rgba(255,42,58,0.9)]" />
            </div>
          </div>

          {/* Loading Header */}
          <div className="mt-5 rounded-2xl bg-white px-5 py-3 shadow-xl text-center border border-red-100">
            <h2 className="text-sm font-black text-slate-800 tracking-tight">
              চ্যানেল মেম্বারশিপ যাচাই হচ্ছে...
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
              {config.appName || "ManeiShopBD"} • স্বয়ংক্রিয় ভেরিফিকেশন
            </p>
            {/* Tech Progress Bar */}
            <div className="mt-2.5 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100 mx-auto">
              <div className="h-full w-full bg-gradient-to-r from-red-500 via-rose-500 to-red-500 animate-[loading_1.2s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      )}

      {/* 3. Mandatory Channel Verification Modal (Translucent clean backdrop - ZERO blur!) */}
      {!isVerifyingInitial && !isVerifiedState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/35 overflow-y-auto select-none animate-fadeIn">
          {/* Centered Futuristic Red Verification Card */}
          <div className="relative w-full max-w-[325px] pt-8">
            
            {/* Top Centered Glowing Emblem: ManeiShopBD_Bot */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
              <div className="relative flex items-center justify-center">
                {/* Red Aura */}
                <div className="absolute -inset-1.5 rounded-full bg-red-600/30 animate-pulse" />

                {/* Emblem Circle */}
                <div className="relative h-16 w-16 rounded-full border-2 border-[#ff2a3a] bg-gradient-to-b from-[#250508] via-[#140204] to-black p-0.5 shadow-[0_0_20px_rgba(255,42,58,0.85),inset_0_0_12px_rgba(255,42,58,0.6)] flex items-center justify-center">
                  
                  {/* Central Stylized Shopping Bag Graphic */}
                  <div className="relative flex flex-col items-center justify-center">
                    <svg
                      viewBox="0 0 40 40"
                      className="h-8 w-8 text-red-500 drop-shadow-[0_0_6px_rgba(255,42,58,0.9)]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 13L12.5 33H27.5L30 13H10Z" fill="#32060a" stroke="#ff2a3a" />
                      <path d="M15 13V9C15 6.5 17.2 4.5 20 4.5C22.8 4.5 25 6.5 25 9V13" stroke="#ff2a3a" />
                      <path
                        d="M15 27V18L20 23L25 18V27"
                        stroke="#ffffff"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="28" cy="14" r="3.5" fill="#ff2a3a" stroke="#ffffff" strokeWidth="1" />
                      <text x="28" y="16.5" fill="#ffffff" fontSize="5" fontWeight="900" textAnchor="middle">
                        $
                      </text>
                    </svg>
                  </div>

                  {/* ManeiShopBD_Bot Text Ribbon Overlay */}
                  <div className="absolute -bottom-2 w-[90px] rounded-full bg-gradient-to-r from-[#990011] via-[#e6001a] to-[#990011] py-0.5 px-1 text-center shadow-[0_2px_6px_rgba(0,0,0,0.9),0_0_6px_rgba(255,42,58,0.8)] border border-[#ff4d5a]">
                    <span className="block text-[7.5px] font-black italic tracking-tighter text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)] truncate">
                      {config.botUsername || "ManeiShopBD_Bot"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Outer Cyber Box Container with Glowing Red Borders */}
            <div className="relative rounded-2xl border-2 border-[#ff2a3a] bg-gradient-to-b from-[#180306] via-[#0d0203] to-[#080102] px-3 pt-8 pb-3 shadow-[0_0_30px_rgba(255,42,58,0.65),inset_0_0_22px_rgba(255,42,58,0.35)]">
              
              {/* Tech Corner Accents */}
              <div className="absolute top-1.5 left-2 h-2 w-2 border-t-2 border-l-2 border-[#ff6677] opacity-80" />
              <div className="absolute top-1.5 right-2 h-2 w-2 border-t-2 border-r-2 border-[#ff6677] opacity-80" />
              <div className="absolute bottom-1.5 left-2 h-2 w-2 border-b-2 border-l-2 border-[#ff6677] opacity-80" />
              <div className="absolute bottom-1.5 right-2 h-2 w-2 border-b-2 border-r-2 border-[#ff6677] opacity-80" />

              {/* Header Title: Join Our Telegram Channels */}
              <div className="mt-1 text-center">
                <div className="inline-flex items-center justify-center gap-1.5">
                  <TelegramIcon className="h-4.5 w-4.5 text-[#ff2a3a] drop-shadow-[0_0_6px_rgba(255,42,58,0.9)]" />
                  <h2 className="text-base font-black uppercase tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                    Join Our
                  </h2>
                </div>
                <p className="text-base font-black uppercase tracking-tight text-[#ff2a3a] drop-shadow-[0_0_10px_rgba(255,42,58,0.9)] leading-tight">
                  Telegram Channels
                </p>

                {/* Mandatory Sub-heading */}
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-950/70 border border-red-500/40 px-2 py-0.5 text-[9px] font-bold text-red-300">
                  <ShieldAlert className="h-3 w-3 text-red-400" />
                  <span>ওয়েবসাইট ব্যবহারের জন্য ভেরিফিকেশন আবশ্যক</span>
                </div>
              </div>

              {/* Dynamic Channels Grid */}
              <div className={`mt-3 grid gap-2 ${channels.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {channels.map((ch) => {
                  const isJoined = Boolean(joinedMap[ch.id]);

                  return (
                    <div
                      key={ch.id}
                      className={`flex flex-col items-center justify-between rounded-xl border p-2 transition-all ${
                        isJoined
                          ? 'border-emerald-500/90 bg-[#06180c] shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                          : 'border-[#ff2a3a]/80 bg-gradient-to-b from-[#220407] to-[#120204] shadow-[0_0_8px_rgba(255,42,58,0.3)]'
                      }`}
                    >
                      {/* Circular Icon */}
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-md ${
                          isJoined
                            ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 border-emerald-400'
                            : 'bg-gradient-to-b from-[#ff3344] via-[#ee1122] to-[#990011] border-[#ff5566]'
                        }`}
                      >
                        {isJoined ? (
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        ) : (
                          <TelegramIcon className="h-4 w-4 text-white drop-shadow" />
                        )}
                      </div>

                      {/* Title & Subtitle */}
                      <div className="mt-1.5 text-center">
                        <h3 className="text-[11px] font-black tracking-tight leading-none">
                          <span className="text-white">{ch.name} </span>
                          <span className="text-[#ff2a3a]">{ch.tag || 'Channel'}</span>
                        </h3>
                        <p className="mt-1 text-[7.5px] font-medium text-slate-300 leading-tight">
                          {ch.subtitle || `@${ch.username}`}
                        </p>
                      </div>

                      {/* Button */}
                      {isJoined ? (
                        <div className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-emerald-600/90 py-1 px-1.5 text-[9.5px] font-black text-white shadow-sm border border-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Joined ✅</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenChannel(ch.id, ch.url)}
                          className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-gradient-to-b from-[#ff3b4b] via-[#e60d21] to-[#990011] py-1 px-1.5 text-[9.5px] font-black text-white shadow-[0_3px_8px_rgba(255,42,58,0.7),inset_0_1px_1px_rgba(255,255,255,0.5)] border border-[#ff5566] hover:brightness-110 active:scale-95 transition"
                        >
                          <TelegramIcon className="h-3 w-3 text-white shrink-0" />
                          <span className="truncate">Join Channel</span>
                          <span className="text-[10px]">→</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Admin Tip Notice if any */}
              {adminNotice && (
                <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-1.5 text-center">
                  <p className="text-[8.5px] text-amber-300 font-bold leading-tight">
                    {adminNotice}
                  </p>
                </div>
              )}

              {/* Central Main Verification Button */}
              <div className="mt-3">
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => performVerification(true)}
                  className="relative w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 py-2.5 px-3 text-xs font-black text-white shadow-[0_4px_16px_rgba(255,42,58,0.75),inset_0_1px_2px_rgba(255,255,255,0.4)] border border-red-400 hover:brightness-110 active:scale-98 transition disabled:opacity-75"
                >
                  {checking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>বটের মাধ্যমে যাচাই হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                      <span>চ্যানেল ভেরিফাই করুন (Verify)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Bottom Alert / Bell Footer */}
              <div className="mt-2.5 flex items-center justify-center gap-1.5 border-t border-red-950/80 pt-2">
                <div className="flex items-center text-[#ff2a3a]">
                  <span className="text-[10px] font-black text-[#ff2a3a]">((</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="mx-0.5 h-3.5 w-3.5 text-[#ff2a3a] animate-bounce drop-shadow-[0_0_6px_rgba(255,42,58,0.9)]"
                  >
                    <path d="M12 2C10.34 2 9 3.34 9 5V5.29C6.71 6.36 5 8.78 5 11.5V17L3 19V20H21V19L19 17V11.5C19 8.78 17.29 6.36 15 5.29V5C15 3.34 13.66 2 12 2ZM10 21C10 22.1 10.9 23 12 23C13.1 23 14 22.1 14 21H10Z" />
                  </svg>
                  <span className="text-[10px] font-black text-[#ff2a3a]">))</span>
                </div>
                <p className="text-[9.5px] font-bold text-slate-300 tracking-wide">
                  Don't miss any <span className="text-[#ff3b4b] font-black">update!</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TelegramIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21.5 3.5L2.8 10.7c-.9.4-.9 1.4 0 1.7l4.8 1.5 1.8 5.7c.3.8 1.3.9 1.8.3l2.7-2.6 5.3 3.9c.8.6 1.9.1 2.1-.9l3.3-15.5c.3-1.2-.8-2.2-2-1.8zM9.6 13.5l8.7-6.2c.2-.1.3.1.2.3l-7.3 7.8-.3 3.4-1.3-5.3z" />
    </svg>
  );
}
