// src/app/take-exam/submission-success/page.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function SubmissionSuccessPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50 dark:bg-slate-900">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">
            Exam Submitted Successfully!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-sm sm:text-base text-muted-foreground">
            Your answers have been recorded. You may now close this window.
          </CardDescription>
        </CardContent>
        {/* Optional: Add a button to navigate somewhere, e.g., if there's a public home page */}
        {/* <CardFooter className="justify-center">
          <Button asChild variant="outline">
            <Link href="/">Return to Home</Link>
          </Button>
        </CardFooter> */}
      </Card>
    </main>
  );
}
