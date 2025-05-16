
// src/app/take-exam/[examId]/answer-sheet/layout.tsx
import type { Metadata } from 'next';

// This layout is minimal and specific to the answer sheet.
// Global styles and fonts are inherited from the root layout via the segment specific layout.

export const metadata: Metadata = {
  title: 'Answer Sheet - Chit',
  description: 'Complete your exam.',
};

export default function AnswerSheetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The <html> and <body> tags are rendered by the parent /take-exam/layout.tsx
  // This layout just passes through its children.
  return <>{children}</>;
}
