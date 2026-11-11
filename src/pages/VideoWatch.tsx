import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  X,
  ShieldAlert,
  Timer
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, useAppStore } from '../contexts/AuthContext';
import { creditUserEarning, getTodayDateString, isVideoWatchedByUser, markVideoAsWatched } from '../lib/store';
import { extractYouTubeId, getYouTubeEmbedUrl, getYouTubeThumbnail } from '../lib/youtube';
import { triggerHaptic } from '../lib/telegram';
import { formatUsd } from '../lib/format';
import { AdsterraBanner } from '../components/AdsterraBanner';
import { AdsterraNativeBanner } from '../components/AdsterraNativeBanner';

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function VideoWatch() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const { user, config: authConfig } = useAuth();
  const db = useAppStore();
  const config = db.config || authConfig;
  const videoSectionRef = useRef<HTMLDivElement>(null);
  const videoIframeRef = useRef<HTMLIFrameElement>(null);

  const liveUser = (user?.telegramId && db.users[user.telegramId]) ? db.users[user.telegramId] : user;

  const videos = useMemo(() => {
    const list = Array.isArray(config.videos) ? [...config.videos] : [];
    list.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
    return list;
  }, [config.videos]);

  const currentIndex = videos.findIndex((v) => v.id === videoId);
  const currentVideo = currentIndex !== -1 ? videos[currentIndex] : videos[0];
  const nextVideo = currentIndex !== -1 && currentIndex + 1 < videos.length ? videos[currentIndex + 1] : null;

  const nextUnwatchedVideo = useMemo(() => {
    if (!liveUser) return nextVideo;
    return videos.find((v) => v.id !== currentVideo?.id && !isVideoWatchedByUser(liveUser.telegramId, v.id)) || null;
  }, [videos, currentVideo?.id, liveUser, db.users, nextVideo]);

  const targetSeconds = currentVideo?.minWatchSeconds || 60;
  const rewardAmount = currentVideo?.reward || 0.05;

  const todayStr = getTodayDateString();
  const storageKey = liveUser ? `c2c_vid_watched_${liveUser.telegramId}_${currentVideo?.id}_${todayStr}` : '';

  const isPermanentlyWatched = liveUser && currentVideo ? isVideoWatchedByUser(liveUser.telegramId, currentVideo.id) : false;

  const [alreadyClaimed, setAlreadyClaimed] = useState<boolean>(() => {
    if (isPermanentlyWatched) return true;
    if (!storageKey) return false;
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const [secondsElapsed, setSecondsElapsed] = useState<number>(() => {
    return alreadyClaimed ? targetSeconds : 0;
  });
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [justClaimed, setJustClaimed] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  // Track page visibility using document.visibilityState / document.hidden
  // Note: We deliberately do NOT use window.blur because clicking inside YouTube or Ad iframes
  // fires a window blur event, which was falsely freezing the timer!
  const [isPageActive, setIsPageActive] = useState<boolean>(true);

  useEffect(() => {
    const updateVisibility = () => {
      const isVisible = document.visibilityState === 'visible' && !document.hidden;
      setIsPageActive(isVisible);
    };

    updateVisibility();

    document.addEventListener('visibilitychange', updateVisibility);

    // Any touch, click, or scroll on the window confirms the user is here
    const onUserActivity = () => {
      if (document.visibilityState === 'visible') {
        setIsPageActive(true);
      }
    };

    window.addEventListener('touchstart', onUserActivity, { passive: true });
    window.addEventListener('scroll', onUserActivity, { passive: true });
    window.addEventListener('click', onUserActivity, { passive: true });

    // Periodic check: if page is currently visible, ensure timer is running
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !document.hidden) {
        setIsPageActive(true);
      } else {
        setIsPageActive(false);
      }
    }, 800);

    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('touchstart', onUserActivity);
      window.removeEventListener('scroll', onUserActivity);
      window.removeEventListener('click', onUserActivity);
      clearInterval(interval);
    };
  }, []);

  // Strictly block and disable Fullscreen requests
  useEffect(() => {
    const exitFs = () => {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    };
    document.addEventListener('fullscreenchange', exitFs);
    document.addEventListener('webkitfullscreenchange', exitFs);
    return () => {
      document.removeEventListener('fullscreenchange', exitFs);
      document.removeEventListener('webkitfullscreenchange', exitFs);
    };
  }, []);

  // Strictly enforce 360p (medium) video playback quality
  useEffect(() => {
    const iframe = videoIframeRef.current;
    if (!iframe) return;

    const enforce360p = () => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'setPlaybackQuality',
            args: ['medium']
          }),
          '*'
        );
        iframe.contentWindow?.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'setPlaybackQualityRange',
            args: ['medium', 'medium']
          }),
          '*'
        );
      } catch {}
    };

    const t1 = setTimeout(enforce360p, 1000);
    const t2 = setTimeout(enforce360p, 2500);
    const t3 = setTimeout(enforce360p, 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [videoId, currentVideo?.id]);

  // Sync already claimed status and check if video is already completed
  useEffect(() => {
    if (!liveUser || !currentVideo || justClaimed) return;
    const isWatched = isVideoWatchedByUser(liveUser.telegramId, currentVideo.id);
    if (isWatched) {
      setAlreadyClaimed(true);
      setSecondsElapsed(targetSeconds);
      // Auto forward to next unwatched video only if directly opening an old already-watched video
      const nextUnwatched = videos.find((v) => !isVideoWatchedByUser(liveUser.telegramId, v.id));
      if (nextUnwatched && nextUnwatched.id !== currentVideo.id) {
        toast.info('এই ভিডিওটি আগে দেখা হয়েছে। নতুন ভিডিও লোড করা হচ্ছে...', { duration: 2500 });
        navigate(`/video/${nextUnwatched.id}`, { replace: true });
      } else if (!nextUnwatched) {
        toast.success('🎉 আপনি ইতিমধ্যে সকল ভিডিও দেখে রিওয়ার্ড সম্পন্ন করেছেন!');
        navigate('/', { replace: true });
      }
      return;
    }

    if (!storageKey) return;
    try {
      const isClaimed = localStorage.getItem(storageKey) === '1';
      setAlreadyClaimed(isClaimed);
      setJustClaimed(false);
      setSecondsElapsed(isClaimed ? targetSeconds : 0);
      setShowExitConfirm(false);
    } catch {
      setAlreadyClaimed(false);
    }
  }, [storageKey, targetSeconds, liveUser?.telegramId, currentVideo?.id, videos, navigate]);

  // Video timer: counts elapsed seconds strictly while active on video page
  useEffect(() => {
    if (alreadyClaimed || justClaimed) return;
    if (secondsElapsed >= targetSeconds) return;
    if (!isPageActive) return; // Automatically pauses when user leaves the page!

    const timer = setInterval(() => {
      setSecondsElapsed((prev) => {
        const next = prev + 1;
        if (next >= targetSeconds) {
          triggerHaptic('success');
          return targetSeconds;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [alreadyClaimed, justClaimed, secondsElapsed, targetSeconds, isPageActive]);

  // Pop-up / Popunder Ad integration on Video Play Page
  useEffect(() => {
    const popUrl =
      config.videoBannerAds?.popunderUrl ||
      'https://bicea.org/14/c35007be6aabc3a9eb292e5611d0030b';
    const isEnabled = config.videoBannerAds?.popunderEnabled !== false;

    if (!isEnabled || !popUrl) return;

    let script = document.querySelector(`script[src="${popUrl}"]`) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.src = popUrl;
      script.setAttribute('data-cfasync', 'false');
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [config.videoBannerAds?.popunderUrl, config.videoBannerAds?.popunderEnabled]);

  // Smart Cyclical Ad-Touring Auto-Scroll (Initial entry, then every 60 seconds)
  useEffect(() => {
    let animId: number;
    let isDisposed = false;

    // Smooth scroll helper using requestAnimationFrame
    const smoothScrollTo = (targetY: number, duration: number, callback?: () => void) => {
      if (isDisposed) return;
      const startY = window.scrollY || window.pageYOffset || 0;
      const distance = targetY - startY;
      if (Math.abs(distance) < 5) {
        if (callback && !isDisposed) callback();
        return;
      }

      const startTime = performance.now();
      const step = (now: number) => {
        if (isDisposed) return;
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Smooth easeInOutQuad easing
        const ease =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        window.scrollTo(0, startY + distance * ease);

        if (progress < 1) {
          animId = requestAnimationFrame(step);
        } else if (callback && !isDisposed) {
          callback();
        }
      };
      animId = requestAnimationFrame(step);
    };

    const getVideoY = () => {
      if (!videoSectionRef.current) return 0;
      return Math.max(0, videoSectionRef.current.offsetTop - 56);
    };

    const getBottomY = () => {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    };

    // 1. Initial Flow: pause 800ms at top so user sees top ads, then smoothly glide to video player
    const initialTimer = setTimeout(() => {
      if (isDisposed) return;
      smoothScrollTo(getVideoY(), 3800);
    }, 800);

    // 2. Periodic 60-Second Cycle: Tour bottom ads -> top ads -> return to video player
    const cycleInterval = setInterval(() => {
      if (isDisposed || !isPageActive || alreadyClaimed) return;

      // Step A: Smoothly scroll down to bottom ads to register impressions
      smoothScrollTo(getBottomY(), 2800, () => {
        if (isDisposed) return;

        // Step B: Stay at bottom ads for 4.5 seconds
        setTimeout(() => {
          if (isDisposed) return;

          // Step C: Smoothly scroll up to top ads
          smoothScrollTo(0, 2800, () => {
            if (isDisposed) return;

            // Step D: Stay at top ads for 3.5 seconds
            setTimeout(() => {
              if (isDisposed) return;

              // Step E: Smoothly glide back to the video player to continue watching!
              smoothScrollTo(getVideoY(), 2600);
            }, 3500);
          });
        }, 4500);
      });
    }, 60000); // Triggers every 60 seconds (1 minute)

    return () => {
      isDisposed = true;
      clearTimeout(initialTimer);
      clearInterval(cycleInterval);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [videoId, alreadyClaimed, isPageActive]);

  const canClaim = secondsElapsed >= targetSeconds && !alreadyClaimed && !justClaimed;
  const remainingSeconds = Math.max(0, targetSeconds - secondsElapsed);
  const progressPercent = Math.min(100, Math.round((secondsElapsed / targetSeconds) * 100));

  const ytId = currentVideo ? extractYouTubeId(currentVideo.youtubeUrl) : null;
  const embedUrl = currentVideo ? getYouTubeEmbedUrl(currentVideo.youtubeUrl, true) : '';

  // Intercept back navigation if timer is incomplete
  const handleBack = () => {
    if (!alreadyClaimed && !justClaimed && secondsElapsed < targetSeconds) {
      triggerHaptic('medium');
      setShowExitConfirm(true);
    } else {
      navigate('/');
    }
  };

  const handleClaimReward = async () => {
    if (!liveUser || !currentVideo || alreadyClaimed || justClaimed || isClaiming) return;
    setIsClaiming(true);
    triggerHaptic('success');

    try {
      const reward = Number(currentVideo.reward || 0.05);

      // 1. Credit balance immediately in store, Firebase, & backend
      await creditUserEarning(
        liveUser.telegramId,
        'task',
        `ভিডিও দেখা: ${currentVideo.title}`,
        reward
      );

      // 2. Permanently mark this video as watched for this user
      await markVideoAsWatched(liveUser.telegramId, currentVideo.id);

      try {
        localStorage.setItem(storageKey, '1');
      } catch {}

      setAlreadyClaimed(true);
      setJustClaimed(true);
      triggerHaptic('success');
      toast.success(`🎉 অভিনন্দন! +$${reward.toFixed(2)} USDT সরাসরি আপনার ব্যালেন্সে যোগ হয়েছে!`, {
        duration: 5000
      });
      // User can freely continue watching this video as long as they want.
      // Once they click back to exit, this video will not appear on their Home page anymore.
    } catch (err) {
      console.error(err);
      toast.error('রিওয়ার্ড যোগ করতে সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsClaiming(false);
    }
  };

  // Automatically credit reward as soon as user completes the watch timer on page
  useEffect(() => {
    if (secondsElapsed >= targetSeconds && !alreadyClaimed && !justClaimed && !isClaiming && liveUser && currentVideo) {
      handleClaimReward();
    }
  }, [secondsElapsed, targetSeconds, alreadyClaimed, justClaimed, isClaiming, liveUser, currentVideo]);

  if (!currentVideo) {
    return (
      <main className="p-4 text-center">
        <p className="text-gray-500 text-sm">ভিডিওটি খুঁজে পাওয়া যায়নি।</p>
        <button
          onClick={() => navigate('/')}
          className="mt-3 px-4 py-2 rounded-xl bg-brand-500 text-white font-bold text-xs"
        >
          হোমে ফিরে যান
        </button>
      </main>
    );
  }

  // Circular progress SVG calculations (compact 38px radius)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <main className="min-h-screen bg-cream pb-20">
      {/* Top Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-black/5 bg-white/95 px-3 py-2.5 backdrop-blur-md">
        <button
          onClick={handleBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream text-ink transition active:scale-95 hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <p className="text-[13px] font-extrabold text-ink">ভিডিও দেখুন ও আয় করুন</p>
          <p className="text-[10px] text-gray-400 font-medium">Watch & Earn Rewards</p>
        </div>

        {liveUser && (
          <div className="rounded-xl bg-brand-50 px-2.5 py-1 text-right">
            <p className="text-[8.5px] font-semibold uppercase tracking-wide text-brand-500">
              ব্যালেন্স
            </p>
            <p className="text-[12px] font-extrabold text-ink">
              {formatUsd(liveUser.balance)}
            </p>
          </div>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* Dynamic Sponsored Banner Ads configured via Firebase / Admin Panel */}
        {(() => {
          const adConfig = config.videoBannerAds;
          const isEnabled = adConfig?.enabled !== false;
          const count = Math.max(0, Math.min(10, Number(adConfig?.count ?? 5)));
          const defaultKey = adConfig?.adKey || '911ee250303f0d466e6e2cab58b077e0';
          const host = adConfig?.scriptHost || 'https://bauval.org/22';
          const slotKeys = Array.isArray(adConfig?.slotKeys) ? adConfig.slotKeys : [];

          if (!isEnabled || count <= 0) return null;

          return (
            <div className="flex flex-col items-center gap-3">
              {Array.from({ length: count }).map((_, idx) => {
                const keyForSlot = slotKeys[idx]?.trim() || defaultKey;
                return (
                  <AdsterraBanner
                    key={`ad_${idx}_${keyForSlot}`}
                    index={idx + 1}
                    adKey={keyForSlot}
                    scriptHost={host}
                  />
                );
              })}
            </div>
          );
        })()}



        {/* Video Player Box with Security Shields (Bigger display & Fullscreen strictly disabled) */}
        <div
          ref={videoSectionRef}
          className="relative -mx-1 sm:mx-0 overflow-hidden rounded-2xl bg-black shadow-card scroll-mt-14 ring-1 ring-black/10"
        >
          <div className="relative w-full aspect-[16/10] min-h-[250px] max-h-[380px] bg-slate-900 overflow-hidden">
            {ytId ? (
              <>
                <iframe
                  ref={videoIframeRef}
                  src={embedUrl}
                  title={currentVideo.title}
                  className="h-full w-full border-0 select-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />

                {/* 🛡️ Strict Click Shields: Absorb and cancel clicks on YouTube title, avatar, watermark, fullscreen, & share buttons */}
                {/* 1. Top Bar Shield: channel name, avatar, title, copy link, and share buttons */}
                <div
                  className="absolute top-0 left-0 right-0 h-16 z-20 cursor-default select-none bg-transparent"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  title="ভিডিও লিংক সুরক্ষিত"
                />

                {/* 2. Bottom Right Shield: Covers YouTube logo AND Fullscreen button completely */}
                <div
                  className="absolute bottom-0 right-0 w-44 h-14 z-20 cursor-default select-none bg-transparent"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  title="ফুল স্ক্রিন ও লিংক নিষ্ক্রিয়"
                />

                {/* 3. Bottom Left Shield: link icon / watch on YouTube / share links */}
                <div
                  className="absolute bottom-0 left-0 w-28 h-14 z-20 cursor-default select-none bg-transparent"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  title="ভিডিও লিংক সুরক্ষিত"
                />

                {/* 4. Bottom Center Shield: suggested thumbnail cards and overlays */}
                <div
                  className="absolute bottom-11 left-1/2 -translate-x-1/2 w-52 h-14 z-20 cursor-default select-none bg-transparent"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                />
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-white">
                <AlertCircle className="h-8 w-8 text-amber-400 mb-2" />
                <p className="text-xs font-bold">ভিডিও লিংক লোড করা যায়নি</p>
                <p className="text-[10px] text-gray-400 mt-1">{currentVideo.youtubeUrl}</p>
              </div>
            )}
          </div>
        </div>

        {/* Compact, Sleek Timer & Reward Card (Made smaller as requested) */}
        <div className="relative overflow-hidden rounded-2xl bg-white p-3 shadow-card">
          {/* Top Info Header */}
          <div className="flex items-center justify-between border-b border-black/5 pb-2">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold transition-colors ${
                !isPageActive
                  ? 'bg-amber-100 text-amber-700 animate-pulse'
                  : 'bg-brand-50 text-brand-600'
              }`}
            >
              <Timer className="h-3 w-3 text-brand-500 animate-pulse" />
              <span>{!isPageActive ? '⏸️ টাইমার পজ আছে (পেজে ফিরে আসুন)' : 'লাইভ ওয়াচ টাইমার'}</span>
            </div>
            <div className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-600 border border-emerald-200/50 shadow-xs">
              +${rewardAmount.toFixed(2)} USDT
            </div>
          </div>

          {alreadyClaimed || justClaimed ? (
            /* Completed / Already Claimed State */
            <div className="py-2.5 text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm mb-1">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-[13px] font-extrabold text-ink">
                ব্যালেন্সে রিওয়ার্ড যোগ হয়ে গেছে! 🎉
              </h3>
              <p className="mt-0.5 text-[11px] text-gray-500">
                আপনার অ্যাকাউন্টে <b>+${rewardAmount.toFixed(2)} USDT</b> যোগ হয়েছে। আপনি চাইলে ভিডিওটি দেখতে পারেন অথবা ব্যাক করতে পারেন।
              </p>

              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => navigate('/', { replace: true })}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2 text-[12px] font-extrabold text-gray-700 shadow-xs transition hover:bg-slate-200 active:scale-98 cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" /> হোমে ফিরুন
                </button>
                {nextUnwatchedVideo && (
                  <button
                    onClick={() => navigate(`/video/${nextUnwatchedVideo.id}`, { replace: true })}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2 text-[12px] font-extrabold text-white shadow-md transition hover:bg-brand-600 active:scale-98 cursor-pointer"
                  >
                    পরবর্তী ভিডিও <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Active Live Countdown: Small, Sleek, Compact */
            <div className="pt-2">
              <div className="flex items-center justify-center py-2">
                {/* Compact Circular Progress Ring Centered */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="h-[76px] w-[76px] -rotate-90 transform" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      className="text-gray-100"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      className="text-brand-500 transition-all duration-500 ease-linear"
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      stroke="url(#timerGradient)"
                      fill="transparent"
                    />
                    <defs>
                      <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F59E0B" />
                        <stop offset="50%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#10B981" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Inside Ring Display - Compact Minutes & Seconds */}
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-[17px] font-black font-mono tracking-tight text-ink leading-tight">
                      {formatSeconds(remainingSeconds)}
                    </span>
                    <span className="text-[8.5px] font-bold text-brand-600 uppercase tracking-wide">
                      মিনিট বাকি
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button: Glowing Reward Claim Button (If not already auto-claimed) */}
              {canClaim && (
                <div className="mt-2.5">
                  <button
                    onClick={handleClaimReward}
                    disabled={isClaiming}
                    className="flex w-full animate-bounce items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-[13px] font-extrabold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-105 active:scale-98"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isClaiming ? 'ব্যালেন্সে যোগ হচ্ছে...' : `রিওয়ার্ড গ্রহণ করুন (+$${rewardAmount.toFixed(2)} USDT)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Adsterra Native Banner (strictly on Video Play page) */}
        <AdsterraNativeBanner />

        {/* Bottom Banner Ads (managed in real-time via Firebase / Admin Panel) */}
        {(() => {
          const adConfig = config.videoBannerAds;
          const isEnabled = adConfig?.enabled !== false;
          const bottomCount = Math.max(0, Math.min(10, Number(adConfig?.bottomCount ?? 5)));
          const defaultKey = adConfig?.adKey || '911ee250303f0d466e6e2cab58b077e0';
          const host = adConfig?.scriptHost || 'https://bauval.org/22';
          const slotKeys = Array.isArray(adConfig?.slotKeys) ? adConfig.slotKeys : [];

          if (!isEnabled || bottomCount <= 0) return null;

          return (
            <div className="flex flex-col items-center gap-3 my-3">
              {Array.from({ length: bottomCount }).map((_, idx) => {
                const keyForSlot = slotKeys[idx + 5]?.trim() || slotKeys[idx]?.trim() || defaultKey;
                return (
                  <AdsterraBanner
                    key={`bottom_ad_${idx}_${keyForSlot}`}
                    index={idx + 6}
                    adKey={keyForSlot}
                    scriptHost={host}
                  />
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Early Exit Confirmation Warning Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <h3 className="text-center text-[16px] font-extrabold text-ink">
              ভিডিও দেখা এখনও বাকি!
            </h3>

            <p className="mt-2 text-center text-[12px] leading-relaxed text-gray-600">
              আর মাত্র <b>{remainingSeconds} সেকেন্ড</b> অপেক্ষা করতে হবে। এখন ফিরে গেলে আপনার অ্যাকাউন্টে <b>কোনো টাকা যোগ হবে না</b> এবং সেশন বাতিল হয়ে যাবে!
            </p>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[13px] font-extrabold text-white shadow-md transition hover:bg-brand-600 active:scale-98"
              >
                ভিডিও দেখতে থাকুন
              </button>

              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  navigate('/');
                }}
                className="flex w-full items-center justify-center rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-[12px] font-bold text-rose-600 transition hover:bg-rose-100 active:scale-98"
              >
                ফিরে যান (টাকা যোগ হবে না)
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
