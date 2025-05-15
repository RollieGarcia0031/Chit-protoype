
// src/types/exam-types.ts
import type { Timestamp } from "firebase/firestore";

export interface Option {
  id: string;
  text: string;
  isCorrect: boolean; // Used for multiple choice to indicate the correct answer
}

export interface PoolOption { // Specifically for choice pools
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
  correctAnswersFromPool: string[];
}

export type ExamQuestion = MultipleChoiceQuestion | TrueFalseQuestion | MatchingTypeQuestion | PooledChoicesQuestion;

export type QuestionType = ExamQuestion['type'];

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'true-false', label: 'True/False' },
  { value: 'matching', label: 'Matching Type' },
  { value: 'pooled-choices', label: 'Pooled Choices' },
];

export interface ExamBlock {
  id: string;
  blockType: QuestionType;
  questions: ExamQuestion[];
  blockTitle?: string;
  choicePool?: PoolOption[];
}

export interface ExamSummaryData {
  id: string;
  title: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  totalQuestions: number;
  totalPoints: number;
  status: "Draft" | "Published" | "Archived";
  classId?: string; // ID of the class this exam is associated with
}

export interface FullExamData extends ExamSummaryData {
    examBlocks: ExamBlock[];
    // classId is inherited from ExamSummaryData
}

// This type is used in student/page.tsx and will be used in create-exam/page.tsx
export interface ClassInfoForDropdown {
  id: string; // classId from Firestore
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  sectionName: string;
  yearGrade: string;
  code: string; // class code (specific to the class instance)
}

export interface FetchedSubjectInfo {
  id: string;
  name: string;
  code: string;
}
