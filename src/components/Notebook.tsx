import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  FileText, 
  Trash2, 
  Sparkles, 
  MessageSquare, 
  ListRestart, 
  HelpCircle,
  ChevronRight,
  Upload,
  X,
  BookOpen,
  Globe,
  ExternalLink,
  Network,
  Youtube,
  Search,
  ShieldCheck,
  Swords,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { useCollaboration } from '../hooks/useCollaboration';
import VisualGenerator from './VisualGenerator';
import ConceptBattle from './ConceptBattle';
import { db, collection, query, where, onSnapshot, orderBy, setDoc, doc, deleteDoc, handleFirestoreError, OperationType, auth } from '../firebase';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { generateNotebookAction, checkPlagiarism as checkPlagiarismAi } from '../services/geminiService';

interface Note {
  id: string;
  title: string;
  content: string;
  source_type: string;
  created_at: string;
}

interface GroundingSource {
  title: string;
  uri: string;
}

interface NotebookProps {
  projectId: string;
  mode: 'documents' | 'notes' | 'mindmap' | 'graph';
}

interface Document {
  id: string;
  title: string;
  content: string;
  source_type: string;
  created_at: string;
}

export default function Notebook({ projectId, mode }: NotebookProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [chatQuery, setChatQuery] = useState('');
  const [useGrounding, setUseGrounding] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [googleDocUrl, setGoogleDocUrl] = useState('');
  const [isFetchingYoutube, setIsFetchingYoutube] = useState(false);
  const [isFetchingGoogleDoc, setIsFetchingGoogleDoc] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [plagiarismResult, setPlagiarismResult] = useState<any>(null);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showConceptBattle, setShowConceptBattle] = useState(false);
  const [battleQuery, setBattleQuery] = useState('');
  
  const { activeUsers, remoteCursors, sendCursor } = useCollaboration(projectId, auth.currentUser?.uid || '', auth.currentUser?.displayName || 'User');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId || !auth.currentUser) return;

    const uid = auth.currentUser.uid;

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setDocuments(data as Document[]);
        });

      supabase
        .from('notes')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setNotes(data as Note[]);
        });

      const docsChannel = supabase
        .channel('public:documents')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `project_id=eq.${projectId}` }, () => {
          supabase
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              if (data) setDocuments(data as Document[]);
            });
        })
        .subscribe();

      const notesChannel = supabase
        .channel('public:notes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `project_id=eq.${projectId}` }, () => {
          supabase
            .from('notes')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              if (data) setNotes(data as Note[]);
            });
        })
        .subscribe();

      if (mode === 'mindmap' || mode === 'graph') {
        performAiAction(mode === 'mindmap' ? 'mindmap' : 'knowledge_graph');
      }

      return () => {
        supabase.removeChannel(docsChannel);
        supabase.removeChannel(notesChannel);
      };
    } else {
      const docsQuery = query(
        collection(db, 'documents'),
        where('project_id', '==', projectId),
        where('user_id', '==', uid),
        orderBy('created_at', 'desc')
      );

      const notesQuery = query(
        collection(db, 'notes'),
        where('project_id', '==', projectId),
        where('user_id', '==', uid),
        orderBy('created_at', 'desc')
      );

      const unsubscribeDocs = onSnapshot(docsQuery, (snapshot) => {
        const docsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
        setDocuments(docsData);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'documents'));

      const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
        const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
        setNotes(notesData);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'notes'));

      if (mode === 'mindmap' || mode === 'graph') {
        performAiAction(mode === 'mindmap' ? 'mindmap' : 'knowledge_graph');
      }

      return () => {
        unsubscribeDocs();
        unsubscribeNotes();
      };
    }
  }, [projectId, mode]);

  const handleDeleteSource = async (id: string, type: 'document' | 'note', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this source?')) return;
    
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from(type === 'document' ? 'documents' : 'notes')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } else {
        await deleteDoc(doc(db, type === 'document' ? 'documents' : 'notes', id));
      }
      setSelectedDocIds(prev => prev.filter(docId => docId !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, type);
    }
  };

  const handleAddSource = async () => {
    if (!newSourceTitle.trim() || !newSourceContent.trim() || !auth.currentUser) return;
    try {
      const noteId = uuidv4();
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('notes')
          .insert({
            id: noteId,
            title: newSourceTitle,
            content: newSourceContent,
            source_type: 'text',
            project_id: projectId,
            user_id: auth.currentUser.uid
          });
        if (error) throw error;
      } else {
        await setDoc(doc(db, 'notes', noteId), {
          id: noteId,
          title: newSourceTitle,
          content: newSourceContent,
          source_type: 'text',
          project_id: projectId,
          user_id: auth.currentUser.uid,
          created_at: new Date().toISOString()
        });
      }
      setIsAddingSource(false);
      setNewSourceTitle('');
      setNewSourceContent('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notes');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setIsUploading(true);
    setImportError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', auth.currentUser.uid);
    formData.append('project_id', projectId);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setIsAddingSource(false);
      } else {
        const err = await res.json();
        setImportError(err.error || 'Upload failed');
      }
    } catch (error) {
      console.error('PDF upload failed:', error);
      setImportError('Network error during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(docId => docId !== id) : [...prev, id]
    );
  };

  const performAiAction = async (action: 'summarize' | 'explain' | 'exam_questions' | 'chat' | 'mindmap' | 'knowledge_graph') => {
    setIsLoading(true);
    setGroundingSources([]);
    
    try {
      const data = await generateNotebookAction(action, projectId, action === 'chat' ? chatQuery : undefined, useGrounding);
      setAiOutput(data.text);
      setGroundingSources(data.sources || []);
      if (action === 'chat') setChatQuery('');
    } catch (error) {
      console.error('AI Action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkPlagiarism = async () => {
    if (!aiOutput) return;
    setIsLoading(true);
    try {
      const data = await checkPlagiarismAi(aiOutput);
      setPlagiarismResult(data);
    } catch (error) {
      console.error('Plagiarism check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleYoutubeImport = async () => {
    if (!youtubeUrl.trim()) return;
    setIsFetchingYoutube(true);
    setImportError(null);
    try {
      const res = await fetch('/api/youtube/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        // Better ID extraction for title
        const videoIdMatch = youtubeUrl.match(/(?:v=|\/v\/|embed\/|youtu\.be\/|\/shorts\/)([^#&?]*).*/);
        const videoId = videoIdMatch ? videoIdMatch[1] : 'Video';
        
        setNewSourceTitle(`YouTube: ${videoId}`);
        setNewSourceContent(data.text);
        setYoutubeUrl('');
      } else {
        setImportError(data.error || 'Failed to fetch transcript');
      }
    } catch (error) {
      console.error('YouTube import failed:', error);
      setImportError('Network error during YouTube import');
    } finally {
      setIsFetchingYoutube(false);
    }
  };

  const handleGoogleDocImport = async () => {
    if (!googleDocUrl.trim() || !auth.currentUser) return;
    setIsFetchingGoogleDoc(true);
    setImportError(null);
    try {
      const res = await fetch('/api/documents/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: googleDocUrl,
          user_id: auth.currentUser.uid,
          project_id: projectId
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsAddingSource(false);
        setGoogleDocUrl('');
      } else {
        setImportError(data.error || 'Failed to import Google Doc');
      }
    } catch (error) {
      console.error('Google Doc import failed:', error);
      setImportError('Network error during Google Doc import');
    } finally {
      setIsFetchingGoogleDoc(false);
    }
  };

  const filteredDocs = documents.filter(d => 
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (mode === 'mindmap' || mode === 'graph') {
    return (
      <div 
        onMouseMove={(e) => sendCursor(e.clientX, e.clientY)}
        className="h-full bg-white dark:bg-[#111111] rounded-3xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden flex flex-col p-8 relative"
      >
        {/* Remote Cursors */}
        {Object.entries(remoteCursors).map(([id, cursor]) => (
          <div 
            key={id} 
            className="absolute pointer-events-none z-50 transition-all duration-100"
            style={{ left: cursor.x, top: cursor.y }}
          >
            <div className="w-3 h-3 bg-indigo-600 rounded-full" />
            <div className="ml-2 px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded shadow-lg">
              {cursor.name}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest">
            {mode === 'mindmap' ? <Globe size={14} /> : <Network size={14} />}
            {mode === 'mindmap' ? 'AI Mindmap' : 'Knowledge Graph'}
          </div>
            <button
              onClick={() => {
                setBattleQuery(`Based on this project context, identify two concepts that are easily confused and start a battle.`);
                setShowConceptBattle(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
            >
              <Swords size={16} className="text-amber-600" />
              Concept Battle
            </button>
            <button 
              onClick={() => performAiAction(mode === 'mindmap' ? 'mindmap' : 'knowledge_graph')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all"
          >
            <Sparkles size={16} />
            Regenerate
          </button>
        </div>

        {/* Presence Indicators */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex -space-x-2">
            {Object.entries(activeUsers).map(([id, user]) => (
              <div 
                key={id} 
                title={user.name}
                className="w-8 h-8 rounded-full border-2 border-white dark:border-[#111111] bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-600"
              >
                {user.name.charAt(0)}
              </div>
            ))}
          </div>
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse">
            {Object.keys(activeUsers).length} Active Now
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400 animate-pulse">Mapping project knowledge...</p>
            </div>
          ) : (
            <div className="prose dark:prose-invert max-w-none">
              <Markdown>{aiOutput}</Markdown>
            </div>
          )}
        </div>
        <AnimatePresence>
          {showConceptBattle && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#F8F9FA] dark:bg-[#0A0A0A] w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#111111]">
                  <h3 className="font-bold text-lg">Concept Battle Mode</h3>
                  <button onClick={() => setShowConceptBattle(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                  <ConceptBattle 
                    projectId={projectId}
                    query={battleQuery} 
                    onClose={() => setShowConceptBattle(false)} 
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-12rem)]">
      {/* Sources Sidebar */}
      <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
            {mode === 'documents' ? 'Documents' : 'Notes'}
          </h3>
          <button 
            onClick={() => setIsAddingSource(true)}
            className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${mode}...`}
            className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
          {mode === 'documents' ? (
            filteredDocs.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-black/10 dark:border-white/10 rounded-2xl">
                <p className="text-xs text-gray-400">{searchQuery ? 'No results found.' : 'No documents uploaded yet.'}</p>
              </div>
            ) : (
              filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => toggleDocSelection(doc.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left group",
                    selectedDocIds.includes(doc.id)
                      ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-900/30"
                      : "bg-white dark:bg-[#111111] border-black/5 dark:border-white/5 hover:border-indigo-500/30"
                  )}
                >
                  <div className={cn(
                    "mt-1 w-4 h-4 rounded border flex items-center justify-center transition-all",
                    selectedDocIds.includes(doc.id)
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-gray-300 dark:border-gray-700"
                  )}>
                    {selectedDocIds.includes(doc.id) && <ChevronRight size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <FileText size={12} className="text-rose-500" />
                      <p className="text-sm font-bold truncate">{doc.title}</p>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-1">{doc.content}</p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSource(doc.id, 'document', e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-gray-400 hover:text-rose-600 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              ))
            )
          ) : (
            filteredNotes.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-black/10 dark:border-white/10 rounded-2xl">
                <p className="text-xs text-gray-400">{searchQuery ? 'No results found.' : 'No notes created yet.'}</p>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className="w-full flex items-start gap-3 p-3 rounded-xl border bg-white dark:bg-[#111111] border-black/5 dark:border-white/5 text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <BookOpen size={12} className="text-indigo-500" />
                      <p className="text-sm font-bold truncate">{note.title}</p>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{note.content}</p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSource(note.id, 'note', e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-gray-400 hover:text-rose-600 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* Main Interaction Area */}
      <div className="lg:col-span-3 flex flex-col gap-6 overflow-hidden">
        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => performAiAction('summarize')}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-all"
            >
              <ListRestart size={16} className="text-indigo-600" />
              Summarize
            </button>
            <button
              onClick={() => performAiAction('explain')}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-all"
            >
              <Sparkles size={16} className="text-amber-600" />
              Explain
            </button>
            <button
              onClick={() => performAiAction('exam_questions')}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-all"
            >
              <HelpCircle size={16} className="text-emerald-600" />
              Exam Questions
            </button>
            <button
              onClick={checkPlagiarism}
              disabled={isLoading || !aiOutput}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-all"
            >
              <ShieldCheck size={16} className="text-rose-600" />
              Check Plagiarism
            </button>
          </div>

          <button
            onClick={() => setUseGrounding(!useGrounding)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border",
              useGrounding 
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-600"
                : "bg-white dark:bg-[#111111] border-black/5 dark:border-white/5 text-gray-500"
            )}
          >
            <Globe size={16} />
            Search Grounding
          </button>
        </div>

        {/* Output Display */}
        <div className="flex-1 bg-white dark:bg-[#111111] rounded-3xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400 animate-pulse">Analyzing project knowledge...</p>
              </div>
            ) : aiOutput ? (
              <div className="space-y-8">
                <div className="prose dark:prose-invert max-w-none">
                  <div className="flex items-center gap-2 mb-6 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest">
                    <BookOpen size={14} />
                    Notebook Insight
                  </div>
                  <Markdown>{aiOutput}</Markdown>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowVisualizer(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                  >
                    <ImageIcon size={14} />
                    Visualize this Insight
                  </button>
                </div>

                <AnimatePresence>
                  {showVisualizer && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-6 bg-gray-50 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Visual Learning Aid</h4>
                        <button onClick={() => setShowVisualizer(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
                          <X size={14} />
                        </button>
                      </div>
                      <VisualGenerator projectId={projectId} initialTopic={chatQuery || aiOutput.substring(0, 100)} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {plagiarismResult && (
                  <div className="p-6 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-rose-600 font-bold">
                        <ShieldCheck size={20} />
                        Plagiarism Report
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        plagiarismResult.similarity_score > 20 ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                      )}>
                        {plagiarismResult.similarity_score}% Similarity
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{plagiarismResult.analysis_summary}</p>
                    {plagiarismResult.sources?.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-widest text-gray-400">Potential Sources</h5>
                        {plagiarismResult.sources.map((source: any, idx: number) => (
                          <div key={idx} className="p-3 bg-white dark:bg-black/20 rounded-xl border border-rose-200/50 dark:border-rose-900/30">
                            <div className="flex items-center justify-between mb-2">
                              <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-600 hover:underline truncate pr-4">{source.title}</a>
                              <span className="text-xs font-medium text-rose-500">{source.match_percentage}% match</span>
                            </div>
                            <p className="text-xs text-gray-500 italic">"{source.matching_snippet}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {groundingSources.length > 0 && (
                  <div className="pt-8 border-t border-black/5 dark:border-white/5">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                      <Globe size={14} />
                      Web Sources
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {groundingSources.map((source, idx) => (
                        <a 
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all group"
                        >
                          <span className="text-xs font-medium truncate pr-4">{source.title}</span>
                          <ExternalLink size={12} className="text-gray-400 group-hover:text-indigo-600 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                <BookOpen size={64} className="text-gray-300" />
                <div className="max-w-xs">
                  <p className="text-lg font-bold">Project Knowledge Base</p>
                  <p className="text-sm">Use the actions above to process your project documents and notes.</p>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
            <div className="relative">
              <input
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && performAiAction('chat')}
                placeholder="Ask a question about your project..."
                disabled={isLoading}
                className="w-full bg-white dark:bg-black border-none rounded-2xl p-4 pr-12 shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50"
              />
              <button
                onClick={() => performAiAction('chat')}
                disabled={isLoading || !chatQuery.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                <MessageSquare size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Source Modal */}
      <AnimatePresence>
        {isAddingSource && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingSource(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-[#111111] rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                <h3 className="text-xl font-bold">Add New Source</h3>
                <button onClick={() => setIsAddingSource(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {importError && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl flex items-center gap-3 text-rose-600 text-sm animate-shake">
                    <X size={16} className="shrink-0" />
                    {importError}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group"
                  >
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      {isUploading ? <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /> : <Upload size={20} />}
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-sm">Upload File</p>
                      <p className="text-[10px] text-gray-400 mt-1">PDF or TXT</p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept=".pdf,.txt" 
                      className="hidden" 
                    />
                  </button>

                  <div className="flex flex-col gap-3 p-6 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl hover:border-rose-500/50 hover:bg-rose-50/30 dark:hover:bg-rose-900/10 transition-all group">
                    <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
                      {isFetchingYoutube ? <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" /> : <Youtube size={20} />}
                    </div>
                    <div className="space-y-2 w-full">
                      <p className="font-bold text-sm text-center">YouTube</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                          placeholder="Video URL"
                          className="flex-1 bg-white dark:bg-black border-none rounded-lg p-2 text-[10px] focus:ring-1 focus:ring-rose-500"
                        />
                        <button
                          onClick={handleYoutubeImport}
                          disabled={isFetchingYoutube || !youtubeUrl.trim()}
                          className="p-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 p-6 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-all group">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                      {isFetchingGoogleDoc ? <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> : <Globe size={20} />}
                    </div>
                    <div className="space-y-2 w-full">
                      <p className="font-bold text-sm text-center">Google Doc</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={googleDocUrl}
                          onChange={(e) => setGoogleDocUrl(e.target.value)}
                          placeholder="Doc URL"
                          className="flex-1 bg-white dark:bg-black border-none rounded-lg p-2 text-[10px] focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          onClick={handleGoogleDocImport}
                          disabled={isFetchingGoogleDoc || !googleDocUrl.trim()}
                          className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-black/5 dark:border-white/5" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-[#111111] px-2 text-gray-400 font-bold">Or Paste Text</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Source Title</label>
                  <input
                    type="text"
                    value={newSourceTitle}
                    onChange={(e) => setNewSourceTitle(e.target.value)}
                    placeholder="e.g., Biology Chapter 4 Notes"
                    className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Content</label>
                  <textarea
                    value={newSourceContent}
                    onChange={(e) => setNewSourceContent(e.target.value)}
                    placeholder="Paste your notes or text here..."
                    className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-4 min-h-[200px] focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                  />
                </div>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-white/5 flex justify-end gap-3">
                <button
                  onClick={() => setIsAddingSource(false)}
                  className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSource}
                  disabled={!newSourceTitle.trim() || !newSourceContent.trim()}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  Add Source
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
