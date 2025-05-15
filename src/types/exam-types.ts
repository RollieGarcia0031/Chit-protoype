// src/types/exam-types.ts
import type { Timestamp } from "firebase/firestore";

export interface Option {
  id: string;
  text: string;
  isCorrect: boolean; // Used for multiple choice to indicate the correct answer
}

export interface PoolOption { // Specifically for choice pools, no 'isCorrect' here
  id: string;
  text: string;
}

export interface BaseQuestion {
  id: string; // Unique ID for each question
  questionText: string;
  points: number; // Points for this question
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
  responseLetter?: string;
}

export interface MatchingTypeQuestion extends BaseQuestion {
  type: 'matching';
  pairs: MatchingPair[];
}

export interface PooledChoicesQuestion extends BaseQuestion {
  type: 'pooled-choices';
  // Stores the TEXT of the choices selected from the pool as correct for THIS question.
  // Assumes choice texts within a pool are unique for simplicity when checking answers.
  correctAnswersFromPool: string[]; // Array of choice texts that are correct for this question
}

export type ExamQuestion = MultipleChoiceQuestion | TrueFalseQuestion | MatchingTypeQuestion | PooledChoicesQuestion;

export type QuestionType = ExamQuestion['type'];

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'true-false', label: 'True/False' },
  { value: 'matching', label: 'Matching Type' },
  { value: 'pooled-choices', label: 'Pooled Choices' },
];

// Interface for a block of questions
export interface ExamBlock {
  id: string;
  blockType: QuestionType;
  questions: ExamQuestion[];
  blockTitle?: string; // Optional title/instructions for the entire block
  choicePool?: PoolOption[]; // Used for 'pooled-choices' blockType
}

// Interface for summary data shown in lists
export interface ExamSummaryData {
  id: string;
  title: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  totalQuestions: number;
  totalPoints: number;
  status: "Draft" | "Published" | "Archived";
}

// Interface for the full exam data including blocks and questions
export interface FullExamData extends ExamSummaryData {
    examBlocks: ExamBlock[];
}
