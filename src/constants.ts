import { AcademicMode } from './types';

export const ACADEMIC_MODES: { value: AcademicMode; label: string; description: string }[] = [
  { 
    value: 'kid', 
    label: 'Kid Mode', 
    description: 'Simple words and fun analogies for young learners.' 
  },
  { 
    value: 'teen', 
    label: 'Teen Mode', 
    description: 'Relatable examples for high school students.' 
  },
  { 
    value: 'undergraduate', 
    label: 'Undergraduate', 
    description: 'Academic depth for university level studies.' 
  },
  { 
    value: 'exam', 
    label: 'Exam Mode', 
    description: 'Structured answers optimized for WAEC/JAMB marks.' 
  },
  { 
    value: 'deep_academic', 
    label: 'Deep Academic', 
    description: 'Rigorous research-level analysis and technical depth.' 
  },
];

export const MNEMONIC_STYLES = [
  { value: 'acronym', label: 'Acronym' },
  { value: 'story', label: 'Story-based' },
  { value: 'funny', label: 'Funny' },
  { value: 'academic', label: 'Academic' },
  { value: 'african', label: 'African-themed' },
];
