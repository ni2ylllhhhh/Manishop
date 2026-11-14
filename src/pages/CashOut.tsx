import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { requestWithdrawal } from '../lib/store';
import { triggerHaptic } from '../lib/telegram';

type PaymentMethodType = 'bKash' | 'Nagad' | 'Binance';

interface MethodOption {
  id: PaymentMethodType;
  name: string;
  logo: string;
  inputLabel: string;
  placeholder: string;
}

const METHODS: MethodOption[] = [
  {
    id: 'bKash',
    name: 'bKash',
    logo: 'https://i.ibb.co.com/0VQMxDL6/images.png',
    inputLabel: 'bKash Number',
    placeholder: 'e.g. 01XXXXXXXXX'
  },
  {
    id: 'Nagad',
    name: 'Nagad',
    logo: 'https://i.ibb.co.com/MzvRGdq/images.jpg',
    inputLabel: 'Nagad Number',
    placeholder: 'e.g. 01XXXXXXXXX'
  },
  {
    id: 'Binance',
    name: 'Binance',
    logo: 'https://i.ibb.co.com/pjs0BQNc/images-1.png',
    inputLabel: 'Binance ID / Address',
    placeholder: 'e.g. 12345678 or 0x...'
  }
];

const REASON_MESSAGES: Record<string, string> = {
  below_minimum: "সর্বনিম্ন উইথড্র অ্যামাউন্টের কম অনুরোধ করা হয়েছে।",
  insufficient_balance: "আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই!",
  not_enough_referrals: "প্রয়োজনীয় সংখ্যক সক্রিয় রেফারেল এখনও সম্পন্ন হয়নি।",
  missing_account: "দয়া করে সঠিক একাউন্ট নাম্বার অথবা এড্রেস দিন।",
  user_not_found: "ইউজার একাউন্ট পাওয়া যায়নি।"
};

export function CashOut() {
  const { user, config } = useAuth();
  const navigate = useNavigate();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('bKash');
  const [selectedAmount, setSelectedAmount] = useState<number>(config.withdrawAmounts[0] ?? 5);
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!user) return null;

  const currentMethod = METHODS.find((m) => m.id === selectedMethod) || METHODS[0];
  const hasEnoughBalance = user.balance >= selectedAmount;
  const hasEnoughReferrals = user.referralCount >= config.minReferralsForWithdraw;
  const canSubmit = hasEnoughBalance && hasEnoughReferrals && accountNumber.trim().length >= 4 && !submitting;

  const bdtAmount = selectedAmount * 120;

  const handleCashOut = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    triggerHaptic("medium");

    try {
      const res = await requestWithdrawal(
        user.telegramId,
        selectedAmount,
        accountNumber.trim(),
        selectedMethod === 'Binance' ? 'Binance (USDT BEP20)' : selectedMethod
      );
      setSubmitting(false);

      if (res.success) {
        triggerHaptic("success");
        toast.success("Withdrawal Requested Successfully!", {
          description: `অ্যাডমিন যাচাই করার পর আপনার ${selectedMethod} একাউন্টে পেমেন্ট পাঠিয়ে দেওয়া হবে।`
        });
        navigate("/wallet");
      } else {
        triggerHaptic("error");
        toast.error(REASON_MESSAGES[res.reason ?? ""] ?? "উইথড্র অনুরোধ ব্যর্থ হয়েছে।");
      }
    } catch {
      setSubmitting(false);
      triggerHaptic("error");
      toast.error("সার্ভার ত্রুটি। আবার চেষ্টা করুন।");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-3 pt-3 pb-10 text-ink">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/wallet")}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-card active:scale-95 transition-transform cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-[15px] font-extrabold text-ink">Cash Out</h1>
        </div>
        <span className="rounded-full border border-orange-200/70 bg-gradient-to-r from-[#fff3eb] to-[#ffedf1] px-3 py-1.5 text-[11px] font-extrabold text-orange-600 shadow-xs tabular-nums">
          Balance ${user.balance.toFixed(2)}
        </span>
      </header>

      {/* Select Amount Card */}
      <section className="relative overflow-hidden rounded-2xl border border-orange-200/60 bg-gradient-to-br from-[#fff3eb] via-[#fffaf6] to-[#ffedf1] p-4 shadow-card">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-orange-200/35 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-rose-200/30 blur-2xl"
        />

        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-ink">Select Amount</p>
            {(selectedMethod === 'bKash' || selectedMethod === 'Nagad') && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 shadow-xs">
                Rate: $1 = ৳120 BDT
              </span>
            )}
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {config.withdrawAmounts.map((amt) => {
              const isSelected = selectedAmount === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amt);
                    triggerHaptic("light");
                  }}
                  className={`flex flex-col items-center justify-center rounded-2xl py-2.5 transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? "bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md shadow-orange-500/20"
                      : "border border-black/5 bg-white text-ink shadow-xs hover:border-orange-200"
                  }`}
                >
                  <span className="text-[15px] font-extrabold tracking-wide tabular-nums">$ {amt}</span>
                  {(selectedMethod === 'bKash' || selectedMethod === 'Nagad') && (
                    <span className={`text-[10.5px] font-bold tabular-nums ${isSelected ? 'text-white/90' : 'text-gray-400'}`}>
                      ৳{amt * 120}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Payment Method Card */}
      <section className="mt-3 rounded-2xl border border-black/5 bg-white p-4 shadow-card">
        <h2 className="text-[14px] font-extrabold text-ink">Payment Method</h2>

        {/* 3 Payment Methods Selector */}
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {METHODS.map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => {
                  setSelectedMethod(method.id);
                  triggerHaptic("light");
                }}
                className={`relative flex flex-col items-center justify-center rounded-2xl px-2 py-3 transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? "border-2 border-orange-500 bg-gradient-to-br from-[#fff3eb] to-[#ffedf1] shadow-xs"
                    : "border border-black/5 bg-gray-50 hover:bg-gray-100"
                }`}
              >
                {/* Active Checkmark Badge */}
                {isSelected && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-orange-500 shadow-xs">
                    <Check className="h-2.5 w-2.5 stroke-[3] text-white" />
                  </span>
                )}

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1 shadow-xs">
                  <img
                    src={method.logo}
                    alt={method.name}
                    className="max-h-9 max-w-9 rounded-lg object-contain"
                  />
                </div>
                <span
                  className={`mt-2 text-[12px] font-bold tracking-wide ${
                    isSelected ? "text-orange-600" : "text-gray-600"
                  }`}
                >
                  {method.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Account Input Label */}
        <div className="mt-4">
          <label className="text-[13px] font-bold text-ink">
            {currentMethod.inputLabel}
          </label>
          <div className="mt-2 flex items-center rounded-2xl border border-black/10 bg-gray-50 px-3.5 py-2.5 transition-all focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/15">
            <img
              src={currentMethod.logo}
              alt=""
              className="mr-3 h-5 w-5 shrink-0 rounded object-contain"
            />
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={currentMethod.placeholder}
              className="flex-1 bg-transparent text-[13px] font-semibold text-ink placeholder-gray-400 outline-none"
            />
          </div>
        </div>
      </section>

      {/* Confirmation & Submit Action */}
      <section className="mt-3 rounded-2xl border border-black/5 bg-white p-4 shadow-card">
        {!hasEnoughBalance && (
          <p className="mb-2.5 rounded-2xl border border-rose-200 bg-rose-50 py-2.5 text-center text-[12px] font-bold text-rose-600">
            ⚠️ আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই!
          </p>
        )}

        {!hasEnoughReferrals && (
          <p className="mb-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center text-[12px] font-bold leading-relaxed text-amber-700">
            ⚠️ নূন্যতম {config.minReferralsForWithdraw} জন রেফার ছাড়া withdraw করা যাবে না (আপনার রেফার: {user.referralCount} জন)
          </p>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleCashOut}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-extrabold transition-all shadow-md ${
            canSubmit
              ? "bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-orange-500/20 hover:opacity-95 active:scale-98 cursor-pointer"
              : "bg-gray-200 text-gray-400 shadow-none cursor-not-allowed"
          }`}
        >
          {submitting ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowUpRight className="h-5 w-5" />
          )}
          <span>Cash out ${selectedAmount.toFixed(2)}</span>
          {(selectedMethod === 'bKash' || selectedMethod === 'Nagad') && (
            <span className="text-[13px] font-semibold opacity-90">({bdtAmount} BDT)</span>
          )}
        </button>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-gray-400">
          By cashing out, you agree to {config.appName}'s{" "}
          <span className="cursor-pointer font-semibold text-orange-500 underline">
            Cash Out Terms &amp; Conditions
          </span>
          .
        </p>
      </section>
    </main>
  );
}
