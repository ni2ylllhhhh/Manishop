import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Copy, Check, Send, Info, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAppStore } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import { maskUid, formatDate } from '../lib/format';
import { triggerHaptic, openTelegramChat } from '../lib/telegram';

const BANNER_URL = "https://amazing-fairy-6d0c51.netlify.app/4ccd8c3d-84d2-4e12-a833-285bbc15ab1f.jpg";

export function Refer() {
  const { user, config } = useAuth();
  const db = useAppStore();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'l1' | 'l2'>('overview');

  const { l1, l2 } = useMemo(() => {
    if (!user) return { l1: [], l2: [] };
    const myRefs = db.referrals.filter((r) => r.referrerTelegramId === user.telegramId);
    return {
      l1: myRefs.filter((r) => r.level === 1),
      l2: myRefs.filter((r) => r.level === 2)
    };
  }, [db.referrals, user]);

  if (!user) return null;

  const botUser = config.botUsername.replace(/^@/, '');
  const referralLink = `https://t.me/${botUser}/app?startapp=${user.telegramId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
    } catch {
      // Fallback
    }
    setCopied(true);
    triggerHaptic("success");
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 1800);
  };

  const handleShare = () => {
    const text = encodeURIComponent(
      `🔥 Join ${config.appName}! Watch daily ads, complete quick tasks and earn USDT directly to your Binance wallet. Start now:`
    );
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`;
    openTelegramChat(tgUrl);
  };

  const currentList = activeTab === 'l2' ? l2 : l1;

  return (
    <main className="px-3 pt-3">
      {/* Invite Banner */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <img
          src={BANNER_URL}
          alt="Invite friends"
          className="w-full object-cover"
        />
      </div>

      {/* 3-Stat Row (Handshake box removed as requested) */}
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <StatPill label="L1 TOTAL" value={String(user.referralCount)} tone="text-ink" />
        <StatPill label="L2 TOTAL" value={String(user.level2Count)} tone="text-blue-600" />
        <StatPill label="EARNED" value={`$${user.referralEarned.toFixed(2)}`} tone="text-purple-600" />
      </div>

      {/* Bonus Callout */}
      <p className="mt-2.5 rounded-2xl bg-white px-3 py-2.5 text-center text-[11px] font-semibold leading-relaxed text-red-500 shadow-card">
        🔥 প্রতি সফল রেফারলে সাথে সাথে পাবেন <b>${config.referralBonus.toFixed(2)}</b> বোনাস!
      </p>

      {/* Link Sharing Box */}
      <section className="mt-2.5 rounded-2xl bg-white p-3 shadow-card">
        <div className="mb-2 flex items-center gap-2 border-b border-black/5">
          <span className="border-b-2 border-[#229ED9] pb-1.5 text-[11px] font-extrabold tracking-wide text-[#229ED9]">
            TELEGRAM LINK
          </span>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-blue-50/60 px-2.5 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
          <p className="text-[10px] leading-relaxed text-blue-900">
            আপনার ইউনিক রেফারেল লিংক বন্ধুদের সাথে টেলিগ্রামে শেয়ার করুন এবং প্রতিটি লেভেল থেকে আজীবন কমিশন পান।
          </p>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate rounded-xl border border-black/5 bg-cream px-3 py-2 font-mono text-[11px] text-gray-500">
            {referralLink}
          </div>
          <button
            onClick={handleCopy}
            aria-label="Copy referral link"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition active:scale-95"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <button
          onClick={handleShare}
          className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#3390EC] text-[13px] font-bold text-white transition hover:bg-[#2b7ecd] active:scale-98"
        >
          <Send className="h-4 w-4" /> Share on Telegram
        </button>
      </section>

      {/* Referral Hierarchy Tabs */}
      <section className="mt-2.5 rounded-2xl bg-white shadow-card">
        <div className="flex border-b border-black/5">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            label="OVERVIEW"
          />
          <TabButton
            active={activeTab === 'l1'}
            onClick={() => setActiveTab('l1')}
            label="LEVEL 1"
            count={l1.length}
          />
          <TabButton
            active={activeTab === 'l2'}
            onClick={() => setActiveTab('l2')}
            label="LEVEL 2"
            count={l2.length}
          />
        </div>

        {activeTab === 'overview' ? (
          <div className="flex flex-col items-center px-3 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-[13px] font-extrabold text-white shadow-md">
              YOU
            </div>

            <div className="mt-3 grid w-full grid-cols-2 gap-2">
              <InfoBox label="Level 1 Bonus" value={`$${config.referralBonus.toFixed(2)}`} />
              <InfoBox label="Level 2 Bonus" value={`$${config.level2Bonus.toFixed(2)}`} />
              <InfoBox label="Total Referrals" value={String(l1.length + l2.length)} />
              <InfoBox label="Referral Income" value={`$${user.referralEarned.toFixed(2)}`} />
            </div>

            <p className="mt-3 text-center text-[10.5px] leading-relaxed text-gray-500">
              Withdraw করার জন্য নূন্যতম <b>{config.minReferralsForWithdraw} জন</b> সফল রেফার প্রয়োজন। (আপনার রেফার: <b>{user.referralCount} জন</b>)
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {currentList.length === 0 && (
              <li className="px-3 py-6 text-center text-[11px] text-gray-400">
                এই লেভেলে এখনও কোনো রেফারেল নেই।
              </li>
            )}
            {currentList.map((ref) => {
              const refUser = db.users[ref.referredTelegramId];
              return (
                <li key={ref.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <Avatar src={refUser?.photoUrl} name={refUser?.firstName || "User"} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-ink">
                      {refUser ? `${refUser.firstName} ${refUser.lastName}`.trim() : "User"}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">
                      UID: {maskUid(ref.referredTelegramId)} • {formatDate(ref.createdAt)}
                    </p>
                  </div>
                  <span className="text-[12px] font-extrabold text-money">
                    +${ref.bonus.toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-white px-1.5 py-2 text-center shadow-card">
      <p className="text-[8.5px] font-extrabold tracking-wide text-gray-400">{label}</p>
      <p className={`mt-0.5 text-[15px] font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream px-2.5 py-2 border border-black/5">
      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-[13px] font-extrabold text-ink">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1 border-b-2 py-2 text-[10.5px] font-extrabold tracking-wide transition-colors ${
        active ? "border-brand-500 text-brand-600" : "border-transparent text-gray-400 hover:text-gray-600"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className="rounded-full bg-brand-50 px-1.5 text-[9px] text-brand-600">
          {count}
        </span>
      )}
    </button>
  );
}
