import React, { useState, useEffect } from 'react';
import { Lightbulb, Sparkles, Copy, Check, Save, History, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { MNEMONIC_STYLES } from '../constants';
import { MnemonicResponse } from '../types';
import VisualGenerator from './VisualGenerator';
import { db, collection, query, where, onSnapshot, orderBy, setDoc, doc, deleteDoc, handleFirestoreError, OperationType, auth } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { generateMnemonic as generateMnemonicAi } from '../services/geminiService';

interface MnemonicHistoryItem extends MnemonicResponse {
  id: string;
  concept: string;
  style: string;
  created_at: string;
}

interface MnemonicsProps {
  projectId: string;
}

export default function Mnemonics({ projectId }: MnemonicsProps) {
  const [concept, setConcept] = useState('');
  const [style, setStyle] = useState('acronym');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mnemonic, setMnemonic] = useState<MnemonicResponse | null>(null);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<MnemonicHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!projectId || !auth.currentUser) return;

    const q = query(
      collection(db, 'mnemonics'),
      where('project_id', '==', projectId),
      where('user_id', '==', auth.currentUser.uid),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MnemonicHistoryItem));
      setHistory(historyData);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'mnemonics'));

    return () => unsubscribe();
  }, [projectId]);

  const generateMnemonic = async () => {
    if (!concept.trim()) return;
    setIsLoading(true);
    try {
      const genData = await generateMnemonicAi(concept, style, projectId);
      setMnemonic(genData);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMnemonic = async () => {
    if (!mnemonic || !concept.trim() || !auth.currentUser) return;
    setIsSaving(true);
    try {
      const mnemonicId = uuidv4();
      await setDoc(doc(db, 'mnemonics', mnemonicId), {
        id: mnemonicId,
        concept,
        mnemonic: mnemonic.mnemonic,
        explanation: mnemonic.explanation,
        style,
        project_id: projectId,
        user_id: auth.currentUser.uid,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'mnemonics');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteMnemonic = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this mnemonic?')) return;
    try {
      await deleteDoc(doc(db, 'mnemonics', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'mnemonics');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Mnemonic Generator</h2>
          <p className="text-gray-500 dark:text-gray-400">Create memorable aids for complex academic concepts.</p>
        </div>
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className={cn(
            "p-3 rounded-2xl border transition-all flex items-center gap-2",
            showHistory 
              ? "bg-indigo-600 border-indigo-600 text-white" 
              : "bg-white dark:bg-[#111111] border-black/5 dark:border-white/5 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"
          )}
        >
          <History size={20} />
          <span className="hidden sm:inline font-medium">History</span>
        </button>
      </section>

      <AnimatePresence mode="wait">
        {showHistory ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Saved Mnemonics</h3>
              <span className="text-xs text-gray-400">{history.length} items</span>
            </div>
            
            {history.length === 0 ? (
              <div className="bg-white dark:bg-[#111111] p-12 rounded-3xl border border-dashed border-black/10 dark:border-white/10 text-center">
                <History size={40} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No saved mnemonics yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {history.map((item) => (
                  <div key={item.id} className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-black/5 dark:border-white/5 group hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{item.style}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => copyToClipboard(item.mnemonic)}
                          className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-gray-400 hover:text-indigo-600"
                        >
                          <Copy size={16} />
                        </button>
                        <button 
                          onClick={(e) => deleteMnemonic(item.id, e)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-gray-400 hover:text-rose-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mb-1">{item.concept}</p>
                    <h4 className="text-lg font-bold mb-2">{item.mnemonic}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-2">{item.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="generator"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm space-y-6">
              <div className="space-y-4">
                <label className="block text-sm font-bold uppercase tracking-wider text-gray-400">Concept to Remember</label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="e.g., Order of Planets, Periodic Table elements, Math formulas"
                  className="w-full bg-black/5 dark:bg-white/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-bold uppercase tracking-wider text-gray-400">Mnemonic Style</label>
                <div className="flex flex-wrap gap-2">
                  {MNEMONIC_STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all",
                        style === s.value 
                          ? "bg-indigo-600 text-white" 
                          : "bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generateMnemonic}
                disabled={isLoading || !concept.trim()}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generate Memory Aid
                  </>
                )}
              </button>
            </div>

            {mnemonic && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-600 text-white p-10 rounded-3xl shadow-xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Lightbulb size={120} />
                </div>
                
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">Your Mnemonic</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowVisualizer(true)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                      >
                        <ImageIcon size={18} />
                        Visualize
                      </button>
                      <button 
                        onClick={saveMnemonic}
                        disabled={isSaving}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                      >
                        {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18} />}
                        Save
                      </button>
                      <button 
                        onClick={() => copyToClipboard(mnemonic.mnemonic)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>

                  <h3 className="text-4xl font-bold leading-tight">{mnemonic.mnemonic}</h3>
                  
                  <div className="pt-6 border-t border-white/20">
                    <p className="text-indigo-100 leading-relaxed">
                      {mnemonic.explanation}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
          {showVisualizer && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#F8F9FA] dark:bg-[#0A0A0A] w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#111111]">
                  <h3 className="font-bold text-lg">Visual Learning Aid</h3>
                  <button onClick={() => setShowVisualizer(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                  <VisualGenerator projectId={projectId} initialTopic={concept} />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
}
