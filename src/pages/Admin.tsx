import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  RotateCcw,
  Ban,
  Check,
  Trash2,
  X,
  Plus
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useAppStore } from '../contexts/AuthContext';
import { appStore, generateId } from '../lib/store';
import { formatDate } from '../lib/format';
import { syncUserToFirebase, syncWithdrawalToFirebase, syncConfigToFirebase } from '../lib/firebase';
import type { AppConfig } from '../types';

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'ads', label: 'Ad Slots' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'posts', label: 'Posts' },
  { id: 'settings', label: 'Settings' }
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]['id'];

const STORAGE_ADMIN_SESSION = "c2c_admin_ok";

export function Admin() {
  const db = useAppStore();
  const [unlocked, setUnlocked] = useState<boolean>(
    () => sessionStorage.getItem(STORAGE_ADMIN_SESSION) === "1"
  );
  const [passwordInput, setPasswordInput] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  if (!unlocked) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-ink px-6">
        <Toaster position="top-center" richColors />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (passwordInput === db.config.adminPassword) {
              sessionStorage.setItem(STORAGE_ADMIN_SESSION, "1");
              setUnlocked(true);
            } else {
              toast.error("ভুল অ্যাডমিন পাসওয়ার্ড!");
              setPasswordInput("");
            }
          }}
          className="w-full max-w-[18rem] rounded-2xl bg-white/5 p-6 text-center ring-1 ring-white/10 shadow-2xl"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <Lock className="h-6 w-6 text-brand-300" />
          </div>
          <h1 className="mt-3 text-base font-bold text-white">Admin Access</h1>
          <p className="mt-1 text-xs text-white/50">Enter security PIN (Default: 445566)</p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="PIN Code"
            className="mt-4 h-10 w-full rounded-xl bg-white/10 px-3 text-center text-sm text-white tracking-widest outline-none placeholder:text-white/30 border border-white/10 focus:border-brand-400"
          />
          <button
            type="submit"
            className="mt-3 h-10 w-full rounded-xl bg-brand-500 text-sm font-bold text-white hover:bg-brand-600 transition"
          >
            Unlock Panel
          </button>
        </form>
      </main>
    );
  }

  const usersList = Object.values(db.users);
  const cfg = db.config;

  const updateConfig = (patch: Partial<AppConfig>) => {
    appStore.update((draft) => {
      Object.assign(draft.config, patch);
    });
    const updatedCfg = appStore.get().config;
    syncConfigToFirebase(updatedCfg);
    toast.success("Settings updated & synced to Firebase");
  };

  return (
    <main className="min-h-screen w-full bg-slate-100 pb-16">
      <Toaster position="top-center" richColors />

      {/* Top Admin Header */}
      <header className="flex items-center gap-2 bg-ink px-4 py-3 shadow-md">
        <ShieldCheck className="h-5 w-5 text-brand-300" />
        <h1 className="flex-1 text-sm font-bold text-white">
          {cfg.appName} • Admin Control Panel
        </h1>
        <button
          onClick={() => {
            sessionStorage.removeItem(STORAGE_ADMIN_SESSION);
            setUnlocked(false);
          }}
          className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20 transition"
        >
          Lock
        </button>
      </header>

      {/* Admin Nav Tabs */}
      <nav className="no-scrollbar flex gap-1.5 overflow-x-auto bg-white px-3 py-2 shadow-sm border-b border-black/5">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              activeTab === tab.id
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Panels */}
      <div className="space-y-3 p-3 max-w-4xl mx-auto">
        {/* 1. OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard label="Total Users" value={String(usersList.length)} />
            <MetricCard
              label="Total User Balances"
              value={`$${usersList.reduce((acc, u) => acc + u.balance, 0).toFixed(2)}`}
            />
            <MetricCard label="Total Referrals" value={String(db.referrals.length)} />
            <MetricCard
              label="Pending Withdrawals"
              value={String(db.withdrawals.filter((w) => w.status === 'pending').length)}
            />
            <MetricCard label="Community Posts" value={String(db.posts.length)} />
            <MetricCard label="Earning Logs" value={String(db.logs.length)} />
            <MetricCard label="Active Ad Slots" value={String(cfg.adSlots.length)} />
            <MetricCard label="Direct Tasks" value={String(cfg.tasks.length)} />
          </div>
        )}

        {/* 2. USERS */}
        {activeTab === 'users' && (
          <SectionCard title={`Registered Users (${usersList.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="text-slate-400 border-b border-slate-100">
                  <tr>
                    <TableHeaderCell>Telegram ID</TableHeaderCell>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Balance ($)</TableHeaderCell>
                    <TableHeaderCell>Refs</TableHeaderCell>
                    <TableHeaderCell>Ref By</TableHeaderCell>
                    <TableHeaderCell>Joined</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map((u) => (
                    <tr key={u.telegramId} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono">{u.telegramId}</TableCell>
                      <TableCell>
                        <span className="font-semibold text-ink">
                          {u.firstName} {u.lastName}
                        </span>
                        {u.verified && <span className="ml-1 text-yellow-500">✓</span>}
                      </TableCell>
                      <TableCell>
                        <input
                          type="number"
                          step="0.01"
                          value={u.balance}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            appStore.update((d) => {
                              if (d.users[u.telegramId]) {
                                d.users[u.telegramId].balance = val;
                              }
                            });
                          }}
                          className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-ink font-bold focus:border-brand-500"
                        />
                      </TableCell>
                      <TableCell>{u.referralCount}</TableCell>
                      <TableCell className="font-mono text-gray-400">{u.referredBy ?? "—"}</TableCell>
                      <TableCell>{formatDate(u.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <IconButton
                            title={u.banned ? "Unban User" : "Ban User"}
                            tone={u.banned ? "bg-emerald-500" : "bg-rose-500"}
                            onClick={() => {
                              appStore.update((d) => {
                                if (d.users[u.telegramId]) {
                                  d.users[u.telegramId].banned = !u.banned;
                                }
                              });
                              toast.info(u.banned ? "User unbanned" : "User banned");
                            }}
                          >
                            <Ban className="h-3 w-3" />
                          </IconButton>
                          <IconButton
                            title="Toggle Verified Badge"
                            tone="bg-amber-500"
                            onClick={() => {
                              appStore.update((d) => {
                                if (d.users[u.telegramId]) {
                                  d.users[u.telegramId].verified = !u.verified;
                                }
                              });
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </IconButton>
                          <IconButton
                            title="Delete User"
                            tone="bg-slate-500"
                            onClick={() => {
                              if (confirm(`Delete user ${u.firstName}?`)) {
                                appStore.update((d) => {
                                  delete d.users[u.telegramId];
                                });
                                toast.success("User deleted");
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </IconButton>
                        </div>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* 3. WITHDRAWALS */}
        {activeTab === 'withdrawals' && (
          <SectionCard title={`Withdraw Requests (${db.withdrawals.length})`}>
            <ul className="space-y-2">
              {db.withdrawals.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-[11px] border border-slate-200/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">
                      ${w.amount.toFixed(2)} • {w.name} (TID: {w.telegramId})
                    </p>
                    <p className="truncate text-slate-500 font-mono mt-0.5">
                      {w.method} • Account: <span className="font-bold text-ink">{w.account}</span> • {formatDate(w.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 font-bold uppercase tracking-wider text-[9px] ${
                      w.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : w.status === 'rejected'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {w.status}
                  </span>
                  {w.status === 'pending' && (
                    <div className="flex gap-1.5">
                      <IconButton
                        title="Approve & Mark Paid"
                        tone="bg-emerald-500"
                        onClick={() => {
                          let updatedWd: any = null;
                          appStore.update((d) => {
                            const target = d.withdrawals.find((item) => item.id === w.id);
                            if (target) {
                              target.status = "approved";
                              updatedWd = { ...target };
                            }
                          });
                          if (updatedWd) syncWithdrawalToFirebase(updatedWd);
                          toast.success(`Approved $${w.amount.toFixed(2)} withdrawal!`);
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </IconButton>
                      <IconButton
                        title="Reject & Refund Balance"
                        tone="bg-rose-500"
                        onClick={() => {
                          let updatedWd: any = null;
                          let updatedUser: any = null;
                          appStore.update((d) => {
                            const target = d.withdrawals.find((item) => item.id === w.id);
                            if (target) {
                              target.status = "rejected";
                              const u = d.users[target.telegramId];
                              if (u) {
                                u.balance += target.amount;
                                updatedUser = { ...u };
                              }
                              updatedWd = { ...target };
                            }
                          });
                          if (updatedWd) syncWithdrawalToFirebase(updatedWd);
                          if (updatedUser) syncUserToFirebase(updatedUser);
                          toast.error(`Rejected withdrawal. $${w.amount.toFixed(2)} refunded.`);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </IconButton>
                    </div>
                  )}
                </li>
              ))}
              {db.withdrawals.length === 0 && <EmptyRow message="কোনো উইথড্রয়াল আবেদন নেই।" />}
            </ul>
          </SectionCard>
        )}

        {/* 4. AD SLOTS */}
        {activeTab === 'ads' && (
          <SectionCard
            title="Monetag Ad Slots"
            action={
              <AddButton
                onClick={() => {
                  appStore.update((d) => {
                    const newId = generateId("slot");
                    d.config.adSlots.push({
                      id: newId,
                      title: `AD SLOT ${d.config.adSlots.length + 1}`,
                      zone: "10635966",
                      reward: 0.05
                    });
                  });
                }}
              />
            }
          >
            <div className="space-y-2">
              {cfg.adSlots.map((slot, idx) => (
                <div key={slot.id} className="grid grid-cols-12 gap-1.5 items-center">
                  <InputText
                    className="col-span-4"
                    value={slot.title}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.adSlots[idx].title = val;
                      });
                    }}
                  />
                  <InputText
                    className="col-span-4"
                    value={slot.zone}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.adSlots[idx].zone = val;
                      });
                    }}
                  />
                  <InputText
                    className="col-span-3"
                    value={String(slot.reward)}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.adSlots[idx].reward = Number(val) || 0;
                      });
                    }}
                  />
                  <IconButton
                    title="Remove Slot"
                    tone="bg-rose-500"
                    onClick={() => {
                      appStore.update((d) => {
                        d.config.adSlots.splice(idx, 1);
                      });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </IconButton>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <NumberConfig
                label="Min watch (sec)"
                value={cfg.adMinSeconds}
                onChange={(val) => updateConfig({ adMinSeconds: val })}
              />
              <NumberConfig
                label="Max window (min)"
                value={cfg.adMaxMinutes}
                onChange={(val) => updateConfig({ adMaxMinutes: val })}
              />
              <NumberConfig
                label="Hourly limit / slot"
                value={cfg.adHourlyLimitPerSlot || 10}
                onChange={(val) => updateConfig({ adHourlyLimitPerSlot: val })}
              />
            </div>
          </SectionCard>
        )}

        {/* 5. TASKS */}
        {activeTab === 'tasks' && (
          <SectionCard
            title="Direct Link Tasks"
            action={
              <AddButton
                onClick={() => {
                  appStore.update((d) => {
                    d.config.tasks.push({
                      id: generateId("task"),
                      title: "New Video Task",
                      url: "https://",
                      reward: 0.05,
                      minSeconds: 60,
                      maxMinutes: 5
                    });
                  });
                }}
              />
            }
          >
            <div className="space-y-2">
              {cfg.tasks.map((task, idx) => (
                <div key={task.id} className="grid grid-cols-12 gap-1.5 items-center">
                  <InputText
                    className="col-span-3"
                    value={task.title}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.tasks[idx].title = val;
                      });
                    }}
                  />
                  <InputText
                    className="col-span-4"
                    value={task.url}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.tasks[idx].url = val;
                      });
                    }}
                  />
                  <InputText
                    className="col-span-2"
                    value={String(task.reward)}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.tasks[idx].reward = Number(val) || 0;
                      });
                    }}
                  />
                  <InputText
                    className="col-span-1"
                    value={String(task.minSeconds)}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.tasks[idx].minSeconds = Number(val) || 0;
                      });
                    }}
                  />
                  <InputText
                    className="col-span-1"
                    value={String(task.maxMinutes)}
                    onChange={(val) => {
                      appStore.update((d) => {
                        d.config.tasks[idx].maxMinutes = Number(val) || 0;
                      });
                    }}
                  />
                  <IconButton
                    title="Remove Task"
                    tone="bg-rose-500"
                    onClick={() => {
                      appStore.update((d) => {
                        d.config.tasks.splice(idx, 1);
                      });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </IconButton>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Columns: Title • URL • Reward ($) • Min Seconds • Max Minutes
            </p>
          </SectionCard>
        )}

        {/* 6. POSTS */}
        {activeTab === 'posts' && (
          <SectionCard title={`Community Posts (${db.posts.length})`}>
            <ul className="space-y-2">
              {db.posts.map((post) => (
                <li
                  key={post.id}
                  className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-[11px] border border-slate-200/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{post.authorName}</p>
                    <p className="truncate text-slate-500">{post.text || "(Photo attachment)"}</p>
                  </div>
                  <IconButton
                    title="Delete Post"
                    tone="bg-rose-500"
                    onClick={() => {
                      appStore.update((d) => {
                        d.posts = d.posts.filter((p) => p.id !== post.id);
                      });
                      toast.success("Post removed");
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </IconButton>
                </li>
              ))}
              {db.posts.length === 0 && <EmptyRow message="ফিডে কোনো পোস্ট নেই।" />}
            </ul>
          </SectionCard>
        )}

        {/* 7. SETTINGS */}
        {activeTab === 'settings' && (
          <>
            <SectionCard title="Bot & Application Setup">
              <div className="grid grid-cols-2 gap-2.5">
                <TextConfig
                  label="App Name"
                  value={cfg.appName}
                  onChange={(v) => updateConfig({ appName: v })}
                />
                <TextConfig
                  label="Bot Username (without @)"
                  value={cfg.botUsername}
                  onChange={(v) => updateConfig({ botUsername: v })}
                />
                <TextConfig
                  label="Bot Token (Server env: BOT_TOKEN)"
                  value={cfg.botToken}
                  onChange={(v) => updateConfig({ botToken: v })}
                />
                <TextConfig
                  label="Support Group Link"
                  value={cfg.supportUrl}
                  onChange={(v) => updateConfig({ supportUrl: v })}
                />
                <TextConfig
                  label="ImgBB API Key"
                  value={cfg.imgbbApiKey}
                  onChange={(v) => updateConfig({ imgbbApiKey: v })}
                />
                <TextConfig
                  label="Admin PIN Password"
                  value={cfg.adminPassword}
                  onChange={(v) => updateConfig({ adminPassword: v })}
                />
              </div>

              <label className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.allowDemoLogin}
                  onChange={(e) => updateConfig({ allowDemoLogin: e.target.checked })}
                  className="rounded text-brand-500"
                />
                Allow Demo Login outside Telegram (Turn off in production if desired)
              </label>
            </SectionCard>

            <SectionCard title="Economy & Referral Rules">
              <div className="grid grid-cols-3 gap-2.5">
                <NumberConfig
                  label="Referral Bonus L1 ($)"
                  value={cfg.referralBonus}
                  step={0.01}
                  onChange={(v) => updateConfig({ referralBonus: v })}
                />
                <NumberConfig
                  label="Referral Bonus L2 ($)"
                  value={cfg.level2Bonus}
                  step={0.01}
                  onChange={(v) => updateConfig({ level2Bonus: v })}
                />
                <NumberConfig
                  label="Min Withdraw ($)"
                  value={cfg.minWithdraw}
                  onChange={(v) => updateConfig({ minWithdraw: v })}
                />
                <NumberConfig
                  label="Min Referrals Required"
                  value={cfg.minReferralsForWithdraw}
                  onChange={(v) => updateConfig({ minReferralsForWithdraw: v })}
                />
                <TextConfig
                  label="Amounts (comma separated)"
                  value={cfg.withdrawAmounts.join(", ")}
                  onChange={(v) =>
                    updateConfig({
                      withdrawAmounts: v
                        .split(",")
                        .map((n) => Number(n.trim()))
                        .filter((n) => !Number.isNaN(n) && n > 0)
                    })
                  }
                />
              </div>
            </SectionCard>

            <SectionCard title="Danger Zone">
              <button
                onClick={() => {
                  if (confirm("সত্যিই সম্পূর্ণ ডেটাবেস রিসেট করতে চান?")) {
                    appStore.reset();
                    toast.success("Database restored to defaults!");
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-[11px] font-bold text-white hover:bg-rose-600 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset Database
              </button>
            </SectionCard>
          </>
        )}
      </div>
    </main>
  );
}

function SectionCard({
  title,
  action,
  children
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-3.5 shadow-sm border border-black/5">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[12px] font-extrabold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm border border-black/5">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-[18px] font-extrabold text-ink">{value}</p>
    </div>
  );
}

function TableHeaderCell({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-1.5 font-semibold text-[10px] uppercase tracking-wider">{children}</th>;
}

function TableCell({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-2 py-2 text-slate-700 ${className}`}>{children}</td>;
}

function InputText({
  value,
  onChange,
  className = ""
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 rounded-lg border border-slate-200 px-2 text-[11px] text-ink outline-none focus:border-brand-500 ${className}`}
    />
  );
}

function TextConfig({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 h-8 w-full rounded-lg border border-slate-200 px-2 text-[11px] text-ink outline-none focus:border-brand-500"
      />
    </label>
  );
}

function NumberConfig({
  label,
  value,
  onChange,
  step = 1
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold text-slate-400">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 h-8 w-full rounded-lg border border-slate-200 px-2 text-[11px] text-ink outline-none focus:border-brand-500"
      />
    </label>
  );
}

function IconButton({
  children,
  onClick,
  tone,
  title
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: string;
  title: string;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md text-white transition hover:opacity-90 active:scale-95 ${tone}`}
    >
      {children}
    </button>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-brand-600 active:scale-95 shadow-sm"
    >
      <Plus className="h-3 w-3" /> Add
    </button>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <li className="py-4 text-center text-[11px] text-slate-400">{message}</li>;
}
