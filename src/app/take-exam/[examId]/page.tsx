
// src/app/take-exam/[examId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { EXAMS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { ExamSummaryData } from '@/types/exam-types'; // Assuming you have this type
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, AlertTriangle } from 'lucide-react';

export default function TakeExamPage() {
  const params = useParams();
  const examId = params.examId as string;
  const [examDetails, setExamDetails] = useState<ExamSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (examId) {
      const fetchExamDetails = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const examDocRef = doc(db, EXAMS_COLLECTION_NAME, examId);
          const examSnap = await getDoc(examDocRef);
          if (examSnap.exists()) {
            setExamDetails({ id: examSnap.id, ...examSnap.data() } as ExamSummaryData);
          } else {
            setError("Exam not found. The link may be invalid or the exam may have been removed.");
          }
        } catch (e) {
          console.error("Error fetching exam details:", e);
          setError("An error occurred while trying to load the exam.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchExamDetails();
    } else {
      setError("No exam ID provided.");
      setIsLoading(false);
    }
  }, [examId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader className="text-center">
            <Skeleton className="h-8 w-3/4 mx-auto mb-2" />
            <Skeleton className="h-5 w-1/2 mx-auto" />
          </CardHeader>
          <CardContent className="py-10 text-center">
            <Skeleton className="h-6 w-1/3 mx-auto mb-4" />
            <Skeleton className="h-10 w-1/2 mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
        <p className="text-muted-foreground max-w-md">{error}</p>
        {/* Optionally, add a button to go back or to a home page */}
      </div>
    );
  }
  
  if (!examDetails) {
    // This case should ideally be covered by the error state, but as a fallback:
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Exam Not Available</h1>
        <p className="text-muted-foreground">The requested exam could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50 dark:bg-slate-900">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">
            {examDetails.title}
          </CardTitle>
          {examDetails.description && (
            <CardDescription className="text-sm sm:text-base text-muted-foreground mt-2">
              {examDetails.description}
            </CardDescription>
          )}
           <CardDescription className="text-xs sm:text-sm text-muted-foreground/80 mt-1">
             Total Points: {examDetails.totalPoints} | Total Questions: {examDetails.totalQuestions}
            </CardDescription>
        </CardHeader>
        <CardContent className="py-8 sm:py-10 text-center">
          <p className="text-lg sm:text-xl text-foreground mb-6">
            This is where the exam questions will be rendered for the student.
          </p>
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Start Exam (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
