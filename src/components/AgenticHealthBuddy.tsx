import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  X, 
  Activity, 
  Brain, 
  Stethoscope, 
  ChevronRight, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Pill,
  Coffee,
  Salad,
  UserRound,
  MapPin,
  Phone,
  Star,
  ExternalLink,
  CreditCard
} from 'lucide-react';
import { cn } from '../lib/utils';
import { generateAgenticAnalysis, FileData } from '../services/ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Doctor {
  name: string;
  address: string;
  phone: string;
  rating: number;
  url: string;
}

interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
}

interface AnalysisResult {
  offTopic?: boolean;
  message?: string;
  symptomAnalysis?: TableData;
  medicationAdvice?: TableData;
  dietLifestyle?: TableData;
  doctorRecommendations?: TableData;
  nearbyDoctors?: Doctor[];
}

const DynamicTable = ({ data, delay = 0 }: { data: TableData; delay?: number }) => {
  if (!data || !data.headers || !data.rows) return null;
  
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-zinc-950/50">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-400">
          <tr>
            {data.headers.map((header, i) => (
              <th key={i} className="border-b border-white/[0.06] px-4 py-3 font-black">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {data.rows.map((row, rowIndex) => (
            <motion.tr 
              key={rowIndex}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + (rowIndex * 0.1) }}
              className="transition-colors hover:bg-white/[0.04]"
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-zinc-300">
                  {cell.startsWith('http') ? (
                    <a 
                      href={cell} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold"
                    >
                      Link <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : cell}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const AgenticHealthBuddy = () => {
  const [step, setStep] = useState<'welcome' | 'input' | 'analyzing' | 'result'>('welcome');
  const [symptoms, setSymptoms] = useState('');
  const [files, setFiles] = useState<{ file: File; preview: string; base64: string }[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const newFiles = await Promise.all(
      selectedFiles.map(async (file) => {
        const base64 = await fileToBase64(file);
        const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
        return { file, preview, base64: base64.split(',')[1] };
      })
    );

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const runAnalysis = async () => {
    if (!symptoms.trim() && files.length === 0) {
      setError("Please provide symptoms or upload a report for analysis.");
      return;
    }

    setError(null);
    setStep('analyzing');

    // Try to get location
    let currentLoc = location;
    if (!currentLoc && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        currentLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(currentLoc);
      } catch (err) {
        console.warn("Location access denied or timed out", err);
      }
    }

    try {
      const fileData: FileData | undefined = files.length > 0 ? {
        mimeType: files[0].file.type,
        data: files[0].base64
      } : undefined;

      const prompt = `
        AGENTIC ANALYSIS REQUEST:
        
        SYMPTOMS PROVIDED:
        ${symptoms}
        
        ATTACHED FILES: ${files.length > 0 ? 'Yes (Clinical Report/Image)' : 'No'}
        
        Please perform a deep clinical analysis using all 5 specialized agents.
      `;

      const result = await generateAgenticAnalysis(prompt, currentLoc, fileData);
      setAnalysisResult(result);
      setStep('result');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during analysis. Please try again.");
      setStep('input');
    }
  };

  return (
    <div className="dash-main-bg flex h-full min-h-0 w-full flex-col items-center justify-center overflow-y-auto p-4 text-zinc-100 lg:p-8">
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div 
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl w-full text-center space-y-8"
          >
            <div className="relative inline-block">
              <div className="rounded-[40px] bg-blue-600 p-8 shadow-2xl shadow-blue-900/40">
                <Sparkles className="h-16 w-16 animate-pulse text-white" />
              </div>
              <div className="absolute -right-2 -top-2 rounded-full border-4 border-zinc-950 bg-amber-500 p-2">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-4xl font-black tracking-tight text-white lg:text-5xl">
                Agentic HealthBuddy
              </h2>
              <p className="mx-auto max-w-lg text-lg font-medium text-zinc-400">
                Our most advanced autonomous diagnostic agent. Powered by clinical-grade AI to analyze symptoms and medical reports with extreme precision.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              {[
                { icon: Brain, title: "Deep Reasoning", desc: "Multi-step clinical logic" },
                { icon: FileText, title: "Report Analysis", desc: "X-rays, ECGs, Lab results" },
                { icon: Stethoscope, title: "Symptom Mapping", desc: "Advanced differential mapping" },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-4 backdrop-blur-sm"
                >
                  <feature.icon className="mb-2 h-6 w-6 text-blue-400" />
                  <h4 className="text-sm font-bold text-white">{feature.title}</h4>
                  <p className="text-xs text-zinc-500">{feature.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('input')}
              className="group flex items-center gap-3 rounded-2xl bg-blue-600 px-8 py-4 font-bold text-white shadow-xl shadow-blue-900/30 transition-all hover:bg-blue-700 active:scale-95"
            >
              Start New Analysis
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}

        {step === 'input' && (
          <motion.div 
            key="input"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-3xl overflow-hidden rounded-[2.5rem] border border-white/[0.08] bg-zinc-900/70 shadow-2xl backdrop-blur-xl"
          >
            <div className="p-6 lg:p-10 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white">
                    <Sparkles className="h-6 w-6 text-blue-400" />
                    Clinical Analysis
                  </h3>
                  <p className="text-sm text-zinc-400">Describe your symptoms and upload any relevant medical documents.</p>
                </div>
                <button 
                  onClick={() => setStep('welcome')}
                  className="p-2 text-zinc-500 transition-colors hover:text-zinc-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="px-1 text-xs font-black uppercase tracking-widest text-zinc-500">Symptoms & Observations</label>
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="e.g., Sharp pain in lower abdomen for 2 days, worse after eating. No fever..."
                    className="h-40 w-full resize-none rounded-3xl border border-white/[0.08] bg-zinc-950/60 p-5 text-white outline-none transition-all placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <div className="space-y-3">
                  <label className="px-1 text-xs font-black uppercase tracking-widest text-zinc-500">Medical Reports / Images</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group cursor-pointer rounded-3xl border-2 border-dashed border-white/[0.1] p-8 text-center transition-all hover:border-blue-500/60 hover:bg-blue-500/5"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      multiple 
                      accept="image/*,application/pdf"
                    />
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 transition-transform group-hover:scale-110">
                      <Upload className="h-6 w-6 text-blue-400" />
                    </div>
                    <p className="text-sm font-bold text-white">Click to upload or drag and drop</p>
                    <p className="mt-1 text-xs text-zinc-500">X-rays, ECGs, MRI, Blood Reports (Images or PDF)</p>
                  </div>

                  {files.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      {files.map((file, i) => (
                        <div key={i} className="group relative aspect-square overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950/50">
                          {file.preview ? (
                            <img src={file.preview} alt="preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-2">
                              <FileText className="mb-1 h-8 w-8 text-blue-400" />
                              <span className="w-full truncate text-center text-[10px] font-bold text-zinc-400">{file.file.name}</span>
                            </div>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/25 bg-red-950/40 p-4 text-red-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('welcome')}
                  className="flex-1 rounded-2xl border border-white/[0.1] py-4 px-6 font-bold text-zinc-300 transition-all hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  onClick={runAnalysis}
                  className="flex flex-[2] items-center justify-center gap-3 rounded-2xl bg-blue-600 py-4 px-6 font-bold text-white shadow-lg shadow-blue-900/25 transition-all hover:bg-blue-700 active:scale-95"
                >
                  Run Analysis
                  <Activity className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'analyzing' && (
          <motion.div 
            key="analyzing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-md w-full text-center space-y-12"
          >
            <div className="relative">
              <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border-4 border-blue-500/20">
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.1, 1],
                    borderColor: ['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.5)', 'rgba(59, 130, 246, 0.2)']
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent"
                />
                <Brain className="h-16 w-16 animate-pulse text-blue-400" />
              </div>
              <motion.div 
                animate={{ 
                  scale: [1, 1.5, 1], 
                  opacity: [0.1, 0.3, 0.1],
                  rotate: [0, 180, 360]
                }}
                transition={{ duration: 10, repeat: Infinity }}
                className="absolute inset-0 bg-blue-400/20 rounded-full blur-3xl"
              />
            </div>
            
            <div className="space-y-4">
              <h3 className="text-3xl font-black tracking-tight text-white">
                Orchestrating Agents
              </h3>
              <p className="font-medium text-zinc-400">
                Dr. HealthBuddy is coordinating specialized medical agents to build your report.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              {[
                { text: "Symptom Analysis", icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10" },
                { text: "Medication Logic", icon: Pill, color: "text-rose-500", bg: "bg-rose-500/10" },
                { text: "Dietary Planning", icon: Salad, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { text: "Doctor Referral", icon: Stethoscope, color: "text-amber-500", bg: "bg-amber-500/10" },
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.5 }}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] p-4',
                    item.bg
                  )}
                >
                  <item.icon className={cn("w-6 h-6", item.color)} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {item.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'result' && analysisResult && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl w-full space-y-6 pb-12"
          >
            <div className="overflow-hidden rounded-[2.5rem] border border-white/[0.08] bg-zinc-900/70 shadow-2xl backdrop-blur-xl">
              <div className="space-y-8 p-6 lg:p-10">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-2xl bg-emerald-500/15 p-3">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight text-white">
                        {analysisResult.offTopic ? "Health-only assistant" : "Multi-Agent Health Report"}
                      </h3>
                      <p className="text-sm text-zinc-400">
                        {analysisResult.offTopic
                          ? "Dr. HealthBuddy answers health-related questions only"
                          : "Comprehensive analysis from 5 specialized clinical agents"}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setStep('welcome');
                      setSymptoms('');
                      setFiles([]);
                      setAnalysisResult(null);
                    }}
                    className="rounded-2xl bg-zinc-800 px-6 py-3 font-bold text-zinc-200 transition-all hover:bg-zinc-700"
                  >
                    New Analysis
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar space-y-8">
                  {analysisResult.offTopic && analysisResult.message ? (
                    <div className="rounded-3xl border border-amber-500/25 bg-amber-950/35 p-6">
                      <div className="mb-3 flex items-start gap-3">
                        <AlertCircle className="h-6 w-6 flex-shrink-0 text-amber-400" />
                        <p className="text-sm font-bold text-amber-200">Not a general chat</p>
                      </div>
                      <div className="prose prose-sm prose-invert max-w-none text-zinc-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisResult.message}</ReactMarkdown>
                      </div>
                    </div>
                  ) : null}

                  {!analysisResult.offTopic ? (
                  <>
                  <div className="grid grid-cols-1 gap-8">
                    {/* Symptom Analysis */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="rounded-3xl border border-white/[0.08] bg-zinc-950/70 p-6 shadow-xl"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-500/20 p-2 rounded-xl border border-blue-500/30">
                            <Stethoscope className="w-5 h-5 text-blue-400" />
                          </div>
                          <h4 className="font-bold text-white text-lg tracking-tight">Symptom Analysis</h4>
                        </div>
                        <div className="bg-blue-500 text-[10px] font-black px-3 py-1 rounded-full text-white tracking-widest uppercase">
                          TRIAGE
                        </div>
                      </div>
                      <DynamicTable data={analysisResult.symptomAnalysis!} delay={0.2} />
                    </motion.div>

                    {/* Medication Advice */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="rounded-3xl border border-white/[0.08] bg-zinc-950/70 p-6 shadow-xl"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="bg-rose-500/20 p-2 rounded-xl border border-rose-500/30">
                            <Pill className="w-5 h-5 text-rose-400" />
                          </div>
                          <h4 className="font-bold text-white text-lg tracking-tight">Medication Advice</h4>
                        </div>
                        <div className="bg-cyan-500 text-[10px] font-black px-3 py-1 rounded-full text-white tracking-widest uppercase">
                          PHARMA
                        </div>
                      </div>
                      <DynamicTable data={analysisResult.medicationAdvice!} delay={0.3} />
                    </motion.div>

                    {/* Diet & Lifestyle */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="rounded-3xl border border-white/[0.08] bg-zinc-950/70 p-6 shadow-xl"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30">
                            <Salad className="w-5 h-5 text-emerald-400" />
                          </div>
                          <h4 className="font-bold text-white text-lg tracking-tight">Diet & Lifestyle</h4>
                        </div>
                        <div className="bg-emerald-500 text-[10px] font-black px-3 py-1 rounded-full text-white tracking-widest uppercase">
                          WELLNESS
                        </div>
                      </div>
                      <DynamicTable data={analysisResult.dietLifestyle!} delay={0.4} />
                    </motion.div>

                    {/* Doctor Recommendations */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="rounded-3xl border border-white/[0.08] bg-zinc-950/70 p-6 shadow-xl"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="bg-amber-500/20 p-2 rounded-xl border border-amber-500/30">
                            <Stethoscope className="w-5 h-5 text-amber-400" />
                          </div>
                          <h4 className="font-bold text-white text-lg tracking-tight">Doctor Referral</h4>
                        </div>
                        <div className="bg-amber-500 text-[10px] font-black px-3 py-1 rounded-full text-white tracking-widest uppercase">
                          REFERRAL
                        </div>
                      </div>
                      <DynamicTable data={analysisResult.doctorRecommendations!} delay={0.5} />
                    </motion.div>
                  </div>

                  {/* Nearby Doctors List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                    {analysisResult.nearbyDoctors!.map((doc, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + (i * 0.1) }}
                      className="group rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-4 shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="bg-blue-500/20 p-2 rounded-xl border border-blue-500/30">
                          <UserRound className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                          <Star className="w-3 h-3 text-amber-500 fill-current" />
                          <span className="text-[10px] font-bold text-amber-500">{doc.rating}</span>
                        </div>
                      </div>
                      <h5 className="font-bold text-white text-sm mb-2 line-clamp-1">{doc.name}</h5>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-start gap-2 text-[10px] text-zinc-400">
                          <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{doc.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <span>{doc.phone}</span>
                        </div>
                      </div>
                      <a 
                        href={doc.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 py-2 text-[10px] font-bold text-blue-400 transition-all hover:bg-blue-600 hover:text-white"
                      >
                        View Profile
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </motion.div>
                  ))}
                </div>
                  </>
                  ) : null}
              </div>

                {!analysisResult.offTopic ? (
                <div className="rounded-3xl border border-amber-500/20 bg-amber-950/25 p-6">
                  <div className="flex gap-4">
                    <AlertCircle className="h-6 w-6 flex-shrink-0 text-amber-400" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-amber-300">Medical Disclaimer</h4>
                      <p className="text-xs leading-relaxed text-amber-200/75">
                        This analysis is generated by an AI agent and is for informational purposes only. It does not constitute a formal medical diagnosis or professional medical advice. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
                      </p>
                    </div>
                  </div>
                </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
