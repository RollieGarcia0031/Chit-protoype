// src/types/exam-types.ts
export interface Option {
  id: string;
  text: string;
  isCorrect: boolean; // Used for multiple choice to indicate the correct answer
}

export interface BaseQuestion {
  id: string; // Unique ID for each question
  questionText: string;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice';
  options: Option[];
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: 'true-false';
  correctAnswer: boolean | null; // true for True, false for False
}

export interface MatchingPair {
  id: string;
  premise: string;
  response: string;
}

export interface MatchingTypeQuestion extends BaseQuestion {
  type: 'matching'; // questionText can be an overall instruction for the matching block
  pairs: MatchingPair[];
}

export type ExamQuestion = MultipleChoiceQuestion | TrueFalseQuestion | MatchingTypeQuestion;

export type QuestionType = ExamQuestion['type'];

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'true-false', label: 'True/False' },
  { value: 'matching', label: 'Matching Type' },
];

// New interface for a block of questions
export interface ExamBlock {
  id: string;
  blockType: QuestionType;
  questions: ExamQuestion[];
  blockTitle?: string; // Optional title/instructions for the entire block
}
