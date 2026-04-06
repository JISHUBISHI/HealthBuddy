import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Onboarding from './components/Onboarding';
import { Pricing } from './components/Pricing';
import { PaymentSuccess } from './components/PaymentSuccess';
import { Loader2 } from 'lucide-react';
import { UserProfile } from './types';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('oauth_token');
    const oauthError = params.get('oauth_error');
    if (oauthToken) {
      localStorage.setItem('token', oauthToken);
      params.delete('oauth_token');
    }
    if (oauthError) {
      sessionStorage.setItem('oauth_error', oauthError);
      params.delete('oauth_error');
    }
    if (oauthToken || oauthError) {
      const q = params.toString();
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (q ? `?${q}` : '') + window.location.hash
      );
    }

    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          localStorage.removeItem('token');
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="dash-main-bg flex min-h-screen items-center justify-center text-zinc-100 transition-colors duration-300">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!user) return <Auth onAuthSuccess={(u) => setUser(u)} />;

  if (user && !user.onboardingCompleted) {
    return (
      <Onboarding
        onComplete={(updated) => setUser((prev) => (prev ? { ...prev, ...updated } : updated))}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              profile={user}
              onLogout={handleLogout}
              onProfileChange={(p) => setUser((prev) => (prev ? { ...prev, ...p } : p))}
            />
          }
        />
        <Route path="/pricing" element={<Pricing onBack={() => window.location.href = '/'} />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
