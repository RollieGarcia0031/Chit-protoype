
// src/app/take-exam/layout.tsx

// This layout is now significantly simplified because RootLayout handles the shell switching.
// It still exists to define segment-specific metadata.

import type { Metadata } from 'next';
// We don't need to import GeistSans or globals.css here if RootLayout handles it.

export const metadata: Metadata = {
  title: 'Take Exam - Chit',
  description: 'Take your scheduled exam.',
};

export default function TakeExamLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The <html> and <body> tags are now rendered by the RootLayout.
  // This layout just passes through its children.
  // Specific styling for the take-exam body is handled in RootLayout's conditional className.
  return <>{children}</>;
}
