
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import '../globals.css'; // This path assumes globals.css is in src/app/

export const metadata: Metadata = {
  title: 'Take Exam - Chit',
  description: 'Take your scheduled exam.',
};

export default function TakeExamLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body className="antialiased bg-slate-50 dark:bg-slate-900">
        {/*
          This layout is intentionally minimal for the exam-taking experience.
          It does NOT include the main AppSidebar, AppTopBar, or AppFooter.
          It also omits AuthProvider and Toaster for now, assuming the exam page
          is self-contained and doesn't require these global contexts.
        */}
        {children}
      </body>
    </html>
  );
}
