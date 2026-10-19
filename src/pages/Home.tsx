import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CirclePlay, Play, Zap, Globe, LoaderCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import { formatUsd } from '../lib/format';

export function Home() {
  const {
    user,
    config,
    startAd,
    startTask,
    claimPendingReward,
    pending,
    slotCountThisHour,
    totalAdsWatchedThisHour,
    hourlyLimitPerSlot
  } = useAuth();

  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    if (!pending) {
      setSecondsRemaining(0);
      return;
    }
    const updateTime = () => {
      const elapsed = (Date.now() - pending.startedAt) / 1000;
      const left = Math.max(0, Math.ceil(pending.minSeconds - elapsed));
      setSecondsRemaining(left);
    };
    updateTime();
    const interval = setInterval(updateTime, 500);
    return () => clearInterval(interval);
  }, [pending]);

  if (!user) return null;

  const totalPossibleThisHour = config.adSlots.length * hourlyLimitPerSlot;

  return (
    <main className="px-3 pt-3">
      {/* User Header Card */}
      <section className="mb-3 flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-card">
        <Avatar src={user.photoUrl} name={user.firstName} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-ink">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-[10px] text-gray-400 font-mono">
            ID: {user.telegramId}
          </p>
        </div>
        <div className="rounded-xl bg-brand-50 px-2.5 py-1 text-right">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-brand-500">
            Balance
          </p>
          <p className="text-[13px] font-extrabold text-ink">
            {formatUsd(user.balance)}
          </p>
        </div>
      </section>

      {/* Live Reward Progress Card when Ad/Task is in progress */}
      {pending && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 overflow-hidden rounded-2xl border border-brand-300 bg-gradient-to-r from-brand-50 via-white to-brand-50 p-3 shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white font-extrabold text-[12px] shadow-sm">
                <LoaderCircle className="h-4 w-4 animate-spin text-white" />
              </span>
              <div>
                <p className="text-[12px] font-black text-ink flex items-center gap-1.5">
                  <span>বিজ্ঞাপন ভিজিট চলছে</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-bold text-emerald-800">
                    +${pending.reward.toFixed(2)}
                  </span>
                </p>
                <p className="text-[10px] text-gray-500 font-medium truncate max-w-[190px]">
                  {pending.label}
                </p>
              </div>
            </div>
            <div className="text-right">
              {secondsRemaining > 0 ? (
                <div className="rounded-xl bg-brand-100 px-2.5 py-1 text-center border border-brand-200">
                  <span className="block text-[8px] font-bold uppercase text-brand-700">বাকি সময়</span>
                  <span className="block text-[13px] font-black text-brand-700 font-mono">
                    {secondsRemaining}s
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => claimPendingReward()}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white shadow-md active:scale-95 animate-pulse"
                >
                  ক্লেইম করুন
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(5, ((pending.minSeconds - secondsRemaining) / pending.minSeconds) * 100))}%`
              }}
            />
          </div>
          <p className="mt-1 text-center text-[9.5px] text-gray-400 font-medium">
            {secondsRemaining > 0
              ? `⏳ দয়া করে ${secondsRemaining} সেকেন্ড অপেক্ষা করুন, সময় শেষ হলে ব্যালেন্সে অটোমেটিক যোগ হবে!`
              : "✅ সময় শেষ হয়েছে! আপনার ব্যালেন্সে টাকা যোগ হচ্ছে..."}
          </p>
        </motion.div>
      )}

      {/* Daily Ads Header */}
      <SectionHeading
        icon={<CirclePlay className="h-4 w-4 text-brand-500" />}
        title="DAILY ADS"
      />

      {/* Ad Slots Grid - 2 boxes, 10 per hour each */}
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        {config.adSlots.map((slot) => {
          const countHour = slotCountThisHour(slot.id);
          const reachedLimit = countHour >= hourlyLimitPerSlot;
          const isPending = pending?.kind === 'ad' && pending.refId === slot.id;

          return (
            <motion.button
              key={slot.id}
              whileTap={{ scale: 0.97 }}
              disabled={reachedLimit || Boolean(pending)}
              onClick={() => startAd(slot)}
              className={`flex flex-col items-center rounded-2xl bg-white px-2 py-3 shadow-card transition-all ${
                reachedLimit ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:shadow-md active:bg-brand-50/20'
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50">
                {isPending ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-brand-500" />
                ) : (
                  <Play className="h-5 w-5 text-brand-500 fill-brand-500" />
                )}
              </span>
              <span className="mt-1.5 text-[12px] font-extrabold text-ink">
                {slot.title}
              </span>
              <span className="mt-1 rounded-full bg-brand-50 px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide text-brand-500">
                {reachedLimit ? 'ঘণ্টার লিমিট শেষ' : 'Earn reward'}
              </span>
              <span className="mt-1 text-[12px] font-extrabold text-money">
                +${slot.reward.toFixed(2)}
              </span>
              <span className="mt-0.5 text-[9.5px] text-gray-400 font-medium">
                {countHour}/{hourlyLimitPerSlot} এই ঘণ্টায়
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Ads Hourly Progress Note */}
      <div className="mt-2 flex items-center justify-between px-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
          এই ঘণ্টায় দেখা হয়েছে:{" "}
          <span className="text-brand-500 font-extrabold">
            {totalAdsWatchedThisHour}/{totalPossibleThisHour}
          </span>
        </p>
        <p className="text-[10px] text-gray-400">
          প্রতিটি বক্সে ঘণ্টায় ১০টি (মোট ২০টি)
        </p>
      </div>

      {/* Available Tasks Header */}
      <div className="mt-4">
        <SectionHeading
          icon={<Zap className="h-4 w-4 text-brand-500" />}
          title="AVAILABLE TASKS"
        />
      </div>

      {/* Available Tasks - Squeezed 4 items so all are visible simultaneously */}
      <div className="mt-2 rounded-2xl bg-white p-2.5 shadow-card">
        <div className="grid grid-cols-4 gap-1">
          {config.tasks.slice(0, 4).map((task) => {
            const isPending = pending?.kind === 'task' && pending.refId === task.id;

            return (
              <motion.button
                key={task.id}
                whileTap={{ scale: 0.94 }}
                disabled={Boolean(pending)}
                onClick={() => startTask(task)}
                className="flex flex-col items-center group cursor-pointer text-center px-0.5"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 group-hover:bg-brand-100 transition-colors">
                  {isPending ? (
                    <LoaderCircle className="h-5 w-5 animate-spin text-brand-500" />
                  ) : (
                    <Globe className="h-5 w-5 text-brand-500" strokeWidth={1.8} />
                  )}
                </span>
                <span className="mt-1.5 line-clamp-1 text-center text-[10px] font-bold leading-tight text-ink w-full">
                  {task.title}
                </span>
                <span className="mt-0.5 text-[11px] font-extrabold text-money">
                  +${task.reward.toFixed(2)}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Guidelines footer info */}
      <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2.5 text-[10.5px] leading-relaxed text-brand-700">
        💡 <b>নিয়ম:</b> বিজ্ঞাপনের লিঙ্কে নূন্যতম <b>১ মিনিট (৬০ সেকেন্ড)</b> ভিজিট থাকতে হবে। ১ মিনিট পার হওয়ার আগে ফিরে আসলে ব্যালেন্স যোগ হবে না। টাস্ক সম্পূর্ণ করার সর্বোচ্চ সময় <b>{config.adMaxMinutes} মিনিট</b>।
      </div>
    </main>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 px-0.5">
      {icon}
      <h2 className="text-[13px] font-extrabold tracking-wide text-ink">{title}</h2>
    </div>
  );
}
