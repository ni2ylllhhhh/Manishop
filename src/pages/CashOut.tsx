import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Info, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { requestWithdrawal } from '../lib/store';
import { triggerHaptic } from '../lib/telegram';

const REASON_MESSAGES: Record<string, string> = {
  below_minimum: "সর্বনিম্ন উইথড্র অ্যামাউন্টের কম অনুরোধ করা হয়েছে।",
  insufficient_balance: "আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই!",
  not_enough_referrals: "প্রয়োজনীয় সংখ্যক সক্রিয় রেফারেল এখনও সম্পন্ন হয়নি।",
  missing_account: "দয়া করে সঠিক Binance ID অথবা USDT এড্রেস দিন।",
  user_not_found: "ইউজার একাউন্ট পাওয়া যায়নি।"
};

export function CashOut() {
  const { user, config } = useAuth();
  const navigate = useNavigate();

  const [selectedAmount, setSelectedAmount] = useState<number>(config.withdrawAmounts[0] ?? 5);
  const [accountNumber, setAccountNumber] = useState<string>(user?.binanceId ?? "");
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!user) return null;

  const hasEnoughBalance = user.balance >= selectedAmount;
  const hasEnoughReferrals = user.referralCount >= config.minReferralsForWithdraw;
  const canSubmit = hasEnoughBalance && hasEnoughReferrals && accountNumber.trim().length >= 4 && !submitting;

  const handleCashOut = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    triggerHaptic("medium");

    try {
      const res = await requestWithdrawal(user.telegramId, selectedAmount, accountNumber.trim());
      setSubmitting(false);

      if (res.success) {
        triggerHaptic("success");
        toast.success("Withdrawal Requested Successfully!", {
          description: "অ্যাডমিন যাচাই করার পর আপনার Binance ওয়ালেটে USDT জমা হয়ে যাবে।"
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
    <main className="min-h-screen bg-gray-50 px-3 pb-8 pt-3">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <button
          onClick={() => navigate("/wallet")}
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-card active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-ink" />
        </button>
        <h1 className="text-[15px] font-extrabold text-ink">Cash Out</h1>
        <span className="rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink shadow-card">
          Balance ${user.balance.toFixed(2)}
        </span>
      </header>

      {/* Select Amount Card */}
      <section className="rounded-2xl bg-white p-3 shadow-card">
        <p className="text-[13px] font-semibold text-gray-500">Select Amount</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {config.withdrawAmounts.map((amt) => {
            const isSelected = selectedAmount === amt;
            return (
              <button
                key={amt}
                onClick={() => {
                  setSelectedAmount(amt);
                  triggerHaptic("light");
                }}
                className={`rounded-xl border py-2.5 text-[15px] font-bold transition-all active:scale-95 ${
                  isSelected
                    ? "border-orange-400 bg-orange-50 text-ink shadow-sm"
                    : "border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                $ {amt}
              </button>
            );
          })}
        </div>
      </section>

      {/* Payment Method & Account */}
      <section className="mt-2.5 rounded-2xl bg-white p-3 shadow-card">
        <p className="text-[13px] font-semibold text-gray-500">Payment Method</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-gray-100 py-4 opacity-40 border border-transparent" aria-hidden="true" />
          <div className="rounded-xl bg-gray-100 py-4 opacity-40 border border-transparent" aria-hidden="true" />
          
          {/* Active Binance Option */}
          <div className="relative flex flex-col items-center rounded-xl border border-orange-400 bg-orange-50 py-2.5 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0B90B] text-[15px] font-black text-white shadow-sm">
              🪙
            </span>
            <span className="mt-1 text-[11px] font-bold text-orange-600">Binance</span>
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 shadow-sm">
              <Check className="h-2.5 w-2.5 text-white" />
            </span>
          </div>
        </div>

        <p className="mt-3 text-[13px] font-semibold text-gray-500">Account Number</p>
        <input
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="Binance Pay ID / USDT (BEP20) address"
          className="mt-1.5 h-10 w-full rounded-full border border-gray-200 bg-gray-50 px-4 text-[12px] text-ink outline-none placeholder:text-gray-400 focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
        />
        <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-relaxed text-gray-400">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
          আপনার সঠিক Binance Pay ID অথবা USDT (BEP20) ডিপোজিট অ্যাড্রেস প্রবেশ করান।
        </p>
      </section>

      {/* Confirmation & Submit Action */}
      <section className="mt-2.5 rounded-2xl bg-white p-3 shadow-card">
        {!hasEnoughBalance && (
          <p className="mb-2 rounded-xl border border-rose-200 bg-rose-50 py-2 text-center text-[12px] font-bold text-rose-600">
            ⚠️ Your balance is insufficient!
          </p>
        )}

        {!hasEnoughReferrals && (
          <p className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-[12px] font-bold text-rose-600 leading-relaxed">
            ⚠️ নূন্যতম {config.minReferralsForWithdraw} জন রেফার ছাড়া withdraw করা যাবে না (আপনার রেফার: {user.referralCount} জন)
          </p>
        )}

        <button
          disabled={!canSubmit}
          onClick={handleCashOut}
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-extrabold text-white transition-all shadow-md ${
            canSubmit
              ? "bg-gradient-to-r from-rose-500 to-orange-500 active:scale-98 hover:opacity-95"
              : "bg-gradient-to-r from-rose-300 to-orange-200 cursor-not-allowed opacity-80"
          }`}
        >
          {submitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUpRight className="h-4 w-4" />
          )}
          Cash out ${selectedAmount.toFixed(2)}
        </button>

        <p className="mt-2 text-center text-[11px] leading-relaxed text-gray-500">
          By cashing out, you agree to {config.appName}'s{" "}
          <span className="font-semibold text-orange-500 underline cursor-pointer">
            Cash Out Terms &amp; Conditions
          </span>
          .
        </p>
      </section>
    </main>
  );
}
