export type AcademicMode = 'kid' | 'teen' | 'undergraduate' | 'exam' | 'deep_academic';

export interface ExplanationResponse {
  explanation: string;
  example: string;
  self_test: string;
  confidence_score: 'Low' | 'Medium' | 'High';
}

export interface TunedQuestionResponse {
  is_ambiguous: boolean;
  ambiguity_details: string | null;
  improved_question: string;
  clarification_needed: string | null;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'fill_blank';
  question: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
}

export interface MnemonicResponse {
  mnemonic: string;
  explanation: string;
}

export interface ConceptBattleResponse {
  concepts: [string, string];
  comparison: {
    feature: string;
    concept1: string;
    concept2: string;
  }[];
  analogy: string;
  scenario: string;
  quiz_question: {
    question: string;
    options: string[];
    correct_answer: string;
    explanation: string;
  } | null;
}

export interface UserProfile {
  id: string;
  full_name: string;
  academic_level: string;
  study_streak: number;
}

export interface ExamQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'theory' | 'concept_trap';
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  concept: string;
  trap_details?: string;
}

export interface Exam {
  id: string;
  title: string;
  questions: ExamQuestion[];
  time_limit: number; // in minutes
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  project_id: string;
  user_id: string;
  score: number;
  total_questions: number;
  answers: Record<string, {
    answer: string;
    is_correct: boolean;
    response_time: number;
    confidence?: number;
  }>;
  analysis?: {
    overall_score: number;
    topic_mastery: Record<string, number>;
    weak_concepts: string[];
    misconceptions: string[];
    recommendations: string[];
  };
  created_at: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  content: string;
  formulas?: string[];
  definitions?: { term: string; definition: string }[];
  examples?: string[];
  practice_questions: QuizQuestion[];
  visual_prompt?: string;
  mnemonics?: MnemonicResponse[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  lessons: CourseLesson[];
}

export interface Course {
  id: string;
  project_id: string;
  title: string;
  description: string;
  modules: CourseModule[];
  created_at: string;
}

export interface CourseProgress {
  id: string;
  course_id: string;
  user_id: string;
  completed_lessons: string[];
  quiz_scores: Record<string, number>;
}

export interface StudyReminder {
  id: string;
  user_id: string;
  project_id: string;
  topic: string;
  scheduled_time: string; // ISO string
  status: 'pending' | 'sent' | 'cancelled';
  created_at: string;
}

export interface SavedQuestion extends QuizQuestion {
  project_id: string;
  user_id: string;
  saved_at: string;
}
