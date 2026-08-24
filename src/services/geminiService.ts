import { auth } from '../firebase';
import { apiFetch } from '../lib/api';

// Helper to make secure HTTP requests to Express server AI endpoints
async function callAiEndpoint(path: string, payload: any) {
  // Try custom auth user stored in localStorage first
  const customToken = localStorage.getItem('customAuthToken');
  let userId = auth.currentUser?.uid;

  if (!userId && customToken) {
    try {
      const parts = customToken.split('.');
      if (parts.length === 3) {
        const decoded = JSON.parse(atob(parts[1]));
        userId = decoded.uid;
      }
    } catch {
      // Ignore token decode error
    }
  }

  if (!userId) {
    userId = 'user_default';
  }

  const response = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      userId
    })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(errorData.error || 'Server request failed');
  }
  return response.json();
}

export async function generateNotebookAction(action: string, projectId: string, userQuery?: string, useGrounding: boolean = false) {
  return callAiEndpoint('/api/ai/notebook-action', { action, projectId, userQuery, useGrounding });
}

export async function generateQuiz(topic: string, difficulty: string, projectId: string) {
  return callAiEndpoint('/api/ai/generate-quiz', { topic, difficulty, projectId });
}

export async function generateMnemonic(concept: string, style: string, projectId: string) {
  return callAiEndpoint('/api/ai/generate-mnemonic', { concept, style, projectId });
}

export async function checkPlagiarism(text: string) {
  return callAiEndpoint('/api/ai/check-plagiarism', { text });
}

export async function generateVisual(topic: string, format: string, projectId: string) {
  return callAiEndpoint('/api/ai/generate-visual', { topic, format, projectId });
}

export async function generateExam(projectId: string, config: any) {
  return callAiEndpoint('/api/ai/generate-exam', { projectId, config });
}

export async function analyzeExam(exam: any, answers: any) {
  return callAiEndpoint('/api/ai/analyze-exam', { exam, answers });
}

export async function generateCourseAi(projectId: string) {
  return callAiEndpoint('/api/ai/generate-course-ai', { projectId });
}

export async function generateStudyGuide(projectId: string) {
  const result = await callAiEndpoint('/api/ai/generate-study-guide', { projectId });
  return result.text;
}

export async function generateSlideDeck(projectId: string) {
  return callAiEndpoint('/api/ai/generate-slide-deck', { projectId });
}

export async function analyzeConfusion(query: string, projectId: string) {
  const result = await callAiEndpoint('/api/ai/analyze-confusion', { query, projectId });
  return result.text;
}

export async function conceptBattle(query: string | undefined, projectId: string, concepts?: [string, string]) {
  return callAiEndpoint('/api/ai/concept-battle', { query, projectId, concepts });
}
