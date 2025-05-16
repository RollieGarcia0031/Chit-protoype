
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import '../globals.css'; // Adjusted path to globals.css

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
          This layout is intentionally minimal. 
          It does not include the main AppSidebar, AppTopBar, or AppFooter.
          It also omits AuthProvider and Toaster for now, assuming the exam page
          is self-contained and doesn't require these global contexts.
          If these are needed later, they can be added here.
        */}
        {children}
      </body>
    </html>
  );
}
