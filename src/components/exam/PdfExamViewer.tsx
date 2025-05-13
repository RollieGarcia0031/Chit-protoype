'use client';

import { useState, useEffect } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { ExamPDFDocument } from '@/components/exam/ExamPDFDocument';
import type { FullExamData } from '@/types/exam-types';
import { Loader2 } from 'lucide-react';

interface PdfExamViewerProps {
  exam: FullExamData;
}

export default function PdfExamViewer({ exam }: PdfExamViewerProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading PDF Document...</p>
      </div>
    );
  }

  if (!exam) {
    return (
         <div className="flex items-center justify-center h-full w-full">
            <Loader2 className="h-8 w-8 animate-spin text-destructive" />
            <p className="ml-2 text-destructive-foreground">Error: Exam data is not available.</p>
        </div>
    );
  }

  return (
    <PDFViewer width="100%" height="100%" showToolbar={false}>
      <ExamPDFDocument exam={exam} />
    </PDFViewer>
  );
}
