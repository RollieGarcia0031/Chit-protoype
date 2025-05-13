'use client';
import { PDFViewer } from '@react-pdf/renderer';
import { useState, useEffect } from 'react';
import { ExamPDFDocument } from '@/components/exam/ExamPDFDocument';
import type { FullExamData } from '@/types/exam-types';
import { Loader2, Info } from 'lucide-react'; // Added Info icon

interface PdfExamViewerProps {
  exam: FullExamData | null; // Prop can be null
}

export default function PdfExamViewer({ exam }: PdfExamViewerProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-card">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading PDF Previewer...</p>
      </div>
    );
  }

  if (!exam) { // Check if exam data is actually available
    return (
         <div className="flex items-center justify-center h-full w-full bg-card">
            <Info className="h-8 w-8 text-muted-foreground" /> {/* Using Info icon for missing data */}
            <p className="ml-2 text-muted-foreground">Exam data not available for preview.</p>
        </div>
    );
  }

  // PDFViewer is only rendered if isClient is true AND exam data is present
  return (
    <PDFViewer width="100%" height="100%" showToolbar={false} style={{ border: 'none' }}>
      <ExamPDFDocument exam={exam} />
    </PDFViewer>
  );
}
