import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  GitBranch, 
  Table, 
  Calculator, 
  FlaskConical, 
  Network, 
  Download, 
  RefreshCw,
  Info,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { generateVisual } from '../services/geminiService';

interface VisualGeneratorProps {
  projectId: string;
  initialTopic?: string;
}

export default function VisualGenerator({ projectId, initialTopic = '' }: VisualGeneratorProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [format, setFormat] = useState('infographic');
  const [isLoading, setIsLoading] = useState(false);
  const [visualData, setVisualData] = useState<any>(null);

  const formats = [
    { id: 'infographic', label: 'Infographic', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'flowchart', label: 'Flowchart', icon: GitBranch, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'comparison', label: 'Comparison', icon: Table, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { id: 'formula_card', label: 'Formula Card', icon: Calculator, color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'scientific_process', label: 'Scientific Process', icon: FlaskConical, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    { id: 'mindmap', label: 'Mind Map', icon: Network, color: 'text-violet-500', bg: 'bg-violet-50' },
  ];

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsLoading(true);
    try {
      const data = await generateVisual(topic);
      setVisualData(data);
    } catch (error) {
      console.error('Error generating visual:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialTopic) {
      handleGenerate();
    }
  }, []);

  return (
    <div className="space-y-8">
      {!visualData && (
        <div className="max-w-2xl mx-auto space-y-8 py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full text-sm font-bold uppercase tracking-widest">
              <Sparkles size={16} />
              Visual Learning Engine
            </div>
            <h2 className="text-4xl font-black tracking-tight">Transform Concepts into Visuals</h2>
            <p className="text-gray-500 text-lg">Enter a complex topic and choose a format to generate a structured visual aid.</p>
          </div>

          <div className="bg-white dark:bg-[#111111] p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-bold uppercase tracking-wider text-gray-400">What concept should we visualize?</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Photosynthesis, The Cold War, Binary Search"
                className="w-full bg-black/5 dark:bg-white/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold uppercase tracking-wider text-gray-400">Choose Format</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {formats.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all group",
                      format === f.id 
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" 
                        : "border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                    )}
                  >
                    <div className={cn("p-3 rounded-xl transition-all", f.bg, f.color, format === f.id && "scale-110")}>
                      <f.icon size={24} />
                    </div>
                    <span className={cn("text-xs font-bold", format === f.id ? "text-indigo-600" : "text-gray-500")}>
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading || !topic.trim()}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Zap size={20} />
                  Generate Visual Aid
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {visualData && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-3xl font-black tracking-tight">{visualData.title}</h3>
              <p className="text-gray-500">Visualized as a {format.replace('_', ' ')}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setVisualData(null)}
                className="p-3 bg-black/5 dark:bg-white/5 rounded-xl hover:bg-black/10 transition-all"
              >
                <RefreshCw size={20} />
              </button>
              <button className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
                <Download size={20} />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111111] p-10 rounded-[3rem] border border-black/5 dark:border-white/5 shadow-sm min-h-[500px]">
            {visualData.type === 'infographic' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {visualData.sections.map((section: any, i: number) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-8 rounded-[2rem] bg-gray-50 dark:bg-white/5 space-y-4 border border-black/5 dark:border-white/5"
                  >
                    <div className="w-12 h-12 bg-white dark:bg-black rounded-2xl flex items-center justify-center shadow-sm">
                      <Sparkles size={24} className="text-indigo-600" />
                    </div>
                    <h4 className="text-xl font-bold">{section.title}</h4>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{section.content}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {visualData.type === 'flowchart' && (
              <div className="max-w-xl mx-auto space-y-6">
                {visualData.steps.map((step: any, i: number) => (
                  <React.Fragment key={step.id}>
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-6 bg-white dark:bg-black rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/30 shadow-sm relative z-10"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                          {i + 1}
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-lg">{step.label}</h4>
                          <p className="text-sm text-gray-500">{step.description}</p>
                        </div>
                      </div>
                    </motion.div>
                    {i < visualData.steps.length - 1 && (
                      <div className="flex justify-center py-2">
                        <div className="w-1 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            {visualData.type === 'comparison' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="p-6 text-left text-sm font-bold uppercase tracking-wider text-gray-400 border-b border-black/5 dark:border-white/5">Feature</th>
                      {visualData.headers.map((header: string, i: number) => (
                        <th key={i} className="p-6 text-left text-sm font-bold uppercase tracking-wider text-indigo-600 border-b border-black/5 dark:border-white/5">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {visualData.rows.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="p-6 font-bold text-gray-900 dark:text-white">{row.label}</td>
                        {row.values.map((val: string, j: number) => (
                          <td key={j} className="p-6 text-gray-600 dark:text-gray-400">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {visualData.type === 'formula_card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {visualData.cards.map((card: any, i: number) => (
                  <div key={i} className="p-8 bg-black dark:bg-white text-white dark:text-black rounded-[2rem] space-y-6 shadow-xl">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold uppercase tracking-widest text-xs opacity-60">{card.title}</h4>
                      <Calculator size={20} className="opacity-60" />
                    </div>
                    <div className="py-6 border-y border-white/10 dark:border-black/10">
                      <code className="text-3xl font-mono font-bold tracking-tighter">{card.formula}</code>
                    </div>
                    <div className="space-y-4">
                      <p className="text-sm opacity-80">{card.explanation}</p>
                      <div className="p-4 bg-white/10 dark:bg-black/10 rounded-xl text-xs">
                        <span className="font-bold">Example:</span> {card.example}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {visualData.type === 'scientific_process' && (
              <div className="space-y-12">
                {visualData.phases.map((phase: any, i: number) => (
                  <div key={i} className="flex gap-8 group">
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                        <FlaskConical size={28} />
                      </div>
                      {i < visualData.phases.length - 1 && (
                        <div className="flex-1 w-1 bg-indigo-100 dark:bg-indigo-900/30 my-4 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 pb-12">
                      <h4 className="text-2xl font-bold mb-2">{phase.name}</h4>
                      <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{phase.description}</p>
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl text-sm font-bold">
                        <ChevronRight size={16} />
                        Key Takeaway: {phase.key_takeaway}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {visualData.type === 'mindmap' && (
              <div className="flex flex-col items-center py-10">
                <div className="p-6 bg-indigo-600 text-white rounded-2xl font-bold text-xl shadow-xl shadow-indigo-500/20 mb-12">
                  {visualData.root.label}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                  {visualData.root.children.map((child: any, i: number) => (
                    <div key={i} className="space-y-4">
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl font-bold text-center border border-indigo-100 dark:border-indigo-900/30">
                        {child.label}
                      </div>
                      <div className="space-y-2">
                        {child.children.map((sub: any, j: number) => (
                          <div key={j} className="p-3 bg-white dark:bg-black rounded-lg border border-black/5 dark:border-white/5 text-sm text-center text-gray-500">
                            {sub.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
