import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Ruler, Weight, User, ArrowRight, Loader2, Heart, Activity, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { calculateBMI, getBMICategory } from '../lib/healthMetrics';
import type { UserProfile } from '../types';

interface OnboardingProps {
  onComplete: (updatedProfile: UserProfile) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [isLoading, setIsLoading] = useState(false);

  const bmiPreview = useMemo(() => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const a = parseInt(age, 10);
    if (!height || !weight || !age || !Number.isFinite(h) || !Number.isFinite(w) || !Number.isFinite(a) || h <= 0 || w <= 0 || a <= 0) {
      return null;
    }
    const bmi = calculateBMI(h, w);
    if (!Number.isFinite(bmi)) return null;
    return { bmi, category: getBMICategory(bmi), h, w, a };
  }, [height, weight, age]);

  const handleSubmit = async () => {
    setIsLoading(true);

    const h = parseFloat(height);
    const w = parseFloat(weight);
    const a = parseInt(age, 10);
    const bmi = calculateBMI(h, w);
    const bmiCategory = getBMICategory(bmi);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          onboardingCompleted: true,
          healthMetrics: {
            height: h,
            weight: w,
            age: a,
            gender,
            bmi,
            bmiCategory
          }
        })
      });
      
      if (response.ok) {
        const updated = (await response.json()) as UserProfile;
        onComplete(updated);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Onboarding Error:", error);
      setIsLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const steps = [
    {
      title: "Welcome to HealthBuddy!",
      description: "Let's personalize your health journey. We'll start with some basic metrics.",
      icon: Heart,
      color: "bg-red-500"
    },
    {
      title: "How tall are you?",
      description: "Your height helps us calculate accurate health metrics like BMI.",
      icon: Ruler,
      color: "bg-blue-500"
    },
    {
      title: "What's your weight?",
      description: "Weight is a key indicator of overall health and metabolic status.",
      icon: Weight,
      color: "bg-purple-500"
    },
    {
      title: "A few more details",
      description: "Age and gender help us tailor our health advice to your specific needs.",
      icon: User,
      color: "bg-green-500"
    }
  ];

  return (
    <div className="dash-main-bg flex min-h-screen items-center justify-center p-4 text-zinc-100 transition-colors duration-300">
      <div className="max-w-md w-full">
        {/* Progress Bar */}
        <div className="flex gap-2 mb-8 px-4">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-500",
                i + 1 <= step ? 'bg-emerald-500' : 'bg-zinc-800'
              )}
            />
          ))}
        </div>

        <motion.div 
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="rounded-3xl border border-white/[0.08] bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex justify-center mb-6">
            <div className={cn("p-4 rounded-2xl shadow-lg text-white", steps[step-1].color)}>
              {React.createElement(steps[step-1].icon, { className: "w-8 h-8" })}
            </div>
          </div>

          <h2 className="mb-2 text-center text-2xl font-bold text-white">{steps[step-1].title}</h2>
          <p className="mb-8 text-center text-sm text-zinc-400">{steps[step-1].description}</p>

          <div className="space-y-6">
            {step === 1 && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-950/35 p-4">
                  <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400" />
                  <p className="text-xs leading-relaxed text-blue-200/90">
                    Your data is stored securely and used only to provide personalized health insights. You can update these metrics anytime in your profile.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="relative">
                <Ruler className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="number"
                  placeholder="Height in cm"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.1] bg-zinc-950/50 py-4 pl-12 pr-4 text-lg font-semibold text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/15"
                />
              </div>
            )}

            {step === 3 && (
              <div className="relative">
                <Weight className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="number"
                  placeholder="Weight in kg"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.1] bg-zinc-950/50 py-4 pl-12 pr-4 text-lg font-semibold text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/15"
                />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="relative">
                  <Activity className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="number"
                    placeholder="Age"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.1] bg-zinc-950/50 py-4 pl-12 pr-4 text-lg font-semibold text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>
                <div className="flex gap-2">
                  {(['male', 'female', 'other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-sm font-bold capitalize transition-all",
                        gender === g
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                          : 'border border-white/[0.1] bg-zinc-950/50 text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-300'
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                {bmiPreview && (
                  <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/50 to-zinc-950/80 p-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-300">Your BMI (saved to profile)</p>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-4xl font-black tabular-nums text-white">{bmiPreview.bmi}</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-300">{bmiPreview.category}</p>
                      </div>
                      <div className="space-y-0.5 text-right text-xs text-zinc-500">
                        <p>{bmiPreview.h} cm · {bmiPreview.w} kg</p>
                        <p>Age {bmiPreview.a} · {gender}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
                      BMI is a screening measure only. Tap Complete Setup to save — Dr. HealthBuddy will use this for tailored advice.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {step > 1 && (
                <button
                  onClick={prevStep}
                  className="flex-1 rounded-2xl py-4 px-6 font-bold text-zinc-500 transition-all hover:bg-white/[0.05] hover:text-zinc-300"
                >
                  Back
                </button>
              )}
              <button
                onClick={step === 4 ? handleSubmit : nextStep}
                disabled={
                  (step === 2 && !height) ||
                  (step === 3 && !weight) ||
                  (step === 4 && (!age || isLoading || !bmiPreview))
                }
                className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 px-6 font-bold text-white shadow-lg shadow-emerald-900/25 transition-all hover:bg-emerald-500 disabled:opacity-50 active:scale-[0.98]"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    {step === 4 ? 'Complete Setup' : 'Continue'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
