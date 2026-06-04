import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Presentation, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Download, 
  RefreshCw,
  Sparkles,
  MessageSquare,
  Layout
} from 'lucide-react';
import { cn } from '../lib/utils';
import { generateSlideDeck } from '../services/geminiService';

interface Slide {
  title: string;
  content: string[];
  speaker_notes: string;
  layout: 'title' | 'content' | 'split' | 'quote';
}

interface SlideDeckProps {
  projectId: string;
}

export default function SlideDeck({ projectId }: SlideDeckProps) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showNotes, setShowNotes] = useState(false);

  const fetchSlides = async () => {
    setIsLoading(true);
    try {
      const data = await generateSlideDeck(projectId);
      setSlides(data);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error generating slides:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSlides();
  }, [projectId]);

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-2">
          <p className="text-xl font-black tracking-tight animate-pulse">Designing Presentation...</p>
          <p className="text-gray-500 text-sm">Structuring slides and generating speaker notes.</p>
        </div>
      </div>
    );
  }

  if (slides.length === 0) return null;

  const currentSlide = slides[currentIndex];

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full text-sm font-bold uppercase tracking-widest">
            <Presentation size={16} />
            AI Presentation
          </div>
          <h2 className="text-3xl font-black tracking-tight">Project Slide Deck</h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchSlides}
            className="p-3 bg-black/5 dark:bg-white/5 rounded-xl hover:bg-black/10 transition-all"
          >
            <RefreshCw size={20} />
          </button>
          <button className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
            <Download size={20} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Slide Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="relative aspect-video bg-white dark:bg-[#111111] rounded-[3rem] border border-black/5 dark:border-white/5 shadow-2xl overflow-hidden flex items-center justify-center p-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full h-full flex flex-col justify-center"
              >
                {currentSlide.layout === 'title' && (
                  <div className="text-center space-y-8">
                    <h1 className="text-6xl font-black tracking-tighter leading-tight text-indigo-600">
                      {currentSlide.title}
                    </h1>
                    <div className="w-24 h-2 bg-indigo-600 mx-auto rounded-full" />
                  </div>
                )}

                {currentSlide.layout === 'content' && (
                  <div className="space-y-8">
                    <h3 className="text-4xl font-black tracking-tight border-b-4 border-indigo-600 pb-4 inline-block">
                      {currentSlide.title}
                    </h3>
                    <ul className="space-y-4">
                      {currentSlide.content.map((point, i) => (
                        <motion.li 
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-start gap-4 text-xl text-gray-600 dark:text-gray-300"
                        >
                          <div className="w-2 h-2 bg-indigo-600 rounded-full mt-3 shrink-0" />
                          {point}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentSlide.layout === 'quote' && (
                  <div className="text-center space-y-8 max-w-2xl mx-auto">
                    <div className="text-8xl font-serif text-indigo-200 dark:text-indigo-900/30 leading-none">"</div>
                    <h3 className="text-3xl font-bold italic text-gray-800 dark:text-gray-100 -mt-12">
                      {currentSlide.title}
                    </h3>
                    <div className="text-8xl font-serif text-indigo-200 dark:text-indigo-900/30 leading-none text-right">"</div>
                  </div>
                )}

                {currentSlide.layout === 'split' && (
                  <div className="grid grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                      <h3 className="text-4xl font-black tracking-tight">{currentSlide.title}</h3>
                      <div className="w-16 h-2 bg-indigo-600 rounded-full" />
                    </div>
                    <ul className="space-y-4">
                      {currentSlide.content.map((point, i) => (
                        <li key={i} className="flex items-start gap-3 text-lg text-gray-600 dark:text-gray-300">
                          <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-2.5 shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Controls Overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 px-6 py-3 bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-full border border-black/5 dark:border-white/5">
              <button 
                onClick={prevSlide}
                disabled={currentIndex === 0}
                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="text-sm font-black tracking-widest text-gray-400">
                {currentIndex + 1} / {slides.length}
              </div>
              <button 
                onClick={nextSlide}
                disabled={currentIndex === slides.length - 1}
                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full disabled:opacity-30 transition-all"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>

          {/* Speaker Notes */}
          <div className="bg-white dark:bg-[#111111] p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-widest text-xs">
                <MessageSquare size={16} />
                Speaker Notes
              </div>
              <button 
                onClick={() => setShowNotes(!showNotes)}
                className="text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors"
              >
                {showNotes ? 'Hide Notes' : 'Show Notes'}
              </button>
            </div>
            {showNotes && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-gray-600 dark:text-gray-400 leading-relaxed italic"
              >
                {currentSlide.speaker_notes}
              </motion.p>
            )}
          </div>
        </div>

        {/* Slide Thumbnails */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto max-h-[700px] pr-2 no-scrollbar">
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 px-2">Navigation</h4>
          {slides.map((slide, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "w-full p-4 rounded-2xl border-2 text-left transition-all group",
                currentIndex === i 
                  ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" 
                  : "border-transparent bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-white/5"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors",
                  currentIndex === i ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-white/5 text-gray-400"
                )}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-bold truncate",
                    currentIndex === i ? "text-indigo-600" : "text-gray-600 dark:text-gray-400"
                  )}>
                    {slide.title}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{slide.layout}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
