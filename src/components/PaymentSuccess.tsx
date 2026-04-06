import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const PaymentSuccess: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const updateProStatus = async () => {
      if (!sessionId) return;

      try {
        const response = await fetch('/api/auth/profile', {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            role: 'pro',
            subscription: {
              id: sessionId,
              status: 'active',
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }
          })
        });
        
        if (response.ok) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error updating pro status:', error);
      } finally {
        setLoading(false);
      }
    };

    updateProStatus();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="dash-main-bg flex min-h-screen flex-col items-center justify-center p-8 text-zinc-100">
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-emerald-400" />
        <p className="font-bold text-zinc-400">Verifying your subscription...</p>
      </div>
    );
  }

  return (
    <div className="dash-main-bg flex min-h-screen flex-col items-center justify-center p-8 text-zinc-100">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md space-y-8 rounded-[2.5rem] border border-white/[0.08] bg-zinc-900/75 p-10 text-center shadow-2xl shadow-emerald-900/10 backdrop-blur-xl"
      >
        <div className="relative inline-block">
          <div className="rounded-full bg-emerald-500/15 p-6">
            <CheckCircle2 className="h-16 w-16 text-emerald-400" />
          </div>
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-emerald-400/15 blur-2xl"
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl font-black tracking-tight text-white">Payment Successful!</h2>
          <p className="font-medium text-zinc-400">
            Welcome to HealthBuddy Pro. Your account has been upgraded.
          </p>
        </div>

        <div className="space-y-4 rounded-3xl border border-blue-500/20 bg-blue-950/30 p-6">
          <div className="flex items-center gap-3 text-blue-300">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-bold">Pro Features Unlocked</span>
          </div>
          <ul className="text-left space-y-2">
            {[
              "Agentic HealthBuddy Analysis",
              "Clinical Report Analysis",
              "Priority Processing"
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => window.location.href = '/'}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 font-black text-zinc-950 transition-all hover:bg-zinc-100 active:scale-95"
        >
          Go to Dashboard
          <ArrowRight className="w-5 h-5" />
        </button>
      </motion.div>
    </div>
  );
};
