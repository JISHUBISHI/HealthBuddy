import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Sparkles, Zap, Shield, CreditCard, Loader2, ArrowLeft } from 'lucide-react';

interface PricingProps {
  onBack: () => void;
}

export const Pricing: React.FC<PricingProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ role: 'pro' })
      });
      
      if (response.ok) {
        // Redirect back to dashboard
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Subscription error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-main-bg flex min-h-screen flex-col items-center p-4 text-zinc-100 lg:p-8">
      <div className="max-w-4xl w-full space-y-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <div className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-4 py-1.5 text-sm font-bold text-blue-300"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade to Pro
          </motion.div>
          <h1 className="text-4xl font-black tracking-tight text-white lg:text-5xl">
            Unlock Your Full Health Potential
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-zinc-400">
            Get access to our most advanced AI agents, clinical report analysis, and personalized health roadmaps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {/* Free Plan */}
          <div className="space-y-8 rounded-[2.5rem] border border-white/[0.08] bg-zinc-900/50 p-8 opacity-75 backdrop-blur-sm">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Free Plan</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">₹0</span>
                <span className="text-zinc-500">/month</span>
              </div>
            </div>
            <ul className="space-y-4">
              {[
                "Basic Symptom Checker",
                "General Health Advice",
                "Standard Response Time",
                "Community Support"
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-zinc-400">
                  <Check className="h-5 w-5 text-zinc-600" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            <div className="pt-4">
              <div className="w-full rounded-2xl bg-zinc-950/60 py-4 text-center font-bold text-zinc-500">
                Current Plan
              </div>
            </div>
          </div>

          {/* Pro Plan */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative space-y-8 rounded-[2.5rem] border-2 border-blue-500/60 bg-zinc-900/70 p-8 shadow-2xl shadow-blue-900/20 backdrop-blur-xl"
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-6 py-1 rounded-full text-sm font-bold">
              MOST POPULAR
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Pro Membership</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">₹50</span>
                <span className="text-zinc-500">/month</span>
              </div>
            </div>
            <ul className="space-y-4">
              {[
                "Agentic HealthBuddy Analysis",
                "Clinical Report & Image Analysis",
                "Multi-Agent Orchestration",
                "Location-based Doctor Search",
                "Priority AI Processing",
                "Advanced Health Metrics"
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-white">
                  <div className="rounded-full bg-blue-500/20 p-1">
                    <Check className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-sm font-medium">{feature}</span>
                </li>
              ))}
            </ul>
            <div className="pt-4">
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-4 font-black text-white shadow-xl shadow-blue-900/25 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Upgrade Now
                    <Zap className="w-5 h-5 fill-current" />
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Secure Payment
              </div>
              <div className="flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                Cancel Anytime
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
