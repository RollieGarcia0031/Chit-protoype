// src/app/(protected)/render-exam/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, AlertTriangle, DownloadCloud, CalendarDays, HelpCircle, Star, FileType2, ArrowLeft } from "lucide-react";
import { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, Timestamp, orderBy, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { EXAMS_COLLECTION_NAME } from "@/config/firebase-constants";
import type { ExamBlock, ExamQuestion, QuestionType, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion } from "@/types/exam-types";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { Packer, Document as DocxDocument, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopPosition, TabStopType } from 'docx';
import { saveAs } from 'file-saver';
import { PDFViewer } from '@react-pdf/renderer';
import { ExamPDFDocument } from '@/components/exam/ExamPDFDocument';


interface ExamSummaryData {
  id: string;
  title: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  totalQuestions: number;
  totalPoints: number;
  status: "Draft" | "Published" | "Archived";
}

export interface FullExamData extends ExamSummaryData {
    examBlocks: ExamBlock[];
}


const getAlphabetLetter = (index: number): string => String.fromCharCode(65 + index);

const toRoman = (num: number): string => {
  if (num < 1 || num > 3999) return String(num); 
  const romanNumerals: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  let n = num;
  for (const [value, symbol] of romanNumerals) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
};

function PdfExamPreview({ exam, onBack }: { exam: FullExamData; onBack: () => void }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl font-semibold">Exam Preview: {exam.title}</CardTitle>
          <CardDescription>This is a preview of the exam content. DOCX download will start automatically.</CardDescription>
        </div>
        <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
        </Button>
      </CardHeader>
      <CardContent className="h-[calc(100vh-250px)] min-h-[600px]">
        {isClient ? (
            <PDFViewer width="100%" height="100%" showToolbar={false}>
              <ExamPDFDocument exam={exam} />
            </PDFViewer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading PDF preview...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


export default function RenderExamPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [exams, setExams] = useState<ExamSummaryData[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isGeneratingDocx, setIsGeneratingDocx] = useState<string | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedExamForDialog, setSelectedExamForDialog] = useState<ExamSummaryData | null>(null);

  const [examForPreview, setExamForPreview] = useState<FullExamData | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);


  const fetchExams = async () => {
    if (!user) {
      setIsLoadingExams(false);
      return;
    }
    setIsLoadingExams(true);
    setError(null);
    try {
      const examsCollectionRef = collection(db, EXAMS_COLLECTION_NAME);
      const q = query(examsCollectionRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedExams: ExamSummaryData[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedExams.push({ 
            id: docSnap.id, 
            title: data.title || "Untitled Exam",
            description: data.description,
            createdAt: data.createdAt || Timestamp.now(),
            updatedAt: data.updatedAt || Timestamp.now(),
            totalQuestions: data.totalQuestions || 0,
            totalPoints: data.totalPoints || 0,
            status: data.status || "Draft",
        } as ExamSummaryData);
      });
      setExams(fetchedExams);
    } catch (e) {
      console.error("Error fetching exams: ", e);
      setError("Failed to load exams. Please try again.");
      toast({
        title: "Error",
        description: "Could not fetch exams.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingExams(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchExams();
    } else if (!authLoading && !user) {
      setIsLoadingExams(false);
      setExams([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const handleOpenConfirmDialog = (exam: ExamSummaryData) => {
    setSelectedExamForDialog(exam);
    setIsConfirmDialogOpen(true);
  };
  
  const handleGenerateAndDownloadDocx = async () => {
    if (!user || !selectedExamForDialog || !selectedExamForDialog.id) {
        toast({ title: "Error", description: "No exam selected or user not authenticated.", variant: "destructive" });
        setIsConfirmDialogOpen(false);
        setSelectedExamForDialog(null);
        return;
    }
    setIsGeneratingDocx(selectedExamForDialog.id);
    
    try {
        const examDocRef = doc(db, EXAMS_COLLECTION_NAME, selectedExamForDialog.id);
        const examSnap = await getDoc(examDocRef);

        if (!examSnap.exists()) {
          toast({ title: "Error", description: "Exam not found.", variant: "destructive" });
          throw new Error("Exam not found");
        }
        
        const firestoreExamData = examSnap.data();
        if (firestoreExamData.userId !== user.uid) {
            toast({ title: "Error", description: "Permission denied.", variant: "destructive" });
            throw new Error("Permission denied");
        }

        const examDataFromSummary = selectedExamForDialog;
        const examBaseData = firestoreExamData as Omit<FullExamData, 'id' | 'examBlocks'>;

        const loadedBlocks: ExamBlock[] = [];
        const blocksCollectionRef = collection(db, EXAMS_COLLECTION_NAME, selectedExamForDialog.id, "questionBlocks");
        const blocksQuery = query(blocksCollectionRef, orderBy("orderIndex"));
        const blocksSnapshot = await getDocs(blocksQuery);

        for (const blockDoc of blocksSnapshot.docs) {
          const blockData = blockDoc.data();
          if (typeof blockData !== 'object' || blockData === null) continue;

          const loadedQuestions: ExamQuestion[] = [];
          const questionsCollectionRef = collection(db, EXAMS_COLLECTION_NAME, selectedExamForDialog.id, "questionBlocks", blockDoc.id, "questions");
          const questionsQuery = query(questionsCollectionRef, orderBy("orderIndex"));
          const questionsSnapshot = await getDocs(questionsQuery);

          questionsSnapshot.forEach(questionDocSnap => {
            const qData = questionDocSnap.data();
            if (typeof qData !== 'object' || qData === null) return;

            let question: ExamQuestion | null = null;
            const baseQuestionProps = {
                id: questionDocSnap.id,
                questionText: String(qData.questionText || ""),
                points: Number(qData.points || 0),
            };

            switch (qData.type as QuestionType) {
              case 'multiple-choice':
                question = {
                  ...baseQuestionProps,
                  type: 'multiple-choice',
                  options: (qData.options || []).map((opt: any) => ({ 
                      id: String(opt.id || `opt-${Math.random()}`),
                      text: String(opt.text || ""),
                      isCorrect: Boolean(opt.isCorrect || false)
                    })),
                } as MultipleChoiceQuestion;
                break;
              case 'true-false':
                question = {
                  ...baseQuestionProps,
                  type: 'true-false',
                  correctAnswer: qData.correctAnswer === undefined ? null : Boolean(qData.correctAnswer),
                } as TrueFalseQuestion;
                break;
              case 'matching':
                question = {
                  ...baseQuestionProps,
                  type: 'matching',
                  pairs: (qData.pairs || []).map((p: any) => ({ 
                      id: String(p.id || `pair-${Math.random()}`),
                      premise: String(p.premise || ""),
                      response: String(p.response || ""), 
                    })),
                } as MatchingTypeQuestion;
                break;
              default: 
                question = { ...baseQuestionProps, type: 'multiple-choice', options: []}; 
            }
            if(question) loadedQuestions.push(question);
          });
          loadedBlocks.push({
            id: blockDoc.id, 
            blockType: blockData.blockType || 'multiple-choice', 
            blockTitle: String(blockData.blockTitle || ""),
            questions: loadedQuestions,
          });
        }
        
        const examToDownloadAndPreview: FullExamData = {
            id: selectedExamForDialog.id, 
            title: String(examBaseData.title || examDataFromSummary.title || "Untitled Exam"), 
            description: String(examBaseData.description || examDataFromSummary.description || ""),
            createdAt: examBaseData.createdAt || examDataFromSummary.createdAt || Timestamp.now(),
            updatedAt: examBaseData.updatedAt || examDataFromSummary.updatedAt || Timestamp.now(),
            totalQuestions: Number(examBaseData.totalQuestions || examDataFromSummary.totalQuestions || 0),
            totalPoints: Number(examBaseData.totalPoints || examDataFromSummary.totalPoints || 0),
            status: (examBaseData.status || examDataFromSummary.status || "Draft") as FullExamData['status'],
            examBlocks: loadedBlocks,
        };
        
        setExamForPreview(examToDownloadAndPreview); 
        setShowPdfPreview(true); 

        // --- DOCX Generation Logic ---
        let questionCounter = 0;
        const children = [
            new Paragraph({
                text: String(examToDownloadAndPreview.title),
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
            }),
        ];

        if (examToDownloadAndPreview.description) {
            children.push(new Paragraph({ 
                children: [new TextRun({ text: String(examToDownloadAndPreview.description), italics: true })],
                alignment: AlignmentType.CENTER, 
                spacing: { after: 200 }
            }));
        }
        children.push(new Paragraph({
            children: [
                new TextRun(`Total Questions: ${examToDownloadAndPreview.totalQuestions}\t\tTotal Points: ${examToDownloadAndPreview.totalPoints}\t\tStatus: ${String(examToDownloadAndPreview.status)}`),
            ],
            tabStops: [
                { type: TabStopType.RIGHT, position: TabStopPosition.MAX / 2 },
                { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
            ],
            style: "compact",
            spacing: { after: 300 }
        }));


        (examToDownloadAndPreview.examBlocks).forEach((block, blockIndex) => {
            children.push(new Paragraph({
                text: `${toRoman(blockIndex + 1)}${block.blockTitle ? `: ${String(block.blockTitle)}` : ''}`,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }));

            (block.questions).forEach((question) => {
                questionCounter++;
                const questionPrefix = question.type === 'true-false' ? '____ ' : '';
                children.push(new Paragraph({
                    children: [
                        new TextRun(`${questionPrefix}${questionCounter}. ${String(question.questionText)} `),
                        new TextRun({ text: `(${String(question.points)} pts)`, size: 18, color: "555555" }),
                    ],
                    indent: { left: 720 }, 
                    spacing: { after: 80 }
                }));

                if (question.type === 'multiple-choice') {
                    ((question as MultipleChoiceQuestion).options).forEach((opt, optIndex) => {
                        children.push(new Paragraph({
                            text: `${getAlphabetLetter(optIndex)}. ${String(opt.text)}`,
                            indent: { left: 1080 }, 
                        }));
                    });
                } else if (question.type === 'matching') {
                    ((question as MatchingTypeQuestion).pairs).forEach((pair, pairIndex) => {
                         children.push(new Paragraph({
                            text: `${pairIndex + 1}. ${String(pair.premise)}\t\t____________________`,
                            indent: { left: 1080 },
                            tabStops: [
                                { type: TabStopType.LEFT, position: 2880 }, 
                            ],
                        }));
                    });
                }
                children.push(new Paragraph({ text: ""}));
            });
        });
        
        const wordDocument = new DocxDocument({
            sections: [{ children }],
            styles: {
                paragraphStyles: [
                    {
                        id: "compact",
                        name: "Compact",
                        basedOn: "Normal",
                        quickFormat: true,
                        paragraph: {
                            spacing: { line: 240 } 
                        }
                    }
                ]
            }
        });

        const blob = await Packer.toBlob(wordDocument);
        saveAs(blob, `${String(examToDownloadAndPreview.title).replace(/[^a-z0-9]/gi, '_').toLowerCase()}_exam.docx`);
        toast({ title: "Download Started", description: `"${String(examToDownloadAndPreview.title)}.docx" is downloading.` });

    } catch (error) {
        console.error("Error generating DOCX and setting up preview:", error);
        toast({ title: "Operation Failed", description: "Could not generate DOCX or prepare preview.", variant: "destructive" });
        setShowPdfPreview(false);
        setExamForPreview(null);
    } finally {
        setIsGeneratingDocx(null);
        setIsConfirmDialogOpen(false);
        setSelectedExamForDialog(null);
    }
  };

  const handleBackToList = () => {
    setShowPdfPreview(false);
    setExamForPreview(null);
  };


  if (authLoading || (isLoadingExams && !showPdfPreview)) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-7 w-32 mb-1" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]"><Skeleton className="h-5 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                  <TableHead className="text-center"><Skeleton className="h-5 w-16" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-5 w-28" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-9 w-36 inline-block" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !showPdfPreview) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Oops! Something went wrong.</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchExams}>Try Again</Button>
      </div>
    );
  }

  if (showPdfPreview && examForPreview) {
    return <PdfExamPreview exam={examForPreview} onBack={handleBackToList} />;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight flex items-center">
            <FileType2 className="mr-3 h-8 w-8 text-primary" />
            Render Exam to DOCX
          </CardTitle>
          <CardDescription>
            Select an exam from the list below to generate a DOCX file and preview its content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden md:table-cell">Date Created</TableHead>
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                       <Badge variant={exam.status === 'Published' ? 'default' : exam.status === 'Draft' ? 'secondary' : 'outline'}
                        className={exam.status === 'Archived' ? 'bg-muted text-muted-foreground' : ''}>
                           {exam.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{format(exam.createdAt.toDate(), "PPP")}</TableCell>
                    <TableCell className="text-center">{exam.totalQuestions}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenConfirmDialog(exam)}
                        disabled={isGeneratingDocx === exam.id}
                      >
                        {isGeneratingDocx === exam.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <DownloadCloud className="mr-2 h-4 w-4" />
                        )}
                        Generate & Preview
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-lg">No exams available to render.</p>
              <p className="text-sm text-muted-foreground">
                Create an exam first, then come back here to generate a DOCX file.
              </p>
              <Button asChild className="mt-4">
                <Link href="/create-exam">Create New Exam</Link>
              </Button>
            </div>
          )}
        </CardContent>
        {exams.length > 0 && (
            <CardFooter className="text-sm text-muted-foreground">
                Showing {exams.length} exam{exams.length === 1 ? '' : 's'} available for rendering.
            </CardFooter>
        )}
      </Card>

      {selectedExamForDialog && (
        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm DOCX Generation & Preview</AlertDialogTitle>
                    <AlertDialogDescription>
                    This will generate a DOCX file for the exam: "{selectedExamForDialog.title}" and show a preview.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3 py-2 text-sm">
                    <div className="flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-primary" />
                        <strong>Title:</strong> <span className="ml-1">{selectedExamForDialog.title}</span>
                    </div>
                    {selectedExamForDialog.description && (
                        <div className="flex items-start">
                           <HelpCircle className="h-5 w-5 mr-2 text-muted-foreground flex-shrink-0 mt-0.5" />
                           <div>
                             <strong>Description:</strong>
                             <p className="ml-1 text-muted-foreground text-xs">{selectedExamForDialog.description}</p>
                           </div>
                        </div>
                    )}
                    <div className="flex items-center">
                        <CalendarDays className="h-5 w-5 mr-2 text-muted-foreground" />
                        <strong>Created:</strong> <span className="ml-1">{format(selectedExamForDialog.createdAt.toDate(), "PPP p")}</span>
                    </div>
                     <div className="flex items-center">
                        <CalendarDays className="h-5 w-5 mr-2 text-muted-foreground" />
                        <strong>Last Updated:</strong> <span className="ml-1">{format(selectedExamForDialog.updatedAt.toDate(), "PPP p")}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4">
                        <div className="flex items-center">
                            <HelpCircle className="h-5 w-5 mr-2 text-muted-foreground" />
                            <strong>Questions:</strong> <span className="ml-1">{selectedExamForDialog.totalQuestions}</span>
                        </div>
                        <div className="flex items-center">
                            <Star className="h-5 w-5 mr-2 text-muted-foreground" />
                            <strong>Total Points:</strong> <span className="ml-1">{selectedExamForDialog.totalPoints}</span>
                        </div>
                    </div>
                     <div className="flex items-center">
                        <HelpCircle className="h-5 w-5 mr-2 text-muted-foreground" />
                        <strong>Status:</strong> <span className="ml-1">{selectedExamForDialog.status}</span>
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isGeneratingDocx === selectedExamForDialog.id} onClick={() => setSelectedExamForDialog(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleGenerateAndDownloadDocx}
                        disabled={isGeneratingDocx === selectedExamForDialog.id || !selectedExamForDialog.id}
                    >
                        {isGeneratingDocx === selectedExamForDialog.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm & Generate
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
