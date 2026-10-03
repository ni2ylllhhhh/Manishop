import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Loader2, ShieldAlert, Sparkles, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { appStore } from '../lib/store';
import { syncUserToFirebase } from '../lib/firebase';
import { openTelegramChat, triggerHaptic } from '../lib/telegram';

const REQUIRED_CHANNELS = [
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

export function ChannelVerificationGate({ children }: { children: React.ReactNode }) {
  const { user, config } = useAuth();
  const [checking, setChecking] = useState(false);
  const [channel1Joined, setChannel1Joined] = useState(false);
  const [channel2Joined, setChannel2Joined] = useState(false);
  const [hasClickedChannel1, setHasClickedChannel1] = useState(false);
  const [hasClickedChannel2, setHasClickedChannel2] = useState(false);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  // If user is already verified, render the application directly
  const isVerified = Boolean(user?.verified);

  const checkMembership = async (showToasts = true) => {
    if (!user?.telegramId) return;
    setChecking(true);
    setAdminNotice(null);

    const token = config.botToken || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BOT_TOKEN) || "";
    if (!token) {
      toast.error("বট কনফিগারেশন অনুপস্থিত!");
      setChecking(false);
      return;
    }

    try {
      let isCh1Member = false;
      let isCh2Member = false;

      // 1. Check Channel 1 (@jgjghjghh687)
      try {
        const res1 = await fetch(
          `https://api.telegram.org/bot${token}/getChatMember?chat_id=@${REQUIRED_CHANNELS[0].username}&user_id=${user.telegramId}`
        );
        const data1 = await res1.json().catch(() => ({}));
        if (data1.ok) {
          const st = data1.result?.status;
          isCh1Member = st === "creator" || st === "administrator" || st === "member" || st === "restricted";
        } else if (data1.description && data1.description.includes("member list is inaccessible")) {
          // If the bot is not yet promoted to admin in Channel 1, but user clicked join link
          setAdminNotice("টিপ: বটের ফুল ভেরিফিকেশনের জন্য @ManeiShopBD_Bot কে মেইন চ্যানেলে অ্যাডমিন করুন।");
          if (hasClickedChannel1) {
            isCh1Member = true;
          }
        }
      } catch (e) {
        console.warn("Ch1 check error:", e);
      }

      // 2. Check Channel 2 (@Earning_Money_Lob)
      try {
        const res2 = await fetch(
          `https://api.telegram.org/bot${token}/getChatMember?chat_id=@${REQUIRED_CHANNELS[1].username}&user_id=${user.telegramId}`
        );
        const data2 = await res2.json().catch(() => ({}));
        if (data2.ok) {
          const st = data2.result?.status;
          isCh2Member = st === "creator" || st === "administrator" || st === "member" || st === "restricted";
        } else if (data2.description && data2.description.includes("member list is inaccessible")) {
          if (hasClickedChannel2) {
            isCh2Member = true;
          }
        }
      } catch (e) {
        console.warn("Ch2 check error:", e);
      }

      setChannel1Joined(isCh1Member);
      setChannel2Joined(isCh2Member);

      if (isCh1Member && isCh2Member) {
        triggerHaptic("success");
        if (showToasts) {
          toast.success("🎉 অভিনন্দন! চ্যানেল ভেরিফিকেশন সফল হয়েছে।");
        }

        // Update local user state
        appStore.update((draft) => {
          const u = draft.users[user.telegramId];
          if (u) {
            u.verified = true;
          }
        });

        // Persist verified state to Firebase Realtime Database
        const updatedUser = { ...user, verified: true };
        syncUserToFirebase(updatedUser);
      } else {
        triggerHaptic("error");
        if (showToasts) {
          const missing = [];
          if (!isCh1Member) missing.push("মেইন চ্যানেল");
          if (!isCh2Member) missing.push("পেমেন্ট চ্যানেল");
          toast.error(`⚠️ আপনি এখনো ${missing.join(" ও ")} এ জয়েন করেননি!`);
        }
      }
    } catch (err) {
      console.error("Verification error:", err);
      if (showToasts) {
        toast.error("যাচাইকরণে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      }
    } finally {
      setChecking(false);
    }
  };

  const handleOpenChannel = (index: number, url: string) => {
    triggerHaptic("medium");
    if (index === 0) setHasClickedChannel1(true);
    if (index === 1) setHasClickedChannel2(true);
    openTelegramChat(url);
  };

  // If already verified, allow full access
  if (isVerified) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md select-none">
      {/* Centered Futuristic Red Verification Card */}
      <div className="relative w-full max-w-[325px] pt-8">
        
        {/* Top Centered Glowing Emblem: ManeiShopBD_Bot */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            {/* Red Pulsing Aura */}
            <div className="absolute -inset-1.5 rounded-full bg-red-600/60 blur-md animate-pulse" />

            {/* Emblem Circle */}
            <div className="relative h-16 w-16 rounded-full border-2 border-[#ff2a3a] bg-gradient-to-b from-[#250508] via-[#140204] to-black p-0.5 shadow-[0_0_20px_rgba(255,42,58,0.85),inset_0_0_12px_rgba(255,42,58,0.6)] flex items-center justify-center">
              
              {/* Central Stylized Shopping Bag & Cart Graphic */}
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
                  ManeiShopBD_Bot
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

          {/* Two Channel Cards Side-by-Side */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            
            {/* 1. Main Channel Card */}
            <div className={`flex flex-col items-center justify-between rounded-xl border p-2 transition-all ${
              channel1Joined 
                ? 'border-emerald-500/90 bg-[#06180c] shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                : 'border-[#ff2a3a]/80 bg-gradient-to-b from-[#220407] to-[#120204] shadow-[0_0_8px_rgba(255,42,58,0.3)]'
            }`}>
              {/* Circular Icon */}
              <div className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-md ${
                channel1Joined 
                  ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 border-emerald-400' 
                  : 'bg-gradient-to-b from-[#ff3344] via-[#ee1122] to-[#990011] border-[#ff5566]'
              }`}>
                {channel1Joined ? (
                  <CheckCircle2 className="h-5 w-5 text-white" />
                ) : (
                  <TelegramIcon className="h-4 w-4 text-white drop-shadow" />
                )}
              </div>

              {/* Title & Subtitle */}
              <div className="mt-1.5 text-center">
                <h3 className="text-[11px] font-black tracking-tight leading-none">
                  <span className="text-white">Main </span>
                  <span className="text-[#ff2a3a]">Channel</span>
                </h3>
                <p className="mt-1 text-[7.5px] font-medium text-slate-300 leading-tight">
                  All Videos • Updates • News
                </p>
              </div>

              {/* Button */}
              {channel1Joined ? (
                <div className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-emerald-600/90 py-1 px-1.5 text-[9.5px] font-black text-white shadow-sm border border-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Joined ✅</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenChannel(0, REQUIRED_CHANNELS[0].url)}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-gradient-to-b from-[#ff3b4b] via-[#e60d21] to-[#990011] py-1 px-1.5 text-[9.5px] font-black text-white shadow-[0_3px_8px_rgba(255,42,58,0.7),inset_0_1px_1px_rgba(255,255,255,0.5)] border border-[#ff5566] hover:brightness-110 active:scale-95 transition"
                >
                  <TelegramIcon className="h-3 w-3 text-white shrink-0" />
                  <span className="truncate">Join Channel</span>
                  <span className="text-[10px]">→</span>
                </button>
              )}
            </div>

            {/* 2. Payment Proof Channel Card */}
            <div className={`flex flex-col items-center justify-between rounded-xl border p-2 transition-all ${
              channel2Joined 
                ? 'border-emerald-500/90 bg-[#06180c] shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                : 'border-[#ff2a3a]/80 bg-gradient-to-b from-[#220407] to-[#120204] shadow-[0_0_8px_rgba(255,42,58,0.3)]'
            }`}>
              {/* Circular Icon */}
              <div className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-md ${
                channel2Joined 
                  ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 border-emerald-400' 
                  : 'bg-gradient-to-b from-[#ff3344] via-[#ee1122] to-[#990011] border-[#ff5566]'
              }`}>
                {channel2Joined ? (
                  <CheckCircle2 className="h-5 w-5 text-white" />
                ) : (
                  <TelegramIcon className="h-4 w-4 text-white drop-shadow" />
                )}
              </div>

              {/* Title & Subtitle */}
              <div className="mt-1.5 text-center">
                <h3 className="text-[11px] font-black tracking-tight leading-none">
                  <span className="text-white">Payment </span>
                  <span className="text-[#ff2a3a]">Channel</span>
                </h3>
                <p className="mt-1 text-[7.5px] font-medium text-slate-300 leading-tight">
                  Payment • Proofs • Updates
                </p>
              </div>

              {/* Button */}
              {channel2Joined ? (
                <div className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-emerald-600/90 py-1 px-1.5 text-[9.5px] font-black text-white shadow-sm border border-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Joined ✅</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenChannel(1, REQUIRED_CHANNELS[1].url)}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-gradient-to-b from-[#ff3b4b] via-[#e60d21] to-[#990011] py-1 px-1.5 text-[9.5px] font-black text-white shadow-[0_3px_8px_rgba(255,42,58,0.7),inset_0_1px_1px_rgba(255,255,255,0.5)] border border-[#ff5566] hover:brightness-110 active:scale-95 transition"
                >
                  <TelegramIcon className="h-3 w-3 text-white shrink-0" />
                  <span className="truncate">Join Channel</span>
                  <span className="text-[10px]">→</span>
                </button>
              )}
            </div>
          </div>

          {/* Admin Tip Notice if any */}
          {adminNotice && (
            <p className="mt-2 text-center text-[8.5px] text-amber-300/90 font-mono leading-tight">
              {adminNotice}
            </p>
          )}

          {/* Central Main Verification Button */}
          <div className="mt-3">
            <button
              type="button"
              disabled={checking}
              onClick={() => checkMembership(true)}
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
  );
}

function TelegramIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21.5 3.5L2.8 10.7c-.9.4-.9 1.4 0 1.7l4.8 1.5 1.8 5.7c.3.8 1.3.9 1.8.3l2.7-2.6 5.3 3.9c.8.6 1.9.1 2.1-.9l3.3-15.5c.3-1.2-.8-2.2-2-1.8zM9.6 13.5l8.7-6.2c.2-.1.3.1.2.3l-7.3 7.8-.3 3.4-1.3-5.3z" />
    </svg>
  );
}
