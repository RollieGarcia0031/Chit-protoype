
// src/app/take-exam/[examId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { EXAMS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { ExamSummaryData } from '@/types/exam-types'; 
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
            // Future: Add check here if exam status is 'Published' 
            // and if current time is within assignedDateTime for the relevant class.
            // For now, we load it if it exists.
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
      <main className="flex flex-col items-center justify-center min-h-screen p-4">
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
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
        <p className="text-muted-foreground max-w-md">{error}</p>
      </main>
    );
  }
  
  if (!examDetails) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Exam Not Available</h1>
        <p className="text-muted-foreground">The requested exam could not be loaded or is not available.</p>
      </main>
    );
  }

  // Placeholder for more sophisticated status/access checks
  // if (examDetails.status !== 'Published') {
  //   return (
  //     <main className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
  //       <FileText className="h-16 w-16 text-muted-foreground mb-4" />
  //       <h1 className="text-2xl font-bold mb-2">Exam Not Active</h1>
  //       <p className="text-muted-foreground">This exam is not currently active.</p>
  //     </main>
  //   );
  // }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
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
            Exam questions will be rendered here. (Feature coming soon)
          </p>
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Start Exam (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
