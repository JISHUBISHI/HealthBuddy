import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LogOut,
  HeartPulse,
  Plus,
  MessageSquare,
  Trash2,
  Send,
  Loader2,
  User,
  Bot,
  Stethoscope,
  Pill,
  Leaf,
  Activity,
  Menu,
  X,
  Globe,
  Sparkles,
  Paperclip,
  Mic,
  Sun,
  Moon,
  Crown,
  Search,
  Home,
  LayoutTemplate,
  Compass,
  History,
  Wallet,
  ChevronDown,
  ImageIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { calculateBMI, getBMICategory, formatHealthContextForAI } from '../lib/healthMetrics';
import { ChatSession, ChatMessage, AgentType, OperationType, ApiErrorInfo, UserProfile } from '../types';
import { generateHealthResponse } from '../services/ai';
import { HumanBodyExplorer } from './HumanBodyExplorer';
import { AgenticHealthBuddy } from './AgenticHealthBuddy';

import { useNavigate } from 'react-router-dom';

const AGENTS: { type: AgentType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'general', label: 'General Health', icon: HeartPulse, color: 'bg-blue-500' },
  { type: 'symptom', label: 'Symptom Analyzer', icon: Stethoscope, color: 'bg-red-500' },
  { type: 'medication', label: 'Medication Advisor', icon: Pill, color: 'bg-purple-500' },
  { type: 'lifestyle', label: 'Lifestyle Coach', icon: Activity, color: 'bg-green-500' },
  { type: 'remedy', label: 'Home Remedies', icon: Leaf, color: 'bg-amber-500' },
];

export default function Dashboard({
  profile: initialProfile,
  onLogout,
  onProfileChange,
}: {
  profile: UserProfile | null;
  onLogout: () => void;
  onProfileChange?: (p: UserProfile) => void;
}) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('general');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isReasonEnabled, setIsReasonEnabled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  const isPro = profile?.isPro || false;
  const [activeView, setActiveView] = useState<'chat' | 'profile' | 'body-parts' | 'agentic'>('chat');
  const [selectedFile, setSelectedFile] = useState<{ name: string, type: string, base64: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [metricDraft, setMetricDraft] = useState({
    height: '',
    weight: '',
    age: '',
    gender: 'male' as 'male' | 'female' | 'other',
  });
  const [metricsSaving, setMetricsSaving] = useState(false);

  useEffect(() => {
    if (!profile?.healthMetrics) {
      setMetricDraft({ height: '', weight: '', age: '', gender: 'male' });
      return;
    }
    const m = profile.healthMetrics;
    setMetricDraft({
      height: String(m.height),
      weight: String(m.weight),
      age: String(m.age),
      gender: m.gender,
    });
  }, [
    profile?.healthMetrics?.height,
    profile?.healthMetrics?.weight,
    profile?.healthMetrics?.age,
    profile?.healthMetrics?.gender,
  ]);

  const profileBmiPreview = useMemo(() => {
    const h = parseFloat(metricDraft.height);
    const w = parseFloat(metricDraft.weight);
    const a = parseInt(metricDraft.age, 10);
    if (!metricDraft.height || !metricDraft.weight || !metricDraft.age || !Number.isFinite(h) || !Number.isFinite(w) || !Number.isFinite(a) || h <= 0 || w <= 0 || a <= 0) {
      return null;
    }
    const bmi = calculateBMI(h, w);
    if (!Number.isFinite(bmi)) return null;
    return { bmi, category: getBMICategory(bmi), h, w, a };
  }, [metricDraft.height, metricDraft.weight, metricDraft.age]);

  const handleSaveHealthMetrics = async () => {
    if (!profileBmiPreview) return;
    setMetricsSaving(true);
    try {
      const { h, w, a, bmi, category } = profileBmiPreview;
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          healthMetrics: {
            height: h,
            weight: w,
            age: a,
            gender: metricDraft.gender,
            bmi,
            bmiCategory: category,
          },
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as UserProfile;
        setProfile(updated);
        onProfileChange?.(updated);
      }
    } catch (e) {
      console.error('Save health metrics failed:', e);
    } finally {
      setMetricsSaving(false);
    }
  };

  const handleUpgrade = async () => {
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
        const updatedProfile = (await response.json()) as UserProfile;
        setProfile(updatedProfile);
        onProfileChange?.(updatedProfile);
      }
    } catch (error) {
      console.error("Error upgrading to Pro:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPro) {
      navigate('/pricing');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setSelectedFile({
        name: file.name,
        type: file.type,
        base64: base64.split(',')[1] // Remove data:image/png;base64,
      });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (initialProfile) setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch('/api/chats', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
          const data = await response.json();
          setSessions(data);
        }
      } catch (error) {
        handleApiError(error, OperationType.LIST, 'chats');
      }
    };

    fetchSessions();
  }, []);

  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/chats/${currentSessionId}/messages`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (error) {
        handleApiError(error, OperationType.LIST, `chats/${currentSessionId}/messages`);
      }
    };

    fetchMessages();
  }, [currentSessionId]);

  useEffect(() => {
    if (sessions.length > 0 || currentSessionId || isLoading) return;
    
    const autoCreate = async () => {
      try {
        const response = await fetch('/api/chats', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ title: 'Initial Consultation' })
        });
        
        if (response.ok) {
          const newChat = await response.json();
          setCurrentSessionId(newChat.id);
          setSessions([newChat]);
          
          const welcomeMsg = {
            role: 'model',
            content: `Hello ${profile?.displayName || 'there'}. I am Dr. HealthBuddy. I've reviewed your health profile and I'm ready to assist you. \n\nWhat kind of information do you require today? Please select an option below or describe your concern.`,
            agentType: 'general',
            options: AGENTS.map(agent => ({ label: agent.label, value: agent.type }))
          };
          
          await fetch(`/api/chats/${newChat.id}/messages`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(welcomeMsg)
          });
          
          setMessages([ { ...welcomeMsg, timestamp: new Date().toISOString() } as any ]);
        }
      } catch (error) {
        handleApiError(error, OperationType.CREATE, 'chats');
      }
    };
    
    autoCreate();
  }, [sessions.length, currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleApiError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: ApiErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: profile?.uid,
        email: profile?.email,
      },
      operationType,
      path
    };
    console.error('API Error: ', JSON.stringify(errInfo));
  };

  const createNewSession = async () => {
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title: 'New Conversation' })
      });
      
      if (response.ok) {
        const newChat = await response.json();
        setCurrentSessionId(newChat.id);
        setSessions(prev => [newChat, ...prev]);
        setActiveView('chat');
        setIsSidebarOpen(false);
      }
    } catch (error) {
      handleApiError(error, OperationType.CREATE, 'chats');
    }
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/chats/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) setCurrentSessionId(null);
      }
    } catch (error) {
      handleApiError(error, OperationType.DELETE, `chats/${id}`);
    }
  };

  const handleSend = async (e: React.FormEvent | null, overrideInput?: string) => {
    if (e) e.preventDefault();
    const finalInput = overrideInput || input;
    if (!finalInput.trim() || isLoading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const response = await fetch('/api/chats', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ title: finalInput.slice(0, 30) + '...' })
        });
        
        if (response.ok) {
          const newChat = await response.json();
          sessionId = newChat.id;
          setCurrentSessionId(sessionId);
          setSessions(prev => [newChat, ...prev]);
        } else {
          return;
        }
      } catch (error) {
        handleApiError(error, OperationType.CREATE, 'chats');
        return;
      }
    }

    const userMessage = {
      role: 'user',
      content: finalInput,
      agentType: selectedAgent,
      ...(selectedFile ? {
        fileUrl: `data:${selectedFile.type};base64,${selectedFile.base64}`,
        fileType: selectedFile.type
      } : {})
    };

    if (!overrideInput) setInput('');
    setIsLoading(true);

    const fileData = selectedFile ? { mimeType: selectedFile.type, data: selectedFile.base64 } : undefined;
    setSelectedFile(null);

    try {
      const msgResponse = await fetch(`/api/chats/${sessionId}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(userMessage)
      });
      
      if (msgResponse.ok) {
        const savedUserMsg = await msgResponse.json();
        setMessages(prev => [...prev, savedUserMsg]);
      }

      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const healthContextForSystem = profile?.healthMetrics
        ? formatHealthContextForAI(profile.healthMetrics)
        : undefined;

      const aiResponse = await generateHealthResponse(
        finalInput,
        selectedAgent,
        history,
        isSearchEnabled,
        isReasonEnabled,
        fileData,
        healthContextForSystem
      );

      const modelMessage = {
        role: 'model',
        content: aiResponse,
        agentType: selectedAgent
      };

      const aiMsgResponse = await fetch(`/api/chats/${sessionId}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(modelMessage)
      });

      if (aiMsgResponse.ok) {
        const savedAiMsg = await aiMsgResponse.json();
        setMessages(prev => [...prev, savedAiMsg]);
      }
    } catch (error: any) {
      console.error("Chat Error:", error);
      const errorMessage = {
        role: 'model',
        content: `⚠️ **Error:** ${error.message || "I'm having trouble connecting to my brain (AI service). Please check if the API keys are configured correctly in the settings."}`,
        agentType: selectedAgent,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage as any]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionClick = async (label: string, value: AgentType) => {
    if (!currentSessionId || isLoading) return;
    setSelectedAgent(value);
    await handleSend(null, `I need help with: ${label}`);
  };

  const filteredSessions = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, sidebarSearch]);

  const greetingPeriod = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  })();

  const firstName =
    profile?.displayName?.split(/\s+/)[0] || profile?.email?.split('@')[0] || 'there';

  return (
    <div className="flex h-screen overflow-hidden bg-[#080808] text-zinc-100 transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/[0.06] bg-zinc-950/55 backdrop-blur-2xl transition-transform duration-300 lg:relative lg:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/[0.06] p-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-emerald-400/15 to-cyan-500/15">
                <HeartPulse className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-white">HealthBuddy</span>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 pt-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                placeholder="Search chats"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full rounded-full border border-white/[0.08] bg-zinc-900/70 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500/25 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={createNewSession}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-100"
            >
              <Plus className="h-4 w-4" />
              New chat
            </button>
          </div>

          {profile?.healthMetrics && (
            <div className="mx-3 mt-3 rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Vitals</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold text-white',
                    profile.healthMetrics.bmi < 18.5
                      ? 'bg-amber-500'
                      : profile.healthMetrics.bmi < 25
                        ? 'bg-emerald-600'
                        : 'bg-red-500'
                  )}
                >
                  {profile.healthMetrics.bmiCategory}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-zinc-500">BMI</p>
                  <p className="font-bold text-white">{profile.healthMetrics.bmi}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Weight</p>
                  <p className="font-bold text-white">{profile.healthMetrics.weight} kg</p>
                </div>
              </div>
            </div>
          )}

          <nav className="mt-4 space-y-0.5 px-2">
            {[
              { id: 'home' as const, label: 'Home', icon: Home, view: 'chat' as const, extra: () => setActiveView('chat') },
              {
                id: 'templates',
                label: 'AI reports',
                icon: LayoutTemplate,
                view: 'agentic' as const,
                extra: () => {
                  if (!isPro) navigate('/pricing');
                  else setActiveView('agentic');
                },
              },
              { id: 'explore', label: 'Explore', icon: Compass, view: 'body-parts' as const, extra: () => setActiveView('body-parts') },
              { id: 'history', label: 'History', icon: History, view: 'chat' as const, extra: () => setActiveView('chat') },
              { id: 'wallet', label: 'Plans', icon: Wallet, view: 'chat' as const, extra: () => navigate('/pricing') },
              { id: 'profile', label: 'Profile', icon: User, view: 'profile' as const, extra: () => setActiveView('profile') },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.extra();
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  item.id === 'wallet'
                    ? 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                    : activeView === item.view
                      ? 'bg-white/[0.08] text-white'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                )}
              >
                <item.icon className="h-[18px] w-[18px] opacity-80" />
                {item.label}
                {item.id === 'templates' && !isPro && <Crown className="ml-auto h-3.5 w-3.5 text-amber-500" />}
              </button>
            ))}
          </nav>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 no-scrollbar">
            {activeView === 'chat' && (
              <div className="space-y-1 pb-4">
                <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-zinc-600">Chats</h3>
                {filteredSessions.slice(0, 20).map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      setCurrentSessionId(session.id);
                      setActiveView('chat');
                      setIsSidebarOpen(false);
                    }}
                    className={cn(
                      'group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors',
                      currentSessionId === session.id
                        ? 'bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-500/20'
                        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                    )}
                  >
                    <span className="line-clamp-2 text-xs font-medium leading-snug">{session.title}</span>
                    <Trash2
                      className="h-3.5 w-3.5 shrink-0 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      onClick={(e) => deleteSession(e, session.id)}
                    />
                  </button>
                ))}
                {filteredSessions.length === 0 && (
                  <p className="px-2 text-xs text-zinc-600">No chats match your search.</p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.06] p-4">
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-3">
              <img
                src={profile?.photoURL || ''}
                alt=""
                className="h-10 w-10 rounded-xl bg-zinc-800 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{profile?.displayName}</p>
                <p className="truncate text-xs text-zinc-500">{profile?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col dash-main-bg">
        <header className="sticky top-0 z-30 flex h-[4.25rem] shrink-0 items-center justify-between border-b border-white/[0.06] bg-zinc-950/40 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-xl p-2 text-zinc-400 hover:bg-white/5 lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            {activeView === 'chat' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAgentPickerOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-zinc-900/80 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white/15 hover:bg-zinc-800/80"
                >
                  <Bot className="h-4 w-4 text-emerald-400" />
                  <span className="max-w-[10rem] truncate sm:max-w-[14rem]">
                    {AGENTS.find((a) => a.type === selectedAgent)?.label ?? 'Assistant'}
                  </span>
                  <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition-transform', agentPickerOpen && 'rotate-180')} />
                </button>
                {agentPickerOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-[60] cursor-default bg-black/55 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-none"
                      aria-label="Close menu"
                      onClick={() => setAgentPickerOpen(false)}
                    />
                    <div className="absolute left-0 top-full z-[70] mt-2 w-[min(calc(100vw-2rem),18rem)] overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/95 py-1 shadow-2xl backdrop-blur-xl">
                      {AGENTS.map((agent) => (
                        <button
                          key={agent.type}
                          type="button"
                          onClick={() => {
                            setSelectedAgent(agent.type);
                            setAgentPickerOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                            selectedAgent === agent.type
                              ? 'bg-emerald-500/15 text-emerald-200'
                              : 'text-zinc-300 hover:bg-white/[0.06]'
                          )}
                        >
                          {React.createElement(agent.icon, { className: 'h-4 w-4 shrink-0' })}
                          {agent.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {activeView !== 'chat' && (
              <span className="text-sm font-medium text-zinc-400">
                {activeView === 'profile' && 'Profile'}
                {activeView === 'body-parts' && 'Explore'}
                {activeView === 'agentic' && 'AI reports'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => !isPro && handleUpgrade()}
              className={cn(
                'hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-all sm:flex sm:text-sm',
                isPro
                  ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-900/20 hover:scale-[1.02]'
              )}
            >
              <Crown className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" />
              {isPro ? 'Pro' : 'Upgrade'}
            </button>
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="rounded-xl p-2.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl p-2.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* View Content */}
        {activeView === 'chat' ? (
          <>
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="pointer-events-none absolute inset-0 chat-ambient-bg opacity-60 dark:opacity-100" aria-hidden />

              <div className="custom-scrollbar relative z-0 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
              {sessions.length === 0 && !currentSessionId ? (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center"
                >
                  <div className="dash-orb mb-8 h-28 w-28 rounded-full opacity-90" />
                  <Loader2 className="mb-4 h-8 w-8 animate-spin text-emerald-400" />
                  <h2 className="mb-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Starting your consultation
                  </h2>
                  <p className="max-w-sm text-sm leading-relaxed text-zinc-500">
                    Dr. HealthBuddy is getting ready…
                  </p>
                </motion.div>
              ) : messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-4 text-center"
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative mb-10"
                  >
                    <div className="dash-orb h-32 w-32 rounded-full sm:h-36 sm:w-36" />
                    <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/5 to-white/10" />
                  </motion.div>
                  <h2 className="mb-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Good {greetingPeriod}, {firstName}.
                  </h2>
                  <p className="max-w-md text-base text-zinc-400 sm:text-lg">
                    Can I help you with anything?
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-5 sm:space-y-6 pb-4">
                {messages.map((message, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 32,
                      delay: Math.min(idx * 0.04, 0.24),
                    }}
                    className={cn(
                      "flex gap-3 items-end",
                      message.role === 'user' ? "ml-auto flex-row-reverse max-w-[min(92%,36rem)]" : "mr-auto max-w-[min(92%,36rem)]"
                    )}
                  >
                    <motion.div
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 24, delay: 0.02 }}
                      className={cn(
                        "w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md backdrop-blur-sm ring-2",
                        message.role === 'user'
                          ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white ring-blue-400/30"
                          : "bg-white/80 text-slate-600 ring-white/50 border border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-600/50 dark:ring-slate-600/30"
                      )}
                    >
                      {message.role === 'user' ? <User className="w-[18px] h-[18px] sm:w-5 sm:h-5" /> : <Bot className="w-[18px] h-[18px] sm:w-5 sm:h-5" />}
                    </motion.div>
                    <div className={cn("flex flex-col gap-2 min-w-0", message.role === 'user' ? "items-end" : "items-start")}>
                      {message.fileUrl && (
                        <div className="max-w-sm rounded-2xl overflow-hidden border border-white/40 dark:border-slate-600/40 shadow-lg backdrop-blur-sm bg-white/30 dark:bg-slate-900/40">
                          {message.fileType?.startsWith('image/') ? (
                            <img src={message.fileUrl} alt="Attached" className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="p-4 flex items-center gap-3 bg-white/40 dark:bg-slate-800/50">
                              <Paperclip className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-slate-900 dark:text-white truncate">Document attached</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-3xl px-4 py-3 shadow-lg backdrop-blur-xl transition-shadow duration-300 sm:px-5 sm:py-4",
                          message.role === 'user'
                            ? "rounded-tr-lg border border-blue-400/25 bg-gradient-to-br from-blue-600/92 to-blue-700/92 text-white shadow-blue-500/20"
                            : "rounded-tl-lg border border-white/[0.14] bg-white/[0.06] text-zinc-200 shadow-black/20"
                        )}
                      >
                        <div className={cn(
                          "prose max-w-none prose-sm leading-relaxed prose-headings:text-inherit prose-p:my-0 prose-p:text-[13px] prose-p:text-inherit prose-strong:text-inherit prose-code:text-inherit sm:prose-p:text-sm",
                          message.role === 'user' ? "prose-invert prose-p:text-white/95" : "prose-invert prose-p:text-zinc-200"
                        )}>
                          <Markdown>{message.content}</Markdown>
                        </div>
                        <p
                          className={cn(
                            "mt-3 text-[10px] tabular-nums",
                            message.role === 'user' ? "text-right text-white/55" : "text-left text-zinc-500"
                          )}
                        >
                          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {message.options && message.options.length > 0 && (
                        <div className={cn("flex flex-wrap gap-2 mt-1", message.role === 'user' ? "justify-end" : "justify-start")}>
                          {message.options.map((option) => (
                            <motion.button
                              key={option.value}
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => handleOptionClick(option.label, option.value)}
                              className="px-4 py-2 rounded-full text-xs font-bold bg-white/70 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-slate-600/40 text-slate-700 dark:text-slate-200 hover:bg-blue-50/90 dark:hover:bg-blue-950/40 hover:border-blue-200/60 dark:hover:border-blue-800/50 hover:text-blue-700 dark:hover:text-blue-300 shadow-sm transition-colors"
                            >
                              {option.label}
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                </div>
              )}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 mr-auto max-w-[min(92%,36rem)] items-end mt-2"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/80 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-600/50 flex items-center justify-center flex-shrink-0 shadow-md ring-2 ring-white/40 dark:ring-slate-600/20">
                    <Bot className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="px-5 py-4 rounded-3xl rounded-tl-lg bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl border border-white/60 dark:border-slate-600/35 shadow-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Thinking…</span>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="relative z-10 shrink-0 border-t border-white/[0.06] bg-zinc-950/70 px-4 pb-8 pt-5 backdrop-blur-2xl sm:px-8">
                <div className="mx-auto w-full max-w-3xl">
                  {selectedFile && (
                    <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-3">
                      {selectedFile.type.startsWith('image/') ? (
                        <img
                          src={`data:${selectedFile.type};base64,${selectedFile.base64}`}
                          alt="Preview"
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                          <Paperclip className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{selectedFile.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{selectedFile.type}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="p-2 text-zinc-500 transition-colors hover:text-red-400"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  )}

                  <form
                    onSubmit={handleSend}
                    className="rounded-[1.35rem] border border-white/[0.1] bg-zinc-900/50 p-4 shadow-inner shadow-black/20"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Message AI Chat…"
                      className="mb-4 w-full border-0 bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-600"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            'relative flex items-center gap-2 rounded-full border border-white/[0.08] bg-zinc-800/80 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-white/15 hover:bg-zinc-800',
                            !isPro && 'opacity-60'
                          )}
                          title={isPro ? 'Attach file' : 'Pro: attach reports'}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {!isPro && <Crown className="absolute -right-1 -top-1 h-2.5 w-2.5 text-amber-500" />}
                        </button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                          accept="image/*,application/pdf"
                        />
                        <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-zinc-800/80 px-3 py-2 text-xs font-medium text-zinc-400 sm:flex">
                          <ImageIcon className="h-3.5 w-3.5" />
                          Medical image
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                          className={cn(
                            'flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-all',
                            isSearchEnabled
                              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                              : 'border-white/[0.08] bg-zinc-800/80 text-zinc-300 hover:border-white/15'
                          )}
                        >
                          <Globe className="h-3.5 w-3.5" />
                          Search the web
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsReasonEnabled(!isReasonEnabled)}
                          className={cn(
                            'hidden items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-all sm:flex',
                            isReasonEnabled
                              ? 'border-violet-500/35 bg-violet-500/10 text-violet-200'
                              : 'border-white/[0.08] bg-zinc-800/80 text-zinc-300 hover:border-white/15'
                          )}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Reason
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-xl p-2.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
                          title="Voice (coming soon)"
                        >
                          <Mic className="h-5 w-5" />
                        </button>
                        <button
                          type="submit"
                          disabled={(!input.trim() && !selectedFile) || isLoading}
                          className="rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 p-2.5 text-white shadow-lg shadow-emerald-900/30 transition-all hover:brightness-110 disabled:opacity-40"
                        >
                          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </form>

                  {messages.length === 0 && currentSessionId && (
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {[
                        {
                          title: 'Smart insights',
                          body: 'Personalized guidance from your profile and symptoms — not one-size-fits-all.',
                        },
                        {
                          title: 'Track vitals',
                          body: 'BMI and metrics in your profile help Dr. HealthBuddy tailor safer suggestions.',
                        },
                        {
                          title: 'Evidence-aware',
                          body: 'Optional web search pulls verified context when you need up-to-date information.',
                        },
                      ].map((card) => (
                        <div
                          key={card.title}
                          className="rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-4 transition-colors hover:border-white/10"
                        >
                          <h3 className="mb-1.5 text-sm font-semibold text-white">{card.title}</h3>
                          <p className="text-xs leading-relaxed text-zinc-500">{card.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="mt-4 text-center text-[10px] text-zinc-600">
                    HealthBuddy can make mistakes. Not a substitute for professional medical advice.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : activeView === 'profile' ? (
          <div className="flex-1 overflow-y-auto bg-[#0a0a0a] p-8 text-zinc-100">
            <div className="mx-auto max-w-2xl space-y-8">
              <div className="flex items-center gap-6">
                <img src={profile?.photoURL || ''} alt="" className="h-24 w-24 rounded-3xl bg-zinc-800 object-cover shadow-xl ring-1 ring-white/10" />
                <div>
                  <h2 className="text-3xl font-bold text-white">{profile?.displayName}</h2>
                  <p className="text-zinc-500">{profile?.email}</p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                      {isPro ? 'Pro Member' : 'Free Plan'}
                    </span>
                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-400">
                      ID: {profile?.uid.slice(0, 8)}...
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/50 p-6 shadow-sm backdrop-blur-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                    <Activity className="h-5 w-5 text-emerald-400" />
                    Health Metrics
                  </h3>
                  <p className="mb-4 text-sm text-zinc-500">
                    Height, weight, and age are used to calculate BMI and are sent to Dr. HealthBuddy (in your system prompt) for safer, more personalized answers.
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="text-xs font-bold text-zinc-500">Height (cm)</span>
                        <input
                          type="number"
                          min={50}
                          max={260}
                          value={metricDraft.height}
                          onChange={(e) => setMetricDraft((d) => ({ ...d, height: e.target.value }))}
                          className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-3 py-2 text-white"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-bold text-zinc-500">Weight (kg)</span>
                        <input
                          type="number"
                          min={20}
                          max={400}
                          step={0.1}
                          value={metricDraft.weight}
                          onChange={(e) => setMetricDraft((d) => ({ ...d, weight: e.target.value }))}
                          className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-3 py-2 text-white"
                        />
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-xs font-bold text-zinc-500">Age (years)</span>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={metricDraft.age}
                        onChange={(e) => setMetricDraft((d) => ({ ...d, age: e.target.value }))}
                        className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-3 py-2 text-white"
                      />
                    </label>
                    <div>
                      <span className="mb-2 block text-xs font-bold text-zinc-500">Gender</span>
                      <div className="flex gap-2">
                        {(['male', 'female', 'other'] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setMetricDraft((d) => ({ ...d, gender: g }))}
                            className={cn(
                              'flex-1 rounded-xl py-2 text-xs font-bold capitalize transition-all',
                              metricDraft.gender === g
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            )}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                    {profileBmiPreview ? (
                      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                        <p className="mb-1 text-xs font-bold uppercase text-emerald-400">Calculated BMI</p>
                        <p className="text-3xl font-black tabular-nums text-white">{profileBmiPreview.bmi}</p>
                        <p className="text-sm font-semibold text-zinc-300">{profileBmiPreview.category}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600">Enter height, weight, and age to see BMI.</p>
                    )}
                    <button
                      type="button"
                      disabled={!profileBmiPreview || metricsSaving}
                      onClick={handleSaveHealthMetrics}
                      className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 py-3 font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                    >
                      {metricsSaving ? 'Saving…' : 'Save to profile'}
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/50 p-6 shadow-sm backdrop-blur-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                    <Crown className="h-5 w-5 text-amber-500" />
                    Account Status
                  </h3>
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-500">
                      Your account is currently on the {isPro ? "Pro" : "Free"} plan. 
                      {isPro ? " You have access to all premium features including Agentic HealthBuddy and File Analysis." : " Upgrade to Pro to unlock advanced AI features."}
                    </p>
                    {!isPro && (
                      <button
                        onClick={() => navigate('/pricing')}
                        className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-100 dark:shadow-none hover:scale-[1.02] transition-all"
                      >
                        Upgrade Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeView === 'body-parts' ? (
          <div className="flex flex-1 flex-col bg-[#0a0a0a] p-6 text-zinc-100">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-white">Interactive Anatomy</h2>
                <p className="text-sm text-zinc-500">Explore the human body. Hover over organs to see detailed clinical data and statistics.</p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300">
                <Activity className="h-4 w-4" />
                Holographic Explorer
              </div>
            </div>
            
            <div className="flex-1 min-h-[600px]">
              <HumanBodyExplorer />
            </div>
          </div>
        ) : activeView === 'agentic' ? (
          <AgenticHealthBuddy />
        ) : null}
      </main>
    </div>
  );
}
