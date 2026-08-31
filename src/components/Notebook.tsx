import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FileText, Upload, Plus, Trash2, Link as LinkIcon, Youtube, Search } from 'lucide-react';

interface NotebookProps {
  projectId: string;
  mode: 'documents' | 'notes' | 'mindmap' | 'graph';
}

interface DocumentItem {
  id: string;
  name: string;
  content?: string;
  created_at: string;
}

interface NoteItem {
  id: string;
  content: string;
  created_at: string;
}

export default function Notebook({ projectId, mode }: NotebookProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [showUrlModal, setShowUrlModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      const { data: nts } = await supabase
        .from('notes')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      setDocuments(docs as DocumentItem[] || []);
      setNotes(nts as NoteItem[] || []);
    } catch (err) {
      console.error('Notebook fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);

      await apiFetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });

      loadData();
    } catch (err: any) {
      alert(err.message || 'File upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setUploading(true);
    try {
      if (urlInput.includes('youtube.com') || urlInput.includes('youtu.be')) {
        await apiFetch('/api/youtube/transcript', {
          method: 'POST',
          body: JSON.stringify({ url: urlInput, projectId })
        });
      } else {
        await apiFetch('/api/documents/import-url', {
          method: 'POST',
          body: JSON.stringify({ url: urlInput, projectId })
        });
      }
      setUrlInput('');
      setShowUrlModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Import failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Delete document?')) return;
    try {
      await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('notes')
        .insert({
          project_id: projectId,
          user_id: user.id,
          content: newNoteContent
        })
        .select()
        .single();

      if (data) setNotes([data as NoteItem, ...notes]);
      setNewNoteContent('');
    } catch (err) {
      console.error('Note add error:', err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await supabase.from('notes').delete().eq('id', id);
      setNotes(notes.filter(n => n.id !== id));
    } catch (err) {
      console.error('Delete note error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold capitalize">{mode}</h1>
        {mode === 'documents' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUrlModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              <LinkIcon size={16} /> Import URL / Video
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold cursor-pointer shadow-sm">
              <Upload size={16} /> Upload File (PDF/TXT)
              <input type="file" accept=".pdf,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}
      </div>

      {uploading && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-xl text-sm font-medium flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          Processing document upload...
        </div>
      )}

      {mode === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map((doc) => (
            <div key={doc.id} className="p-4 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className="text-indigo-600 shrink-0" size={20} />
                <span className="font-semibold text-sm truncate">{doc.name}</span>
              </div>
              <button onClick={() => handleDeleteDoc(doc.id)} className="text-gray-400 hover:text-rose-500 p-1">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {documents.length === 0 && (
            <p className="text-gray-500 text-sm col-span-2 text-center py-8">No documents uploaded yet.</p>
          )}
        </div>
      )}

      {mode === 'notes' && (
        <div className="space-y-4">
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Type a new study note..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm text-sm">
              Add Note
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notes.map((note) => (
              <div key={note.id} className="p-4 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl flex justify-between gap-2 shadow-sm">
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <button onClick={() => handleDeleteNote(note.id)} className="text-gray-400 hover:text-rose-500 shrink-0 p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showUrlModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full space-y-4 border border-black/5 dark:border-white/5 shadow-2xl">
            <h2 className="text-lg font-bold">Import Webpage or YouTube</h2>
            <form onSubmit={handleUrlImport} className="space-y-4">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowUrlModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-500">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow-sm">Import</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
