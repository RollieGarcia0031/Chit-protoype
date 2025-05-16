// src/app/take-exam/submission-success/layout.tsx
import type { Metadata } from 'next';

// This layout is minimal and specific to the submission success page.
// Global styles and fonts are inherited from the root layout via the segment specific layout.

export const metadata: Metadata = {
  title: 'Submission Successful - Chit',
  description: 'Your exam submission has been recorded.',
};

export default function SubmissionSuccessLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The <html> and <body> tags are rendered by the parent /app/layout.tsx
  // This layout just passes through its children within the minimal take-exam shell.
  return <>{children}</>;
}
