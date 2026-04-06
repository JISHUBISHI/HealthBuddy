import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface OrganStat {
  label: string;
  val: string;
}

interface OrganData {
  name: string;
  system: string;
  color: string;
  desc: string;
  stats: OrganStat[];
}

const ORGAN_DATA: Record<string, OrganData> = {
  brain: {
    name: "Brain",
    system: "Nervous System",
    color: "#4cc9f0",
    desc: "The brain is the command center of the human body — a 3-pound marvel of around 86 billion neurons. It controls thought, memory, emotion, vision, breathing, motor skills and every bodily process.",
    stats: [
      { label: "Weight", val: "~1.4 kg" },
      { label: "Neurons", val: "86 Billion" },
      { label: "Power Use", val: "20 watts" },
      { label: "Blood Flow", val: "750 ml/min" }
    ]
  },
  heart: {
    name: "Heart",
    system: "Cardiovascular System",
    color: "#ff4d6d",
    desc: "The heart is a muscular pump roughly the size of a fist, beating 60–100 times per minute. It circulates about 5 liters of blood per minute through 100,000 km of blood vessels.",
    stats: [
      { label: "Beats/Day", val: "100,000+" },
      { label: "Chambers", val: "4" },
      { label: "Output", val: "5 L/min" },
      { label: "Lifespan", val: "2–3B beats" }
    ]
  },
  lungs: {
    name: "Lungs",
    system: "Respiratory System",
    color: "#ffd166",
    desc: "The two lungs together contain about 480 million tiny air sacs called alveoli, providing a surface area of ~70 m² for gas exchange — roughly the size of a tennis court.",
    stats: [
      { label: "Surface Area", val: "70 m²" },
      { label: "Alveoli", val: "480 Million" },
      { label: "Breaths/Day", val: "~23,000" },
      { label: "Air Capacity", val: "6 liters" }
    ]
  },
  trachea: {
    name: "Trachea & Bronchi",
    system: "Respiratory System",
    color: "#ffd166",
    desc: "The trachea (windpipe) is a 10–15 cm tube reinforced by C-shaped cartilage rings that keeps it open. It splits into the left and right bronchi, delivering air deep into the lungs.",
    stats: [
      { label: "Length", val: "10-15 cm" },
      { label: "Diameter", val: "~2 cm" },
      { label: "Rings", val: "18-22" },
      { label: "Branches", val: "2 primary" }
    ]
  },
  thyroid: {
    name: "Thyroid Gland",
    system: "Endocrine System",
    color: "#a78bfa",
    desc: "The butterfly-shaped thyroid gland in the neck produces hormones — T3 and T4 — that regulate metabolism, energy production, heart rate, body temperature, and growth.",
    stats: [
      { label: "Weight", val: "25–30 g" },
      { label: "Hormones", val: "T3, T4" },
      { label: "Location", val: "Neck" },
      { label: "Shape", val: "Butterfly" }
    ]
  },
  aorta: {
    name: "Aorta & Vessels",
    system: "Cardiovascular System",
    color: "#ff4d6d",
    desc: "The aorta is the largest artery, carrying oxygenated blood from the heart to the rest of the body. Together, all blood vessels stretch approximately 100,000 km.",
    stats: [
      { label: "Aorta Dia.", val: "~2.5 cm" },
      { label: "Total Length", val: "100,000 km" },
      { label: "Pressure", val: "120/80" },
      { label: "Vessel Count", val: "Billions" }
    ]
  },
  diaphragm: {
    name: "Diaphragm",
    system: "Respiratory System",
    color: "#4cc9f0",
    desc: "The diaphragm is a dome-shaped sheet of muscle separating the chest from the abdomen. It is the primary muscle of breathing, contracting to expand lung volume.",
    stats: [
      { label: "Type", val: "Skeletal" },
      { label: "Thickness", val: "3–5 mm" },
      { label: "Contractions", val: "~23k/day" },
      { label: "Location", val: "T8–L3" }
    ]
  },
  liver: {
    name: "Liver",
    system: "Digestive / Metabolic",
    color: "#c4733a",
    desc: "The liver is the largest internal organ, performing over 500 vital functions. It filters blood, detoxifies chemicals, produces bile, and metabolizes nutrients.",
    stats: [
      { label: "Weight", val: "1.4–1.8 kg" },
      { label: "Functions", val: "500+" },
      { label: "Lobes", val: "4" },
      { label: "Blood Flow", val: "1.5 L/min" }
    ]
  },
  stomach: {
    name: "Stomach",
    system: "Digestive System",
    color: "#06d6a0",
    desc: "The J-shaped stomach mixes food with gastric acid and digestive enzymes to break down proteins. It can expand to hold about 1 to 4 liters of contents.",
    stats: [
      { label: "Capacity", val: "~1–4 liters" },
      { label: "Gastric pH", val: "1.5 – 3.5" },
      { label: "Acid Output", val: "2 L/day" },
      { label: "Digestion", val: "2–5 hours" }
    ]
  },
  intestines: {
    name: "Intestines",
    system: "Digestive System",
    color: "#06d6a0",
    desc: "The small intestine digests and absorbs most nutrients. The large intestine reabsorbs water and electrolytes and houses trillions of beneficial gut bacteria.",
    stats: [
      { label: "Small Int.", val: "6–7 m" },
      { label: "Large Int.", val: "1.5 m" },
      { label: "Surface Area", val: "~250 m²" },
      { label: "Bacteria", val: "38 trillion" }
    ]
  },
  kidneys: {
    name: "Kidneys",
    system: "Urinary System",
    color: "#34d399",
    desc: "The two bean-shaped kidneys filter about 200 liters of blood daily, producing 1–2 liters of urine. They regulate blood pressure and electrolyte balance.",
    stats: [
      { label: "Filtered", val: "200 L/day" },
      { label: "Urine", val: "1–2 L/day" },
      { label: "Nephrons", val: "~1 Million" },
      { label: "Size", val: "10–12 cm" }
    ]
  },
  bladder: {
    name: "Urinary Bladder",
    system: "Urinary System",
    color: "#34d399",
    desc: "The bladder is a hollow muscular organ that collects and stores urine. Its walls can stretch to hold up to 400–600 ml of urine before excretion.",
    stats: [
      { label: "Capacity", val: "400–600 ml" },
      { label: "Shape", val: "Pear" },
      { label: "Thickness", val: "3–5 mm" },
      { label: "Layers", val: "3-5" }
    ]
  },
  ribs: {
    name: "Ribs & Sternum",
    system: "Skeletal System",
    color: "#4cc9f0",
    desc: "The rib cage consists of 12 pairs of ribs forming a protective cage around the heart and lungs. The sternum anchors them anteriorly.",
    stats: [
      { label: "Rib Pairs", val: "12" },
      { label: "True Ribs", val: "7 pairs" },
      { label: "Floating", val: "2 pairs" },
      { label: "Sternum", val: "~15–17 cm" }
    ]
  },
  spine: {
    name: "Vertebral Column",
    system: "Skeletal / Nervous",
    color: "#4cc9f0",
    desc: "The spine is a stack of 33 vertebrae that supports the skull and upper body, protects the spinal cord, and enables movement with four natural curves.",
    stats: [
      { label: "Vertebrae", val: "26 (adult)" },
      { label: "Length", val: "~70 cm" },
      { label: "Regions", val: "5" },
      { label: "Discs", val: "23" }
    ]
  },
  pelvis: {
    name: "Pelvis",
    system: "Skeletal System",
    color: "#4cc9f0",
    desc: "The pelvis is a basin-shaped ring of bones at the base of the spine. It supports the weight of the upper body and protects abdominal and pelvic organs.",
    stats: [
      { label: "Bones", val: "3 fused" },
      { label: "Joints", val: "Sacroiliac" },
      { label: "Width", val: "~25–30 cm" },
      { label: "Function", val: "Support" }
    ]
  },
  muscles: {
    name: "Arms & Muscles",
    system: "Muscular System",
    color: "#fb923c",
    desc: "The human body has over 600 skeletal muscles. Arm muscles include biceps and triceps for movement, converting chemical energy into mechanical force.",
    stats: [
      { label: "Total", val: "600+" },
      { label: "Arm Muscles", val: "~30" },
      { label: "Bicep Force", val: "400 N" },
      { label: "Mass %", val: "~40%" }
    ]
  },
  legs: {
    name: "Legs & Limbs",
    system: "Muscular / Skeletal",
    color: "#fb923c",
    desc: "The legs contain the largest muscles and the longest bone (femur). They support full body weight and enable complex movement and balance.",
    stats: [
      { label: "Femur", val: "~45 cm" },
      { label: "Largest", val: "Quadriceps" },
      { label: "Bones", val: "30 per leg" },
      { label: "Knee Load", val: "4-5x weight" }
    ]
  }
};

export const HumanBodyExplorer = () => {
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);

  const organ = selectedOrgan ? ORGAN_DATA[selectedOrgan] : null;

  return (
    <div className="relative flex h-full w-full flex-col gap-8 overflow-hidden rounded-[2.5rem] border border-white/[0.08] bg-zinc-950/90 p-6 text-zinc-100 shadow-2xl lg:flex-row">
      {/* Background Grid — subtle on near-black */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(rgb(52 211 153 / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(52 211 153 / 0.25) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Left: Info Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-6 z-10">
        <div className="relative min-h-[360px] overflow-hidden rounded-3xl border border-white/[0.1] bg-zinc-900/75 p-6 backdrop-blur-xl">
          <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
          
          <AnimatePresence mode="wait">
            {!organ ? (
              <motion.div 
                key="default"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center gap-6"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-400/50 animate-pulse">
                  <div className="h-8 w-8 animate-ping rounded-full border-2 border-emerald-400" />
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-300">
                  Hover over any body part to explore
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedOrgan}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h3 className="font-black text-2xl tracking-tighter uppercase" style={{ color: organ.color }}>{organ.name}</h3>
                <span className="inline-block px-3 py-1 rounded-full border text-[10px] font-bold tracking-widest uppercase" 
                      style={{ borderColor: `${organ.color}55`, color: organ.color }}>
                  {organ.system}
                </span>
                <p className="text-sm font-medium leading-relaxed text-zinc-300">{organ.desc}</p>
                
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {organ.stats.map((stat, i) => (
                    <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{stat.label}</p>
                      <p className="text-sm font-bold mt-1" style={{ color: organ.color }}>{stat.val}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Legend */}
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-4">
          <h4 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Body Systems</h4>
          <div className="grid grid-cols-2 gap-y-2">
            {[
              { color: '#ff4d6d', label: 'Cardio' },
              { color: '#ffd166', label: 'Resp' },
              { color: '#06d6a0', label: 'Digest' },
              { color: '#4cc9f0', label: 'Nervous' },
              { color: '#a78bfa', label: 'Endo' },
              { color: '#fb923c', label: 'Muscular' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] font-bold uppercase text-zinc-400">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center: SVG Body */}
      <div className="flex-1 flex items-center justify-center z-10 relative min-h-[500px]">
        <div className="w-full max-w-[400px] relative group">
          {/* Scanline Effect */}
          <div
            className="pointer-events-none absolute inset-0 z-20 opacity-[0.06]"
            style={{
              background:
                'repeating-linear-gradient(0deg, transparent, transparent 3px, rgb(24 24 27) 3px, rgb(24 24 27) 4px)',
            }}
          />
          
          <svg
            viewBox="0 0 320 800"
            xmlns="http://www.w3.org/2000/svg"
            className="h-auto w-full drop-shadow-[0_0_40px_rgba(52,211,153,0.18)]"
          >
            <defs>
              <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1a3a5c"/>
                <stop offset="50%" stopColor="#0d2840"/>
                <stop offset="100%" stopColor="#1a3a5c"/>
              </linearGradient>
              <linearGradient id="skinGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0d2840"/>
                <stop offset="100%" stopColor="#081a2e"/>
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glowStrong">
                <feGaussianBlur stdDeviation="6" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Body Silhouette */}
            <g className="opacity-[0.58]">
              <ellipse cx="160" cy="52" rx="46" ry="52" fill="url(#skinGrad)" stroke="rgba(52,211,153,0.35)" strokeWidth="1"/>
              <path d="M115 126 Q100 140 98 200 Q96 260 100 300 Q105 330 110 340 L210 340 Q215 330 220 300 Q224 260 222 200 Q220 140 205 126 Z"
                    fill="url(#skinGrad2)" stroke="rgba(52,211,153,0.3)" strokeWidth="1"/>
              
              {/* Collar bones */}
              <path d="M145 125 Q130 130 115 128" fill="none" stroke="rgba(110,200,180,0.55)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M175 125 Q190 130 205 128" fill="none" stroke="rgba(110,200,180,0.55)" strokeWidth="1.5" strokeLinecap="round"/>
            </g>

            {/* Corner markers */}
            <g stroke="rgba(52,211,153,0.45)" strokeWidth="1.5" fill="none">
              <path d="M86 118 L86 124 L92 124"/>
              <path d="M234 118 L234 124 L228 124"/>
              <path d="M86 352 L86 346 L92 346"/>
              <path d="M234 352 L234 346 L228 346"/>
            </g>

            {/* Interactive Parts */}
            <g className="cursor-pointer">
              {/* Brain */}
              <g onMouseEnter={() => setSelectedOrgan('brain')} className="transition-all duration-300">
                <ellipse cx="160" cy="44" rx="34" ry="30" 
                         fill={selectedOrgan === 'brain' ? 'rgba(76,201,240,0.4)' : 'rgba(76,201,240,0.15)'} 
                         stroke="#4cc9f0" strokeWidth={selectedOrgan === 'brain' ? 2 : 1}
                         className="transition-all" />
                <path d="M140 40 Q155 30 165 38 Q175 28 185 40" fill="none" stroke="rgba(76,201,240,0.4)" strokeWidth="1" strokeLinecap="round"/>
                <path d="M138 50 Q152 42 162 48 Q172 40 186 50" fill="none" stroke="rgba(76,201,240,0.4)" strokeWidth="1" strokeLinecap="round"/>
                <path d="M142 58 Q156 52 166 56 Q176 50 184 58" fill="none" stroke="rgba(76,201,240,0.35)" strokeWidth="1" strokeLinecap="round"/>
                <line x1="160" y1="20" x2="160" y2="70" stroke="rgba(76,201,240,0.5)" strokeWidth="0.8"/>
              </g>

              {/* Lungs */}
              <g onMouseEnter={() => setSelectedOrgan('lungs')} className="transition-all">
                <path d="M126 138 Q110 150 108 185 Q107 210 112 225 Q118 235 130 230 Q138 225 140 205 Q142 180 138 155 Z"
                      fill={selectedOrgan === 'lungs' ? 'rgba(255,209,102,0.4)' : 'rgba(255,209,102,0.15)'} 
                      stroke="#ffd166" strokeWidth={selectedOrgan === 'lungs' ? 2 : 1}/>
                <path d="M194 138 Q210 150 212 185 Q213 210 208 225 Q202 235 190 230 Q182 225 180 205 Q178 180 182 155 Z"
                      fill={selectedOrgan === 'lungs' ? 'rgba(255,209,102,0.4)' : 'rgba(255,209,102,0.15)'} 
                      stroke="#ffd166" strokeWidth={selectedOrgan === 'lungs' ? 2 : 1}/>
              </g>

              {/* Heart */}
              <g onMouseEnter={() => setSelectedOrgan('heart')} className="transition-all">
                <path d="M160 145 Q148 138 140 148 Q134 158 140 168 L160 188 L180 168 Q186 158 180 148 Q172 138 160 145Z"
                      fill={selectedOrgan === 'heart' ? 'rgba(255,77,109,0.5)' : 'rgba(255,77,109,0.25)'} 
                      stroke="#ff4d6d" strokeWidth={selectedOrgan === 'heart' ? 2.5 : 1.5}/>
                <path d="M160 145 L160 132 Q162 128 168 128 Q175 128 175 135" fill="none" stroke="#ff4d6d" strokeWidth="1.5"/>
              </g>

              {/* Trachea */}
              <g onMouseEnter={() => setSelectedOrgan('trachea')} className="transition-all">
                <rect x="155" y="100" width="10" height="38" rx="5" 
                      fill={selectedOrgan === 'trachea' ? 'rgba(255,209,102,0.4)' : 'rgba(255,209,102,0.15)'} 
                      stroke="#ffd166" strokeWidth="1.2"/>
                <path d="M157 138 Q148 145 128 148" fill="none" stroke="rgba(255,209,102,0.6)" strokeWidth="2" strokeLinecap="round"/>
                <path d="M163 138 Q172 145 192 148" fill="none" stroke="rgba(255,209,102,0.6)" strokeWidth="2" strokeLinecap="round"/>
              </g>

              {/* Thyroid */}
              <g onMouseEnter={() => setSelectedOrgan('thyroid')} className="transition-all">
                <ellipse cx="153" cy="108" rx="8" ry="6" 
                         fill={selectedOrgan === 'thyroid' ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.3)'} 
                         stroke="#a78bfa" strokeWidth="1.2"/>
                <ellipse cx="167" cy="108" rx="8" ry="6" 
                         fill={selectedOrgan === 'thyroid' ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.3)'} 
                         stroke="#a78bfa" strokeWidth="1.2"/>
                <path d="M161 108 L159 108" fill="none" stroke="#a78bfa" strokeWidth="1"/>
              </g>

              {/* Aorta */}
              <g onMouseEnter={() => setSelectedOrgan('aorta')} className="transition-all">
                <path d="M160 132 Q160 190 158 220 Q156 250 157 330" fill="none" 
                      stroke={selectedOrgan === 'aorta' ? 'rgba(255,77,109,1)' : 'rgba(255,77,109,0.6)'} 
                      strokeWidth="3" strokeLinecap="round"/>
                <path d="M158 220 Q140 230 120 228" fill="none" stroke="rgba(255,77,109,0.4)" strokeWidth="1.5"/>
                <path d="M158 220 Q176 230 196 228" fill="none" stroke="rgba(255,77,109,0.4)" strokeWidth="1.5"/>
              </g>

              {/* Diaphragm */}
              <g onMouseEnter={() => setSelectedOrgan('diaphragm')} className="transition-all">
                <path d="M108 226 Q135 218 160 222 Q185 218 212 226 Q200 238 160 234 Q120 238 108 226Z"
                      fill={selectedOrgan === 'diaphragm' ? 'rgba(100,180,255,0.3)' : 'rgba(100,180,255,0.12)'} 
                      stroke="rgba(100,180,255,0.5)" strokeWidth="1.2"/>
              </g>

              {/* Stomach */}
              <g onMouseEnter={() => setSelectedOrgan('stomach')} className="transition-all">
                <path d="M148 228 Q138 230 135 240 Q132 252 136 262 Q140 272 152 274 Q162 275 168 265 Q175 255 173 242 Q170 230 160 227 Z"
                      fill={selectedOrgan === 'stomach' ? 'rgba(6,214,160,0.4)' : 'rgba(6,214,160,0.15)'} 
                      stroke="#06d6a0" strokeWidth={selectedOrgan === 'stomach' ? 2 : 1}/>
              </g>

              {/* Liver */}
              <g onMouseEnter={() => setSelectedOrgan('liver')} className="transition-all">
                <path d="M165 230 Q182 228 192 238 Q200 248 198 260 Q195 268 185 270 Q174 268 168 258 Q163 248 165 236 Z"
                      fill={selectedOrgan === 'liver' ? 'rgba(180,100,50,0.5)' : 'rgba(180,100,50,0.2)'} 
                      stroke="#c4733a" strokeWidth={selectedOrgan === 'liver' ? 2 : 1}/>
              </g>

              {/* Kidneys */}
              <g onMouseEnter={() => setSelectedOrgan('kidneys')} className="transition-all">
                <ellipse cx="128" cy="275" rx="14" ry="20" 
                         fill={selectedOrgan === 'kidneys' ? 'rgba(52,211,153,0.4)' : 'rgba(52,211,153,0.15)'} 
                         stroke="#34d399" strokeWidth={selectedOrgan === 'kidneys' ? 2 : 1}/>
                <ellipse cx="192" cy="275" rx="14" ry="20" 
                         fill={selectedOrgan === 'kidneys' ? 'rgba(52,211,153,0.4)' : 'rgba(52,211,153,0.15)'} 
                         stroke="#34d399" strokeWidth={selectedOrgan === 'kidneys' ? 2 : 1}/>
              </g>

              {/* Intestines */}
              <g onMouseEnter={() => setSelectedOrgan('intestines')} className="transition-all">
                <path d="M130 290 Q145 285 155 295 Q165 305 152 312 Q140 318 130 310 Q120 302 128 294"
                      fill={selectedOrgan === 'intestines' ? 'rgba(6,214,160,0.3)' : 'rgba(6,214,160,0.1)'} 
                      stroke="#06d6a0" strokeWidth={selectedOrgan === 'intestines' ? 2 : 1}/>
                <path d="M128 310 Q140 322 155 316 Q168 324 176 318 Q185 325 178 333 Q168 340 155 336 Q140 340 128 332 Q118 325 125 316"
                      fill={selectedOrgan === 'intestines' ? 'rgba(6,214,160,0.2)' : 'rgba(6,214,160,0.05)'} 
                      stroke="rgba(6,214,160,0.7)" strokeWidth="1"/>
              </g>

              {/* Bladder */}
              <g onMouseEnter={() => setSelectedOrgan('bladder')} className="transition-all">
                <ellipse cx="160" cy="342" rx="22" ry="16" 
                         fill={selectedOrgan === 'bladder' ? 'rgba(52,211,153,0.4)' : 'rgba(52,211,153,0.2)'} 
                         stroke="#34d399" strokeWidth="1.5"/>
              </g>

              {/* Ribs */}
              <g onMouseEnter={() => setSelectedOrgan('ribs')} className="transition-all">
                <path d="M142 143 Q120 150 115 160" fill="none" stroke="rgba(100,180,255,0.6)" strokeWidth="2" strokeLinecap="round"/>
                <path d="M178 143 Q200 150 205 160" fill="none" stroke="rgba(100,180,255,0.6)" strokeWidth="2" strokeLinecap="round"/>
                <line x1="157" y1="132" x2="157" y2="225" stroke="rgba(100,180,255,0.6)" strokeWidth="3" strokeLinecap="round"/>
              </g>

              {/* Spine */}
              <g onMouseEnter={() => setSelectedOrgan('spine')} className="transition-all">
                <g fill={selectedOrgan === 'spine' ? 'rgba(100,180,255,0.4)' : 'rgba(100,180,255,0.2)'} 
                   stroke="rgba(100,180,255,0.5)" strokeWidth="0.8">
                  <rect x="153" y="128" width="14" height="7" rx="2" />
                  <rect x="153" y="138" width="14" height="7" rx="2" />
                  <rect x="153" y="148" width="14" height="7" rx="2" />
                  <rect x="153" y="230" width="14" height="7" rx="2" />
                  <rect x="153" y="240" width="14" height="7" rx="2" />
                  <rect x="153" y="250" width="14" height="7" rx="2" />
                  <rect x="153" y="260" width="14" height="7" rx="2" />
                  <rect x="153" y="270" width="14" height="7" rx="2" />
                  <rect x="153" y="280" width="14" height="7" rx="2" />
                  <rect x="153" y="290" width="14" height="7" rx="2" />
                  <rect x="153" y="300" width="14" height="7" rx="2" />
                  <rect x="153" y="310" width="14" height="7" rx="2" />
                </g>
              </g>

              {/* Pelvis */}
              <g onMouseEnter={() => setSelectedOrgan('pelvis')} className="transition-all">
                <path d="M116 340 Q102 348 100 362 Q102 374 116 378 L144 378 L144 355 Q136 348 126 345 Z"
                      fill={selectedOrgan === 'pelvis' ? 'rgba(100,180,255,0.3)' : 'rgba(100,180,255,0.15)'} 
                      stroke="rgba(100,180,255,0.4)" strokeWidth="1.2"/>
                <path d="M204 340 Q218 348 220 362 Q218 374 204 378 L176 378 L176 355 Q184 348 194 345 Z"
                      fill={selectedOrgan === 'pelvis' ? 'rgba(100,180,255,0.3)' : 'rgba(100,180,255,0.15)'} 
                      stroke="rgba(100,180,255,0.4)" strokeWidth="1.2"/>
              </g>

              {/* Muscles */}
              <g onMouseEnter={() => setSelectedOrgan('muscles')} className="transition-all">
                <path d="M112 130 Q92 140 82 175 Q78 195 80 220 Q83 235 90 238 Q100 240 108 230 Q118 215 120 190 Q122 160 116 135 Z"
                      fill={selectedOrgan === 'muscles' ? 'rgba(251,146,60,0.3)' : 'rgba(251,146,60,0.15)'} 
                      stroke="rgba(251,146,60,0.4)" strokeWidth="1"/>
                <path d="M208 130 Q228 140 238 175 Q242 195 240 220 Q237 235 230 238 Q220 240 212 230 Q202 215 200 190 Q198 160 204 135 Z"
                      fill={selectedOrgan === 'muscles' ? 'rgba(251,146,60,0.3)' : 'rgba(251,146,60,0.15)'} 
                      stroke="rgba(251,146,60,0.4)" strokeWidth="1"/>
              </g>

              {/* Legs */}
              <g onMouseEnter={() => setSelectedOrgan('legs')} className="transition-all">
                <path d="M118 380 Q104 395 102 440 Q100 480 104 510 Q108 525 120 526 Q132 526 136 510 Q142 480 140 440 Q138 400 132 382 Z"
                      fill={selectedOrgan === 'legs' ? 'rgba(251,146,60,0.3)' : 'rgba(251,146,60,0.13)'} 
                      stroke="rgba(251,146,60,0.35)" strokeWidth="1"/>
                <path d="M202 380 Q216 395 218 440 Q220 480 216 510 Q212 525 200 526 Q188 526 184 510 Q178 480 180 440 Q182 400 188 382 Z"
                      fill={selectedOrgan === 'legs' ? 'rgba(251,146,60,0.3)' : 'rgba(251,146,60,0.13)'} 
                      stroke="rgba(251,146,60,0.35)" strokeWidth="1"/>
              </g>
            </g>

            {/* Labels */}
            <g className="pointer-events-none font-mono text-[9px] uppercase tracking-widest fill-zinc-500">
              <text x="58" y="52">BRAIN</text>
              <text x="218" y="165">LUNGS</text>
              <text x="56" y="168">HEART</text>
              <text x="218" y="260">LIVER</text>
              <text x="54" y="248">STOMACH</text>
              <text x="218" y="282">KIDNEY</text>
            </g>
          </svg>
        </div>
      </div>

      {/* Right: Quick Nav */}
      <div className="w-full lg:w-48 flex flex-col gap-3 z-10">
        <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Quick Nav</h4>
        <div className="flex flex-wrap lg:flex-col gap-2 overflow-y-auto max-h-[600px] pr-2 scrollbar-hide">
          {Object.keys(ORGAN_DATA).map((key) => (
            <button
              key={key}
              onMouseEnter={() => setSelectedOrgan(key)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border text-left",
                selectedOrgan === key
                  ? 'translate-x-1 border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/[0.06] bg-zinc-900/40 text-zinc-500 hover:border-emerald-500/25 hover:bg-emerald-500/10 hover:text-zinc-300'
              )}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ORGAN_DATA[key].color }} />
              {ORGAN_DATA[key].name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
