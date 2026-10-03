import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { openTelegramChat, triggerHaptic } from '../lib/telegram';

export function TelegramChannelsPopup() {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    // Show popup shortly after component loads
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 300);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={handleClose} />

      {/* Main Compact Modal Wrapper */}
      <div className="relative z-10 w-full max-w-[320px] pt-8 select-none">
        
        {/* Top Centered Circular Emblem: ManeiShopBD_Bot */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            {/* Outer Red Fiery Glow */}
            <div className="absolute -inset-1 rounded-full bg-red-600/60 blur-md animate-pulse" />

            {/* Emblem Circle */}
            <div className="relative h-16 w-16 rounded-full border-2 border-[#ff2a3a] bg-gradient-to-b from-[#250508] via-[#140204] to-black p-0.5 shadow-[0_0_16px_rgba(255,42,58,0.8),inset_0_0_10px_rgba(255,42,58,0.6)] flex items-center justify-center overflow-visible">
              
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
                  {/* Shopping Bag Base */}
                  <path d="M10 13L12.5 33H27.5L30 13H10Z" fill="#32060a" stroke="#ff2a3a" />
                  {/* Handle */}
                  <path d="M15 13V9C15 6.5 17.2 4.5 20 4.5C22.8 4.5 25 6.5 25 9V13" stroke="#ff2a3a" />
                  {/* Red Letter 'M' in center */}
                  <path
                    d="M15 27V18L20 23L25 18V27"
                    stroke="#ffffff"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Dollar tag */}
                  <circle cx="28" cy="14" r="3.5" fill="#ff2a3a" stroke="#ffffff" strokeWidth="1" />
                  <text x="28" y="16.5" fill="#ffffff" fontSize="5" fontWeight="900" textAnchor="middle">
                    $
                  </text>
                </svg>
              </div>

              {/* ManeiShopBD_Bot Text Ribbon Overlay */}
              <div className="absolute -bottom-2 w-[88px] rounded-full bg-gradient-to-r from-[#990011] via-[#e6001a] to-[#990011] py-0.5 px-1 text-center shadow-[0_2px_6px_rgba(0,0,0,0.9),0_0_6px_rgba(255,42,58,0.8)] border border-[#ff4d5a]">
                <span className="block text-[7.5px] font-black italic tracking-tighter text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)] truncate">
                  ManeiShopBD_Bot
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Outer Cyber Box Container with Glowing Red Borders */}
        <div className="relative rounded-2xl border-2 border-[#ff2a3a] bg-gradient-to-b from-[#180306] via-[#0d0203] to-[#080102] px-2.5 pt-8 pb-2.5 shadow-[0_0_24px_rgba(255,42,58,0.6),inset_0_0_20px_rgba(255,42,58,0.3)]">
          
          {/* Beveled Tech Corner Accents */}
          <div className="absolute top-1.5 left-2 h-2 w-2 border-t-2 border-l-2 border-[#ff6677] opacity-80" />
          <div className="absolute top-1.5 right-2 h-2 w-2 border-t-2 border-r-2 border-[#ff6677] opacity-80" />
          <div className="absolute bottom-1.5 left-2 h-2 w-2 border-b-2 border-l-2 border-[#ff6677] opacity-80" />
          <div className="absolute bottom-1.5 right-2 h-2 w-2 border-b-2 border-r-2 border-[#ff6677] opacity-80" />

          {/* Close 'X' Button */}
          <button
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 border border-red-500/60 text-red-300 hover:bg-red-950 hover:text-white transition active:scale-90"
          >
            <X className="h-3 w-3" />
          </button>

          {/* Header Title: Join Our Telegram Channels */}
          <div className="mt-1 text-center">
            <div className="inline-flex items-center justify-center gap-1.5">
              {/* Red Telegram Icon */}
              <TelegramIcon className="h-4.5 w-4.5 text-[#ff2a3a] drop-shadow-[0_0_6px_rgba(255,42,58,0.9)]" />
              <h2 className="text-base font-black uppercase tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                Join Our
              </h2>
            </div>
            <p className="text-base font-black uppercase tracking-tight text-[#ff2a3a] drop-shadow-[0_0_10px_rgba(255,42,58,0.9)] leading-tight">
              Telegram Channels
            </p>
          </div>

          {/* Two Channel Cards Side-by-Side */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            
            {/* 1. Main Channel Card */}
            <div className="flex flex-col items-center justify-between rounded-xl border border-[#ff2a3a]/80 bg-gradient-to-b from-[#220407] to-[#120204] p-2 shadow-[0_0_8px_rgba(255,42,58,0.3)]">
              {/* Red Circular Icon with Paper Plane */}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-[#ff3344] via-[#ee1122] to-[#990011] shadow-[0_0_10px_rgba(255,42,58,0.7),inset_0_1px_1px_rgba(255,255,255,0.5)] border border-[#ff5566]">
                <TelegramIcon className="h-4 w-4 text-white drop-shadow" />
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

              {/* Join Channel Button */}
              <button
                type="button"
                onClick={() => handleJoin("https://t.me/jgjghjghh687")}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-gradient-to-b from-[#ff3b4b] via-[#e60d21] to-[#990011] py-1 px-1.5 text-[9.5px] font-black text-white shadow-[0_3px_8px_rgba(255,42,58,0.7),inset_0_1px_1px_rgba(255,255,255,0.5)] border border-[#ff5566] hover:brightness-110 active:scale-95 transition"
              >
                <TelegramIcon className="h-3 w-3 text-white shrink-0" />
                <span className="truncate">Join Channel</span>
                <span className="text-[10px]">→</span>
              </button>
            </div>

            {/* 2. Payment Proof Channel Card */}
            <div className="flex flex-col items-center justify-between rounded-xl border border-[#ff2a3a]/80 bg-gradient-to-b from-[#220407] to-[#120204] p-2 shadow-[0_0_8px_rgba(255,42,58,0.3)]">
              {/* Red Circular Icon with Paper Plane */}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-[#ff3344] via-[#ee1122] to-[#990011] shadow-[0_0_10px_rgba(255,42,58,0.7),inset_0_1px_1px_rgba(255,255,255,0.5)] border border-[#ff5566]">
                <TelegramIcon className="h-4 w-4 text-white drop-shadow" />
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

              {/* Join Channel Button */}
              <button
                type="button"
                onClick={() => handleJoin("https://t.me/Earning_Money_Lob")}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-gradient-to-b from-[#ff3b4b] via-[#e60d21] to-[#990011] py-1 px-1.5 text-[9.5px] font-black text-white shadow-[0_3px_8px_rgba(255,42,58,0.7),inset_0_1px_1px_rgba(255,255,255,0.5)] border border-[#ff5566] hover:brightness-110 active:scale-95 transition"
              >
                <TelegramIcon className="h-3 w-3 text-white shrink-0" />
                <span className="truncate">Join Channel</span>
                <span className="text-[10px]">→</span>
              </button>
            </div>
          </div>

          {/* Bottom Alert / Bell Footer */}
          <div className="mt-2.5 flex items-center justify-center gap-1.5 border-t border-red-950/80 pt-2">
            {/* Red Sound Waves & Bell */}
            <div className="flex items-center text-[#ff2a3a]">
              <span className="text-[10px] font-black text-[#ff2a3a]">((</span>
              {/* Bell SVG */}
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
