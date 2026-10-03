import React, { useState, useEffect } from 'react';
import { X, Bell } from 'lucide-react';
import { openTelegramChat, triggerHaptic } from '../lib/telegram';

const STORAGE_POPUP_DISMISSED = "mshop_tg_popup_closed";

export function TelegramChannelsPopup() {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    // Show popup shortly after component mounts
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    triggerHaptic("light");
    setIsOpen(false);
  };

  const handleJoin = (url: string) => {
    triggerHaptic("medium");
    openTelegramChat(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside to close backdrop */}
      <div className="absolute inset-0" onClick={handleClose} />

      {/* Main Card Modal Container */}
      <div className="relative z-10 w-full max-w-[390px] pt-11">
        {/* Top Floating Badge Logo */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            {/* Outer Red Glow */}
            <div className="absolute -inset-1.5 rounded-full bg-red-600/40 blur-md animate-pulse"></div>

            {/* Circular Badge Frame */}
            <div className="relative h-20 w-20 rounded-full border-2 border-red-500 bg-gradient-to-b from-[#1b080a] via-[#100406] to-black p-1 shadow-[0_0_20px_rgba(239,68,68,0.7),inset_0_0_12px_rgba(239,68,68,0.5)] flex items-center justify-center">
              {/* Inner Decorative Tech Ring */}
              <div className="absolute inset-1 rounded-full border border-red-500/30 border-dashed"></div>

              {/* Central Graphic (Shopping Bag with M & Cart) */}
              <div className="flex flex-col items-center justify-center text-center">
                <svg
                  viewBox="0 0 48 48"
                  className="h-10 w-10 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {/* Shopping Bag Outline */}
                  <path d="M12 16L15 40H33L36 16H12Z" fill="#2a090d" stroke="#ef4444" />
                  {/* Handle */}
                  <path d="M18 16V11C18 7.68 20.68 5 24 5C27.32 5 30 7.68 30 11V16" stroke="#ef4444" />
                  {/* 'M' Letter inside bag */}
                  <path
                    d="M19 33V22L24 28L29 22V33"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Small dollar sign tag */}
                  <circle cx="34" cy="18" r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
                  <text x="34" y="21" fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                    $
                  </text>
                </svg>
              </div>

              {/* ManeiShopBD_Bot Ribbon Banner */}
              <div className="absolute -bottom-2 w-[105px] rounded bg-gradient-to-r from-red-800 via-red-600 to-red-800 py-0.5 px-1 text-center shadow-[0_2px_8px_rgba(0,0,0,0.8),0_0_8px_rgba(239,68,68,0.6)] border border-red-400">
                <span className="block text-[8px] font-black italic tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                  ManeiShopBD_Bot
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Outer Sci-Fi Red Glowing Box */}
        <div className="relative rounded-3xl border-2 border-red-600 bg-gradient-to-b from-[#160608] via-[#0d0305] to-[#080203] px-3.5 pt-10 pb-4 shadow-[0_0_35px_rgba(220,38,38,0.55),inset_0_0_25px_rgba(220,38,38,0.25)]">
          {/* Top Corner Bevel Tech Accents */}
          <div className="absolute top-2 left-3 h-2.5 w-2.5 border-t-2 border-l-2 border-red-400 opacity-80" />
          <div className="absolute top-2 right-3 h-2.5 w-2.5 border-t-2 border-r-2 border-red-400 opacity-80" />
          <div className="absolute bottom-2 left-3 h-2.5 w-2.5 border-b-2 border-l-2 border-red-400 opacity-80" />
          <div className="absolute bottom-2 right-3 h-2.5 w-2.5 border-b-2 border-r-2 border-red-400 opacity-80" />

          {/* Close 'X' Button */}
          <button
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-950/80 border border-red-500/50 text-red-300 hover:bg-red-900 hover:text-white transition active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header Title: Join Our Telegram Channels */}
          <div className="mt-2 text-center">
            <div className="inline-flex items-center justify-center gap-2">
              {/* Red Telegram Icon */}
              <TelegramIcon className="h-6 w-6 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                Join Our
              </h2>
            </div>
            <p className="text-xl sm:text-2xl font-black uppercase tracking-tight text-red-500 drop-shadow-[0_0_14px_rgba(239,68,68,0.9)]">
              Telegram Channels
            </p>
          </div>

          {/* Two Channel Cards Grid */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {/* 1. Main Channel Card */}
            <div className="flex flex-col items-center justify-between rounded-2xl border border-red-500/80 bg-gradient-to-b from-[#20080b] to-[#120305] p-2.5 shadow-[0_0_12px_rgba(220,38,38,0.25)] hover:border-red-400 transition">
              {/* Red Circular Icon with Paper Plane */}
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-red-500 via-red-600 to-red-800 shadow-[0_0_12px_rgba(239,68,68,0.7),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-red-400">
                <TelegramIcon className="h-5 w-5 text-white drop-shadow" />
              </div>

              {/* Title & Subtitle */}
              <div className="mt-2 text-center">
                <h3 className="text-xs font-black tracking-tight leading-tight">
                  <span className="text-white">Main </span>
                  <span className="text-red-500">Channel</span>
                </h3>
                <p className="mt-0.5 text-[9px] font-medium text-slate-300 leading-tight">
                  All Videos • Updates • News
                </p>
              </div>

              {/* Join Channel Button */}
              <button
                type="button"
                onClick={() => handleJoin("https://t.me/jgjghjghh687")}
                className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-full bg-gradient-to-b from-red-500 via-red-600 to-red-800 py-1.5 px-2 text-[10.5px] font-extrabold text-white shadow-[0_4px_10px_rgba(220,38,38,0.6),inset_0_1px_2px_rgba(255,255,255,0.4)] border border-red-400 hover:brightness-110 active:scale-95 transition"
              >
                <TelegramIcon className="h-3.5 w-3.5 text-white shrink-0" />
                <span className="truncate">Join Channel</span>
                <span className="text-xs">→</span>
              </button>
            </div>

            {/* 2. Payment Proof Channel Card */}
            <div className="flex flex-col items-center justify-between rounded-2xl border border-red-500/80 bg-gradient-to-b from-[#20080b] to-[#120305] p-2.5 shadow-[0_0_12px_rgba(220,38,38,0.25)] hover:border-red-400 transition">
              {/* Red Circular Icon with Paper Plane */}
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-red-500 via-red-600 to-red-800 shadow-[0_0_12px_rgba(239,68,68,0.7),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-red-400">
                <TelegramIcon className="h-5 w-5 text-white drop-shadow" />
              </div>

              {/* Title & Subtitle */}
              <div className="mt-2 text-center">
                <h3 className="text-xs font-black tracking-tight leading-tight">
                  <span className="text-white">Payment </span>
                  <span className="text-red-500">Channel</span>
                </h3>
                <p className="mt-0.5 text-[9px] font-medium text-slate-300 leading-tight">
                  Payment • Proofs • Updates
                </p>
              </div>

              {/* Join Channel Button */}
              <button
                type="button"
                onClick={() => handleJoin("https://t.me/Earning_Money_Lob")}
                className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-full bg-gradient-to-b from-red-500 via-red-600 to-red-800 py-1.5 px-2 text-[10.5px] font-extrabold text-white shadow-[0_4px_10px_rgba(220,38,38,0.6),inset_0_1px_2px_rgba(255,255,255,0.4)] border border-red-400 hover:brightness-110 active:scale-95 transition"
              >
                <TelegramIcon className="h-3.5 w-3.5 text-white shrink-0" />
                <span className="truncate">Join Channel</span>
                <span className="text-xs">→</span>
              </button>
            </div>
          </div>

          {/* Bottom Alert / Bell Footer */}
          <div className="mt-3.5 flex items-center justify-center gap-2 border-t border-red-900/50 pt-2.5">
            {/* Sound waves & bell */}
            <div className="flex items-center text-red-500">
              <span className="text-xs font-bold text-red-500/80">((</span>
              <Bell className="mx-1 h-3.5 w-3.5 text-red-500 fill-red-500 animate-bounce" />
              <span className="text-xs font-bold text-red-500/80">))</span>
            </div>
            <p className="text-[11px] font-bold text-slate-300 tracking-wide">
              Don't miss any <span className="text-red-400 font-extrabold">update!</span>
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
