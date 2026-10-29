import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, statusLabel, error, retry, demoLogin, config } = useAuth();

  if (status === 'ready') {
    return <>{children}</>;
  }

  if (status === 'error') {
    return (
      <GateContainer>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <h1 className="mt-3 text-base font-bold text-ink">Login Failed</h1>
        <p className="mt-1 max-w-[16rem] text-center text-xs leading-relaxed text-gray-500">
          {error}
        </p>
        <div className="mt-4 flex w-full max-w-[15rem] flex-col gap-2">
          <a
            href={`https://t.me/${config.botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#229ED9] text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            <Send className="h-3.5 w-3.5" /> Open Telegram Bot
          </a>
          <button
            onClick={retry}
            className="h-9 rounded-full border border-brand-200 bg-white text-xs font-semibold text-brand-600 shadow-sm"
          >
            Try Again
          </button>
          {config.allowDemoLogin && (
            <button
              onClick={demoLogin}
              className="h-8 text-[11px] font-medium text-gray-400 underline underline-offset-2 hover:text-gray-600"
            >
              Preview with Demo Account
            </button>
          )}
        </div>
      </GateContainer>
    );
  }

  return (
    <GateContainer>
      {status === 'success' ? (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50"
        >
          <CheckCircle className="h-6 w-6 text-emerald-500" />
        </motion.div>
      ) : (
        <div className="relative flex h-12 w-12 items-center justify-center">
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-brand-100 border-t-brand-500"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
          />
          <Send className="h-5 w-5 text-brand-500" />
        </div>
      )}
      <motion.p
        key={statusLabel}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 text-sm font-semibold text-ink"
      >
        {statusLabel}
      </motion.p>
      <p className="mt-1 text-[11px] text-gray-400">
        {config.appName} • Telegram Secure Login
      </p>
    </GateContainer>
  );
}

function GateContainer({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-cream px-6">
      {children}
    </main>
  );
}
