// src/app/(protected)/render-exam/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Loader2, AlertTriangle, DownloadCloud, CalendarDays, HelpCircle, Star } from "lucide-react";
import { useEffect, useState } from "react";
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

interface FullExamData extends ExamSummaryData {
    examBlocks: ExamBlock[];
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
      querySnapshot.forEach((doc) => {
        fetchedExams.push({ id: doc.id, ...doc.data() } as ExamSummaryData);
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

  const handleGenerateDocx = async () => {
    if (!user || !selectedExamForDialog) {
        toast({ title: "Error", description: "No exam selected or user not authenticated.", variant: "destructive" });
        return;
    }
    setIsGeneratingDocx(selectedExamForDialog.id);
    
    try {
        // Fetch full exam data
        const examDocRef = doc(db, EXAMS_COLLECTION_NAME, selectedExamForDialog.id);
        const examSnap = await getDoc(examDocRef);

        if (!examSnap.exists() || examSnap.data().userId !== user.uid) {
          toast({ title: "Error", description: "Exam not found or permission denied.", variant: "destructive" });
          setIsGeneratingDocx(null);
          setIsConfirmDialogOpen(false);
          return;
        }

        const examData = examSnap.data() as Omit<FullExamData, 'id' | 'examBlocks'>;
        const loadedBlocks: ExamBlock[] = [];
        const blocksCollectionRef = collection(db, EXAMS_COLLECTION_NAME, selectedExamForDialog.id, "questionBlocks");
        const blocksQuery = query(blocksCollectionRef, orderBy("orderIndex"));
        const blocksSnapshot = await getDocs(blocksQuery);

        for (const blockDoc of blocksSnapshot.docs) {
          const blockData = blockDoc.data();
          const loadedQuestions: ExamQuestion[] = [];
          const questionsCollectionRef = collection(db, EXAMS_COLLECTION_NAME, selectedExamForDialog.id, "questionBlocks", blockDoc.id, "questions");
          const questionsQuery = query(questionsCollectionRef, orderBy("orderIndex"));
          const questionsSnapshot = await getDocs(questionsQuery);

          questionsSnapshot.forEach(questionDocSnap => {
            const qData = questionDocSnap.data();
            let question: ExamQuestion;
            switch (qData.type as QuestionType) {
              case 'multiple-choice':
                question = {
                  id: questionDocSnap.id,
                  questionText: qData.questionText,
                  points: qData.points,
                  type: 'multiple-choice',
                  options: (qData.options || []).map((opt: any) => ({ ...opt })),
                } as MultipleChoiceQuestion;
                break;
              case 'true-false':
                question = {
                  id: questionDocSnap.id,
                  questionText: qData.questionText,
                  points: qData.points,
                  type: 'true-false',
                  correctAnswer: qData.correctAnswer === undefined ? null : qData.correctAnswer,
                } as TrueFalseQuestion;
                break;
              case 'matching':
                question = {
                  id: questionDocSnap.id,
                  questionText: qData.questionText,
                  points: qData.points,
                  type: 'matching',
                  pairs: (qData.pairs || []).map((p: any) => ({ ...p})),
                } as MatchingTypeQuestion;
                break;
              default: 
                question = { id: questionDocSnap.id, questionText: "Unknown question type", points: 0, type: 'multiple-choice', options: []};
            }
            loadedQuestions.push(question);
          });
          loadedBlocks.push({
            id: blockDoc.id, 
            blockType: blockData.blockType,
            blockTitle: blockData.blockTitle || "",
            questions: loadedQuestions,
          });
        }
        
        const fullExamData: FullExamData = {
            ...examData,
            id: selectedExamForDialog.id,
            title: selectedExamForDialog.title, // Ensure title from summary is used
            description: selectedExamForDialog.description,
            createdAt: selectedExamForDialog.createdAt,
            updatedAt: selectedExamForDialog.updatedAt,
            totalQuestions: selectedExamForDialog.totalQuestions,
            totalPoints: selectedExamForDialog.totalPoints,
            status: selectedExamForDialog.status,
            examBlocks: loadedBlocks,
        };

        console.log("Full Exam Data for DOCX generation:", fullExamData);
        toast({
            title: "DOCX Generation (Placeholder)",
            description: `DOCX generation for "${selectedExamForDialog.title}" is not yet implemented. Full exam data has been logged to the console.`,
            duration: 5000,
        });

    } catch (error) {
        console.error("Error fetching full exam data for DOCX:", error);
        toast({ title: "Error", description: "Could not fetch full exam data for DOCX generation.", variant: "destructive"});
    } finally {
        setIsGeneratingDocx(null);
        setIsConfirmDialogOpen(false);
        setSelectedExamForDialog(null);
    }
  };

  if (authLoading || isLoadingExams) {
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Oops! Something went wrong.</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchExams}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight flex items-center">
            <FileText className="mr-3 h-8 w-8 text-primary" />
            Render Exam to DOCX
          </CardTitle>
          <CardDescription>
            Select an exam from the list below to generate a DOCX file.
            The generated file will contain the exam title, description, and all questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Title</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell>{format(exam.createdAt.toDate(), "PPP")}</TableCell>
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
                        Generate DOCX
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
                Showing {exams.length} exam{exams.length === 1 ? '' : 's'} available for DOCX generation.
            </CardFooter>
        )}
      </Card>

      {selectedExamForDialog && (
        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm DOCX Generation</AlertDialogTitle>
                    <AlertDialogDescription>
                    Please review the exam details before generating the DOCX file.
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
                        onClick={handleGenerateDocx}
                        disabled={isGeneratingDocx === selectedExamForDialog.id}
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
