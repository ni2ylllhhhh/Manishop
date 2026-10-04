import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Info, LoaderCircle } from 'lucide-react';
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
  note: string;
}

const METHODS: MethodOption[] = [
  {
    id: 'bKash',
    name: 'bKash',
    logo: 'https://i.ibb.co.com/0VQMxDL6/images.png',
    inputLabel: 'bKash Number',
    placeholder: 'e.g. 01XXXXXXXXX',
    note: 'আপনার ব্যক্তিগত বা পার্সোনাল বিকাশ নাম্বার প্রদান করুন। ($1 = 120 BDT)'
  },
  {
    id: 'Nagad',
    name: 'Nagad',
    logo: 'https://i.ibb.co.com/MzvRGdq/images.jpg',
    inputLabel: 'Nagad Number',
    placeholder: 'e.g. 01XXXXXXXXX',
    note: 'আপনার ব্যক্তিগত বা পার্সোনাল নগদ নাম্বার প্রদান করুন। ($1 = 120 BDT)'
  },
  {
    id: 'Binance',
    name: 'Binance',
    logo: 'https://i.ibb.co.com/pjs0BQNc/images-1.png',
    inputLabel: 'Binance ID / Address',
    placeholder: 'e.g. 12345678 or 0x...',
    note: 'আপনার সঠিক Binance Pay ID অথবা USDT (BEP20) ডিপোজিট অ্যাড্রেস প্রবেশ করান।'
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
    <main className="min-h-screen bg-[#0f1318] px-3.5 pb-10 pt-3 text-white">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <button
          onClick={() => navigate("/wallet")}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white shadow active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-[16px] font-extrabold tracking-wide text-white">Cash Out</h1>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-orange-400 border border-white/10">
          Balance ${user.balance.toFixed(2)}
        </span>
      </header>

      {/* Select Amount Card */}
      <section className="rounded-3xl bg-[#1c2127] p-4 border border-white/5 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-gray-400">Select Amount</p>
          {(selectedMethod === 'bKash' || selectedMethod === 'Nagad') && (
            <span className="text-[11px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
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
                onClick={() => {
                  setSelectedAmount(amt);
                  triggerHaptic("light");
                }}
                className={`flex flex-col items-center justify-center rounded-2xl py-2.5 transition-all active:scale-95 ${
                  isSelected
                    ? "border-2 border-orange-500 bg-orange-500/10 text-white shadow-md shadow-orange-500/20"
                    : "border border-white/5 bg-[#252b33] text-gray-300 hover:bg-[#2c333d]"
                }`}
              >
                <span className="text-[15px] font-extrabold tracking-wide">$ {amt}</span>
                {(selectedMethod === 'bKash' || selectedMethod === 'Nagad') && (
                  <span className={`text-[10px] font-bold ${isSelected ? 'text-orange-400' : 'text-gray-400'}`}>
                    ৳{amt * 120}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Payment Method Card - Styled Exactly Like Screenshot */}
      <section className="mt-3 rounded-3xl bg-[#1c2127] p-4 border border-white/5 shadow-xl">
        <h2 className="text-[14px] font-bold text-white tracking-wide">Payment Method</h2>
        
        {/* 3 Payment Methods Selector */}
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {METHODS.map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                onClick={() => {
                  setSelectedMethod(method.id);
                  triggerHaptic("light");
                }}
                className={`relative flex flex-col items-center justify-center rounded-2xl py-3 px-2 transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? "border-2 border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/15"
                    : "border border-white/5 bg-[#242930] hover:bg-[#2a3038]"
                }`}
              >
                {/* Active Checkmark Badge */}
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 shadow-sm">
                    <Check className="h-2.5 w-2.5 text-white stroke-[3]" />
                  </span>
                )}

                <div className="flex h-11 w-11 items-center justify-center">
                  <img
                    src={method.logo}
                    alt={method.name}
                    className="max-h-10 max-w-10 object-contain rounded-lg drop-shadow-sm"
                  />
                </div>
                <span
                  className={`mt-2 text-[12px] font-bold tracking-wide ${
                    isSelected ? "text-orange-400" : "text-gray-300"
                  }`}
                >
                  {method.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Visa / Mastercard Blurred Row */}
        <div className="relative mt-2.5 flex items-center justify-center rounded-2xl bg-[#242930]/70 py-2.5 px-3 border border-white/5 overflow-hidden select-none">
          <div className="flex items-center gap-2 filter blur-[2px] opacity-40">
            <span className="text-[11px] font-bold text-blue-400 tracking-wider">VISA</span>
            <div className="flex -space-x-1.5">
              <div className="h-3.5 w-3.5 rounded-full bg-red-500" />
              <div className="h-3.5 w-3.5 rounded-full bg-amber-400 opacity-80" />
            </div>
            <span className="text-[11px] font-bold text-gray-300">Visa/Mastercard</span>
          </div>
          <span className="absolute text-[10px] font-bold text-gray-400 tracking-wider uppercase bg-[#1c2127]/90 px-2 py-0.5 rounded-full border border-white/10">
            Coming Soon
          </span>
        </div>

        {/* Dynamic Account Input Label */}
        <div className="mt-4">
          <label className="text-[13px] font-semibold text-gray-300">
            {currentMethod.inputLabel}
          </label>
          <div className="mt-2 flex items-center rounded-full bg-[#12161b] border border-white/10 px-4 py-2.5 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500/20 transition-all">
            <img
              src={currentMethod.logo}
              alt=""
              className="h-5 w-5 rounded object-contain shrink-0 mr-3"
            />
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={currentMethod.placeholder}
              className="flex-1 bg-transparent text-[13px] text-white placeholder-gray-500 outline-none font-medium"
            />
          </div>
          <p className="mt-2 flex items-start gap-1 text-[11px] leading-relaxed text-gray-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
            {currentMethod.note}
          </p>
        </div>
      </section>

      {/* Confirmation & Submit Action */}
      <section className="mt-3 rounded-3xl bg-[#1c2127] p-4 border border-white/5 shadow-xl">
        {!hasEnoughBalance && (
          <p className="mb-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 py-2.5 text-center text-[12px] font-bold text-rose-400">
            ⚠️ আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই!
          </p>
        )}

        {!hasEnoughReferrals && (
          <p className="mb-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-center text-[12px] font-bold text-amber-400 leading-relaxed">
            ⚠️ নূন্যতম {config.minReferralsForWithdraw} জন রেফার ছাড়া withdraw করা যাবে না (আপনার রেফার: {user.referralCount} জন)
          </p>
        )}

        <button
          disabled={!canSubmit}
          onClick={handleCashOut}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-extrabold text-white transition-all shadow-lg ${
            canSubmit
              ? "bg-gradient-to-r from-orange-500 to-amber-500 active:scale-98 hover:opacity-95 shadow-orange-500/25 cursor-pointer"
              : "bg-gray-700/60 cursor-not-allowed opacity-60 text-gray-400"
          }`}
        >
          {submitting ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowUpRight className="h-5 w-5" />
          )}
          Cash out ${selectedAmount.toFixed(2)}
          {(selectedMethod === 'bKash' || selectedMethod === 'Nagad') && (
            <span className="text-[13px] font-normal opacity-90">({bdtAmount} BDT)</span>
          )}
        </button>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-gray-500">
          By cashing out, you agree to {config.appName}'s{" "}
          <span className="font-semibold text-orange-400 underline cursor-pointer">
            Cash Out Terms &amp; Conditions
          </span>
          .
        </p>
      </section>
    </main>
  );
}
