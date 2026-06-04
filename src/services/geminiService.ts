import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { db, collection, query, where, getDocs, handleFirestoreError, OperationType, auth } from '../firebase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getProjectContext(projectId: string) {
  try {
    const user = auth.currentUser;
    if (!user) return '';

    const [docsSnapshot, notesSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'documents'), where('project_id', '==', projectId), where('user_id', '==', user.uid))),
      getDocs(query(collection(db, 'notes'), where('project_id', '==', projectId), where('user_id', '==', user.uid)))
    ]);

    const docs = docsSnapshot.docs.map(d => d.data().content).join('\n\n');
    const notes = notesSnapshot.docs.map(n => n.data().content).join('\n\n');

    return `CONTEXT FROM PROJECT DOCUMENTS:\n${docs}\n\nCONTEXT FROM PROJECT NOTES:\n${notes}`;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'project_context');
    return '';
  }
}

export async function generateNotebookAction(action: string, projectId: string, userQuery?: string, useGrounding: boolean = false) {
  const context = await getProjectContext(projectId);
  
  let prompt = '';
  switch (action) {
    case 'summarize':
      prompt = `Based on the following context, provide a comprehensive summary of the key concepts and information:\n\n${context}`;
      break;
    case 'explain':
      prompt = `Based on the following context, explain the most complex topics in simple terms:\n\n${context}`;
      break;
    case 'exam_questions':
      prompt = `Based on the following context, generate 5 potential exam questions with brief answers:\n\n${context}`;
      break;
    case 'chat':
      prompt = `Context:\n${context}\n\nUser Question: ${userQuery}\n\nAnswer the user's question based on the provided context. If the answer is not in the context, use your general knowledge but mention it's not in the project documents.`;
      break;
    case 'mindmap':
      prompt = `Based on the following context, generate a structured mindmap in Markdown format (using nested lists and bold headings):\n\n${context}`;
      break;
    case 'knowledge_graph':
      prompt = `Based on the following context, identify the key entities and their relationships. Format as a Markdown knowledge graph description:\n\n${context}`;
      break;
    default:
      prompt = `Analyze the following context:\n\n${context}`;
  }

  const config: any = {};
  if (useGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config
  });

  return {
    text: response.text,
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || 'Source',
      uri: chunk.web?.uri || ''
    })) || []
  };
}

export async function generateQuiz(topic: string, difficulty: string, projectId: string) {
  const context = await getProjectContext(projectId);
  const prompt = `Based on the following project context and the specific topic "${topic}", generate a quiz with 5 questions.
  Difficulty: ${difficulty}
  
  IMPORTANT: For each question, provide a detailed explanation that not only states why the correct answer is right but also briefly addresses why common misconceptions (the other options) are incorrect. The explanation should be educational and comprehensive.
  
  Return the response in JSON format matching this schema:
  {
    "questions": [
      {
        "id": "string",
        "type": "multiple_choice" | "true_false" | "fill_blank",
        "question": "string",
        "options": ["string"] (only for multiple_choice),
        "correct_answer": "string",
        "explanation": "string"
      }
    ]
  }
  
  CONTEXT:\n${context}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["multiple_choice", "true_false", "fill_blank"] },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correct_answer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["id", "type", "question", "correct_answer", "explanation"]
            }
          }
        },
        required: ["questions"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function generateMnemonic(concept: string, style: string, projectId: string) {
  const context = await getProjectContext(projectId);
  const prompt = `Generate a mnemonic for the concept: "${concept}" using the style: "${style}".
  Use the provided project context for additional information if relevant.
  
  Return the response in JSON format matching this schema:
  {
    "mnemonic": "string",
    "explanation": "string"
  }
  
  CONTEXT:\n${context}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mnemonic: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ["mnemonic", "explanation"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function checkPlagiarism(text: string) {
  const prompt = `Analyze the following text for potential plagiarism or lack of originality. Provide a similarity score and a brief analysis.
  
  TEXT TO ANALYZE:
  ${text}
  
  Return the response in JSON format matching this schema:
  {
    "similarity_score": number (0-100),
    "analysis_summary": "string",
    "sources": [
      {
        "title": "string",
        "url": "string",
        "match_percentage": number,
        "matching_snippet": "string"
      }
    ]
  }
  
  Use Google Search to find potential matches.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          similarity_score: { type: Type.NUMBER },
          analysis_summary: { type: Type.STRING },
          sources: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                url: { type: Type.STRING },
                match_percentage: { type: Type.NUMBER },
                matching_snippet: { type: Type.STRING }
              },
              required: ["title", "url", "match_percentage", "matching_snippet"]
            }
          }
        },
        required: ["similarity_score", "analysis_summary", "sources"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function generateVisual(topic: string, format: string, projectId: string) {
  const context = await getProjectContext(projectId);
  const prompt = `Generate a visual learning aid for the topic: "${topic}" in the format: "${format}".
  Based on the project context, create a structured response in JSON format.
  
  FORMAT SPECIFICATIONS:
  - infographic: { type: 'infographic', title: string, sections: [{ title: string, content: string, icon: string (Lucide icon name), color: string (hex) }] }
  - flowchart: { type: 'flowchart', title: string, steps: [{ id: string, label: string, description: string }] }
  - comparison: { type: 'comparison', title: string, headers: [string], rows: [{ label: string, values: [string] }] }
  - formula_card: { type: 'formula_card', title: string, cards: [{ title: string, formula: string, explanation: string, example: string }] }
  - scientific_process: { type: 'scientific_process', title: string, phases: [{ name: string, description: string, key_takeaway: string }] }
  - mindmap: { type: 'mindmap', root: { label: string, children: [{ label: string, children: [] }] } }

  CONTEXT:\n${context}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text);
}

export async function generateExam(projectId: string, config: any) {
  const context = await getProjectContext(projectId);
  const prompt = `Generate a comprehensive exam based on the following project context.
  Config: ${JSON.stringify(config)}
  
  Return the response in JSON format matching this schema:
  {
    "id": "string",
    "title": "string",
    "questions": [
      {
        "id": "string",
        "type": "multiple_choice" | "true_false" | "short_answer" | "theory" | "concept_trap",
        "question": "string",
        "options": ["string"] (for multiple_choice/concept_trap),
        "correct_answer": "string",
        "explanation": "string",
        "concept": "string"
      }
    ]
  }
  
  CONTEXT:\n${context}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text);
}

export async function analyzeExam(exam: any, answers: any) {
  const prompt = `Analyze the results of an exam.
  Exam: ${JSON.stringify(exam)}
  Answers: ${JSON.stringify(answers)}
  
  Return the response in JSON format matching this schema:
  {
    "overall_performance": string,
    "topic_mastery": [
      { "topic": string, "score": number, "status": "mastered" | "improving" | "weak" }
    ],
    "weak_concepts": [string],
    "strong_concepts": [string],
    "recommendations": [string],
    "next_steps": [string],
    "concept_battles": [{ "concepts": [string, string], "reason": string }]
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text);
}

export async function generateCourseAi(projectId: string) {
  const context = await getProjectContext(projectId);
  const prompt = `Create a structured course based on this content:
  ${context}
  
  The course should have:
  - id: string
  - title: string
  - description: string
  - modules: Array of modules
  
  Each module has:
  - id: string
  - title: string
  - lessons: Array of lessons
  
  Each lesson has:
  - id: string
  - title: string
  - content: string (detailed markdown)
  - formulas: string[] (optional)
  - definitions: Array<{ term: string, definition: string }> (optional)
  - mnemonics: Array<{ mnemonic: string, explanation: string }> (optional)
  - practice_questions: Array of questions (id, question, options, correct_answer, explanation)
  
  Return the response in JSON format.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return { id: crypto.randomUUID(), ...JSON.parse(response.text) };
}

export async function generateStudyGuide(projectId: string) {
  const context = await getProjectContext(projectId);
  const prompt = `Based on the following project context, generate a comprehensive study guide.
  The study guide should include:
  - A high-level overview
  - Key concepts and definitions
  - Important formulas or dates (if applicable)
  - A structured outline of the material
  - 3-5 critical thinking questions to deepen understanding
  
  Format the response as Markdown.
  
  CONTEXT:\n${context}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
}

export async function generateSlideDeck(projectId: string) {
  const context = await getProjectContext(projectId);
  const prompt = `Based on the following project context, generate a structured slide deck for a presentation.
  The response should be a JSON array of slides.
  Each slide should have:
  - title: string
  - content: string[] (bullet points)
  - speaker_notes: string
  - layout: 'title' | 'content' | 'split' | 'quote'
  
  CONTEXT:\n${context}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.ARRAY, items: { type: Type.STRING } },
            speaker_notes: { type: Type.STRING },
            layout: { type: Type.STRING, enum: ['title', 'content', 'split', 'quote'] }
          },
          required: ["title", "content", "speaker_notes", "layout"]
        }
      }
    }
  });

  return JSON.parse(response.text);
}

export async function analyzeConfusion(query: string, projectId: string) {
  const context = await getProjectContext(projectId);
  const prompt = `The user is confused about: "${query}".
  Based on the project context, provide a clear, simplified explanation that directly addresses the confusion.
  Include:
  - A simple analogy
  - A step-by-step breakdown
  - A "Wait, I still don't get it" section with an even simpler explanation
  
  CONTEXT:\n${context}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
}

export async function conceptBattle(query: string | undefined, projectId: string, concepts?: [string, string]) {
  const context = await getProjectContext(projectId);
  const prompt = concepts 
    ? `Start a "Concept Battle" between these two specific concepts: "${concepts[0]}" and "${concepts[1]}".
       Use the project context to provide a deep comparison.`
    : `Start a "Concept Battle" based on the following query: "${query}".
       Identify two related but distinct concepts from the project context and compare them in a "battle" format.`;
  
  const fullPrompt = `${prompt}
  
  Return the response in JSON format matching this schema:
  {
    "concepts": [string, string],
    "comparison": [
      { "feature": string, "concept1": string, "concept2": string }
    ],
    "analogy": string,
    "scenario": string,
    "quiz_question": {
      "question": string,
      "options": [string],
      "correct_answer": string,
      "explanation": string
    }
  }
  
  CONTEXT:\n${context}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: fullPrompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text);
}
