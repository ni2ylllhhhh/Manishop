import { motion } from 'motion/react';
import { CirclePlay, Play, Zap, Globe, LoaderCircle } from 'lucide-react';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import { formatUsd } from '../lib/format';
import { AdsterraBanner } from '../components/AdsterraBanner';

export function Tasks() {
  const {
    user,
    config,
    startAd,
    startTask,
    pending,
    slotCountThisHour,
    totalAdsWatchedThisHour,
    hourlyLimitPerSlot
  } = useAuth();
  const db = useAppStore();

  const liveUser = (user?.telegramId && db.users[user.telegramId]) ? db.users[user.telegramId] : user;

  if (!liveUser) return null;

  const totalPossibleThisHour = config.adSlots.length * hourlyLimitPerSlot;

  return (
    <main className="px-3 pt-3 pb-8">
      {/* Top Header Card */}
      <section className="mb-3 flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-card">
        <Avatar src={liveUser.photoUrl} name={liveUser.firstName} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-ink">
            {liveUser.firstName} {liveUser.lastName}
          </p>
          <p className="truncate text-[10px] text-gray-400 font-mono">
            ID: {liveUser.telegramId}
          </p>
        </div>
        <div className="rounded-xl bg-brand-50 px-2.5 py-1 text-right">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-brand-500">
            Balance
          </p>
          <p className="text-[13px] font-extrabold text-ink">
            {formatUsd(liveUser.balance)}
          </p>
        </div>
      </section>

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
                {reachedLimit ? 'ঘণ্টার লিমিট শেষ' : isPending ? 'ভিজিট চলছে...' : 'Earn reward'}
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

      {/* Available Tasks Grid */}
      <div className="mt-2 rounded-2xl bg-white p-2.5 shadow-card">
        <div className="grid grid-cols-4 gap-1">
          {((Array.isArray(config.tasks) && config.tasks.length > 0) ? config.tasks : [
            { id: "t1", title: "Video watch 1", url: "https://ads.ziniyaapu7.workers.dev/", reward: 0.05, minSeconds: 60, maxMinutes: 5 },
            { id: "t2", title: "Video track 2", url: "https://ads.ziniyaapu7.workers.dev/", reward: 0.05, minSeconds: 60, maxMinutes: 5 },
            { id: "t3", title: "Video tax 3", url: "https://ads.ziniyaapu7.workers.dev/", reward: 0.05, minSeconds: 60, maxMinutes: 5 },
            { id: "t4", title: "Special task 4", url: "https://ads.ziniyaapu7.workers.dev/", reward: 0.05, minSeconds: 60, maxMinutes: 5 }
          ]).slice(0, 4).map((task) => {
            const isPending = pending?.kind === 'task' && pending.refId === task.id;

            return (
              <motion.button
                key={task.id}
                whileTap={{ scale: 0.94 }}
                disabled={Boolean(pending)}
                onClick={() => startTask(task)}
                className="flex flex-col items-center group cursor-pointer text-center px-0.5"
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
                  isPending ? 'bg-brand-500/10 ring-2 ring-brand-500' : 'bg-brand-50 group-hover:bg-brand-100'
                }`}>
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

      {/* Sponsored Ad Banner on Tasks Page */}
      <div className="mt-5 flex flex-col items-center">
        <AdsterraBanner
          index={1}
          adKey={config.videoBannerAds?.adKey || '911ee250303f0d466e6e2cab58b077e0'}
          scriptHost={config.videoBannerAds?.scriptHost || 'https://bauval.org/22'}
        />
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
