import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CirclePlay,
  Play,
  Zap,
  Globe,
  LoaderCircle,
  History,
  Coins,
  CheckCircle2,
  Clock,
  Briefcase
} from 'lucide-react';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { BrandTopHeader } from '../components/BrandTopHeader';
import { AdsterraBanner } from '../components/AdsterraBanner';

export function Tasks() {
  const navigate = useNavigate();
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

  const taskPosts = (Array.isArray(config.taskPosts) ? [...config.taskPosts] : [])
    .filter((p) => p.active !== false)
    .sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

  const userSubmissions = Array.isArray(db.taskSubmissions)
    ? db.taskSubmissions.filter((s) => s.telegramId === liveUser.telegramId)
    : [];

  return (
    <main className="pb-8">
      <BrandTopHeader />

      <div className="px-3 pt-2.5">

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

      {/* Special Micro-Task Posts Feed (Right after red mark, matching Reference Screenshots) */}
      <section className="mt-5">
        <div className="flex items-center justify-between gap-2 px-0.5 mb-2.5">
          <div className="flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 text-indigo-600" />
            <h2 className="text-[14px] font-extrabold tracking-tight text-ink">
              Available Tasks
            </h2>
            <span className="text-[11px] font-medium text-gray-400">
              · {taskPosts.length} টি কাজ
            </span>
          </div>

          <Link
            to="/tasks/history"
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11.5px] font-bold text-indigo-600 shadow-card border border-black/5 transition hover:bg-indigo-50 active:scale-95"
          >
            <History className="h-3.5 w-3.5" />
            <span>History</span>
          </Link>
        </div>

        {taskPosts.length > 0 ? (
          <div className="space-y-3.5">
            {taskPosts.map((post) => {
              const sub = userSubmissions.find((s) => s.taskId === post.id);
              const isApproved = sub?.status === 'approved';
              const isPending = sub?.status === 'pending';

              return (
                <motion.article
                  key={post.id}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => navigate(`/tasks/${post.id}`)}
                  className="overflow-hidden rounded-2xl bg-white shadow-card transition-shadow hover:shadow-md cursor-pointer"
                >
                  {/* Banner Image */}
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                    {post.bannerUrl ? (
                      <img
                        src={post.bannerUrl}
                        alt={post.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-600 to-blue-700 p-4 text-center text-white">
                        <span className="text-[15px] font-extrabold">{post.title}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Info & Start Task Button */}
                  <div className="p-3.5">
                    <h3 className="text-[15px] font-extrabold leading-snug text-ink">
                      {post.title}
                    </h3>

                    <div className="mt-2 flex items-center gap-1.5 text-indigo-600">
                      <Coins className="h-4 w-4 shrink-0" />
                      <span className="text-[13.5px] font-extrabold tabular-nums">
                        Reward: ${Number(post.reward || 0).toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/tasks/${post.id}`);
                      }}
                      className={`mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold transition active:scale-[0.98] cursor-pointer ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isPending
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                      }`}
                    >
                      {isApproved ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Completed · View Details
                        </>
                      ) : isPending ? (
                        <>
                          <Clock className="h-4 w-4" /> Pending Review · View
                        </>
                      ) : (
                        <span>Start Task</span>
                      )}
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-5 text-center shadow-card">
            <p className="text-[13px] font-bold text-ink">কোনো স্পেশাল টাস্ক নেই</p>
            <p className="mt-1 text-[11px] text-gray-500">
              নতুন টাস্ক পোস্ট যোগ হলে এখানে দেখতে পাবেন।
            </p>
          </div>
        )}
      </section>

      {/* Sponsored Ad Banner on Tasks Page */}
      <div className="mt-5 flex flex-col items-center">
        <AdsterraBanner
          index={1}
          adKey={config.videoBannerAds?.adKey || '911ee250303f0d466e6e2cab58b077e0'}
          scriptHost={config.videoBannerAds?.scriptHost || 'https://bauval.org/22'}
        />
      </div>
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
