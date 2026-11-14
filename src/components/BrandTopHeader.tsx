import { useState } from 'react';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { formatUsd } from '../lib/format';
import smartEarningLogo from '../assets/images/smart_earning_logo.png';

export function BrandTopHeader() {
  const { user } = useAuth();
  const db = useAppStore();
  const [logoFailed, setLogoFailed] = useState(false);

  const liveUser = user?.telegramId && db.users[user.telegramId] ? db.users[user.telegramId] : user;
  if (!liveUser) return null;

  return (
    <header className="flex items-center justify-between gap-2 border-b border-orange-200/60 bg-gradient-to-r from-[#fff3eb] via-[#fffaf6] to-[#ffedf1] px-3 py-2 shadow-xs">
      <div className="flex min-w-0 flex-1 items-center">
        {!logoFailed ? (
          <img
            src={smartEarningLogo}
            alt="Smart Earning"
            loading="eager"
            decoding="sync"
            onError={() => setLogoFailed(true)}
            className="h-11 w-auto max-w-[205px] object-contain object-left"
          />
        ) : (
          <span className="truncate text-[16px] font-extrabold tracking-tight text-ink">
            Smart Earning
          </span>
        )}
      </div>
      <div className="shrink-0 rounded-xl border border-orange-200/70 bg-white/90 px-2.5 py-1 text-right shadow-xs">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-orange-600">
          Balance
        </p>
        <p className="text-[13px] font-extrabold text-ink tabular-nums">
          {formatUsd(liveUser.balance)}
        </p>
      </div>
    </header>
  );
}
