
// src/app/(protected)/render-exam/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, AlertTriangle, DownloadCloud, CalendarDays, HelpCircle, Star, FileType2, ArrowLeft, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, Timestamp, orderBy, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { EXAMS_COLLECTION_NAME } from "@/config/firebase-constants";
import type { FullExamData, ExamSummaryData, ExamBlock, ExamQuestion, QuestionType, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion } from "@/types/exam-types";
import { QUESTION_TYPES } from "@/types/exam-types";
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
import { Packer, Document as DocxDocument, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopPosition, TabStopType, Tab } from 'docx';
import { saveAs } from 'file-saver';


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

const getQuestionTypeLabel = (type: QuestionType): string => {
    const qType = QUESTION_TYPES.find(qt => qt.value === type);
    return qType ? qType.label : type;
};


function ExamPreviewPlaceholder({ 
    exam, 
    onBack,
    onDownloadDocx,
    isDownloadingDocxFile 
}: { 
    exam: FullExamData; 
    onBack: () => void;
    onDownloadDocx: () => Promise<void>;
    isDownloadingDocxFile: boolean;
}) {
  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-lg sm:text-xl font-semibold text-foreground">Exam Preview: {exam.title}</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-foreground">This area shows a simplified preview. The full exam can be downloaded as a DOCX file.</CardDescription>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onBack} size="sm" className="text-xs sm:text-sm flex-grow sm:flex-grow-0">
                <ArrowLeft className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Back
            </Button>
            <Button onClick={onDownloadDocx} disabled={isDownloadingDocxFile} size="sm" className="text-xs sm:text-sm flex-grow sm:flex-grow-0">
                {isDownloadingDocxFile ? (
                    <Loader2 className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                    <DownloadCloud className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
                Download DOCX
            </Button>
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100vh-300px)] min-h-[400px] sm:min-h-[500px] p-3 sm:p-6 border rounded-md bg-muted/30 overflow-auto">
        <div className="prose prose-sm max-w-none"> 
            <h1 className="text-center text-xl sm:text-2xl font-bold mb-2 text-foreground">{exam.title}</h1>
            
            <div className="flex justify-between text-xs sm:text-sm mb-4 text-foreground">
                <span>Name: _________________________</span>
                <span>Score: ____________</span>
            </div>

            {exam.description && <p className="text-center text-sm sm:text-base text-foreground italic mb-4">{exam.description}</p>}
            
            <hr className="my-3 sm:my-4"/>

            {exam.examBlocks.map((block, blockIndex) => (
                <div key={block.id} className="mb-4 sm:mb-6">
                    <h2 className="text-base sm:text-lg font-semibold mb-1 text-foreground"> 
                        {toRoman(blockIndex + 1)}. {getQuestionTypeLabel(block.blockType)}
                    </h2>
                    {block.blockTitle && <p className="text-sm sm:text-base text-foreground mb-2 italic">{block.blockTitle}</p>} 
                    
                    {block.questions.map((question, qIndex) => {
                        const globalQuestionNumber = exam.examBlocks.slice(0, blockIndex).reduce((acc, b) => acc + b.questions.length, 0) + qIndex + 1;
                        return (
                            <div key={question.id} className="mb-2 sm:mb-3 pl-2 sm:pl-4">
                                <p className="font-medium text-sm sm:text-base text-foreground"> 
                                    {question.type === 'true-false' ? '____ ' : ''}
                                    {globalQuestionNumber}. {question.questionText}
                                </p>
                                {question.type === 'multiple-choice' && (
                                    <ul className="list-none pl-4 sm:pl-6 mt-1 space-y-0.5">
                                        {(question as MultipleChoiceQuestion).options.map((opt, optIndex) => (
                                            <li key={opt.id} className="text-sm sm:text-base text-foreground">{getAlphabetLetter(optIndex)}. {opt.text}</li> 
                                        ))}
                                    </ul>
                                )}
                                {question.type === 'matching' && (
                                    <div className="pl-4 sm:pl-6 mt-1 space-y-1">
                                        {(question as MatchingTypeQuestion).pairs.map((pair, pairIndex) => (
                                            <p key={pair.id} className="text-sm sm:text-base text-foreground"> 
                                                {pairIndex + 1}. {pair.premise} <span className="inline-block w-16 sm:w-24 border-b border-foreground/50 ml-2"></span>
                                            </p>
                                        ))}
                                         <p className="text-[0.625rem] sm:text-xs text-foreground mt-1"> (Responses for matching would be listed separately in a real exam paper) </p> 
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
      </CardContent>
       <CardFooter>
        <p className="text-xs text-muted-foreground">This is a simplified preview. For full formatting, please download the DOCX file.</p>
      </CardFooter>
    </Card>
  );
}


export default function RenderExamPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [exams, setExams] = useState<ExamSummaryData[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isLoadingPreviewData, setIsLoadingPreviewData] = useState<string | null>(null); 
  const [isDownloadingDocxFile, setIsDownloadingDocxFile] = useState(false); 
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedExamForDialog, setSelectedExamForDialog] = useState<ExamSummaryData | null>(null);

  const [examForPreview, setExamForPreview] = useState<FullExamData | null>(null);
  const [showPreview, setShowPreview] = useState(false);


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
  
  const handlePreparePreview = async () => {
    if (!user || !selectedExamForDialog || !selectedExamForDialog.id) {
        toast({ title: "Error", description: "No exam selected or user not authenticated.", variant: "destructive" });
        setIsConfirmDialogOpen(false);
        setSelectedExamForDialog(null);
        return;
    }
    setIsLoadingPreviewData(selectedExamForDialog.id);
    
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

        for (const blockDocSnap of blocksSnapshot.docs) {
          const blockData = blockDocSnap.data();
          if (typeof blockData !== 'object' || blockData === null) continue;

          const loadedQuestions: ExamQuestion[] = [];
          const questionsCollectionRef = collection(db, EXAMS_COLLECTION_NAME, selectedExamForDialog.id, "questionBlocks", blockDocSnap.id, "questions");
          const questionsQuery = query(questionsCollectionRef, orderBy("orderIndex"));
          const questionsSnapshot = await getDocs(questionsQuery);

          questionsSnapshot.forEach(questionDocSnap => {
            const qData = questionDocSnap.data();
            if (typeof qData !== 'object' || qData === null) return;

            let question: ExamQuestion | null = null;
            const qPoints = Number(qData.points);
            const baseQuestionProps = {
                id: String(questionDocSnap.id),
                questionText: String(qData.questionText || ""),
                points: Number.isFinite(qPoints) ? qPoints : 0, 
            };

            switch (qData.type as QuestionType) {
              case 'multiple-choice':
                question = {
                  ...baseQuestionProps,
                  type: 'multiple-choice',
                  options: (qData.options || []).map((opt: any) => ({ 
                      id: String(opt?.id || `opt-${Math.random()}`),
                      text: String(opt?.text || ""),
                      isCorrect: Boolean(opt?.isCorrect || false)
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
                      id: String(p?.id || `pair-${Math.random()}`),
                      premise: String(p?.premise || ""),
                      response: String(p?.response || ""), 
                    })),
                } as MatchingTypeQuestion;
                break;
              default: 
                question = { ...baseQuestionProps, type: 'multiple-choice', options: []}; 
            }
            if(question) loadedQuestions.push(question);
          });
          loadedBlocks.push({
            id: blockDocSnap.id, 
            blockType: blockData.blockType || 'multiple-choice', 
            blockTitle: String(blockData.blockTitle || ""),
            questions: loadedQuestions,
          });
        }
        
        const examToPreview: FullExamData = {
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
        
        setExamForPreview(examToPreview); 
        setShowPreview(true); 
        toast({ title: "Preview Ready", description: `Preview for "${String(examToPreview.title)}" is now available.` });

    } catch (error) {
        console.error("Error preparing preview:", error);
        toast({ title: "Operation Failed", description: "Could not prepare preview.", variant: "destructive" });
        setShowPreview(false);
        setExamForPreview(null);
    } finally {
        setIsLoadingPreviewData(null);
        setIsConfirmDialogOpen(false);
        setSelectedExamForDialog(null);
    }
  };


  const generateAndDownloadActualDocx = async () => {
    if (!examForPreview) {
        toast({ title: "Error", description: "No exam data available for download.", variant: "destructive" });
        return;
    }
    setIsDownloadingDocxFile(true);
    try {
        let questionCounter = 0;
        const children: Paragraph[] = [
            new Paragraph({
                children: [new TextRun({ text: String(examForPreview.title), bold: true, size: 32 })], 
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 }
            }),
            new Paragraph({ 
                children: [
                    new TextRun({text: "Name: _________________________", size: 24}), 
                    new Tab(),
                    new TextRun({text: "Score: ____________", size: 24}), 
                ],
                tabStops: [
                    { type: TabStopType.RIGHT, position: TabStopPosition.MAX / 1.5 }, 
                ],
                spacing: { after: 200 }
            }),
        ];

        if (examForPreview.description) {
            children.push(new Paragraph({ 
                children: [new TextRun({ text: String(examForPreview.description), italics: true, size: 24 })], 
                alignment: AlignmentType.CENTER, 
                spacing: { after: 300 }
            }));
        }
        
        (examForPreview.examBlocks).forEach((block, blockIndex) => {
            children.push(new Paragraph({
                 children: [new TextRun({ text: `${toRoman(blockIndex + 1)}. ${getQuestionTypeLabel(block.blockType)}`, bold: true, size: 28 })], 
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: block.blockTitle ? 50 : 100 }
            }));

            if (block.blockTitle) {
                 children.push(new Paragraph({ 
                    children: [new TextRun({ text: String(block.blockTitle), italics: true, size: 24 })], 
                    spacing: { after: 100 } 
                }));
            }

            (block.questions).forEach((question) => {
                questionCounter++;
                const questionPrefix = question.type === 'true-false' ? '____ ' : '';
                children.push(new Paragraph({
                    children: [
                        new TextRun({text: `${questionPrefix}${questionCounter}. ${String(question.questionText)} `, size: 24}), 
                    ],
                    indent: { left: 720 }, 
                    spacing: { after: 80 }
                }));

                if (question.type === 'multiple-choice') {
                    ((question as MultipleChoiceQuestion).options).forEach((opt, optIndex) => {
                        children.push(new Paragraph({
                            children: [new TextRun({text: `${getAlphabetLetter(optIndex)}. ${String(opt.text)}`, size: 24})], 
                            indent: { left: 1080 }, 
                        }));
                    });
                } else if (question.type === 'matching') {
                    const premises: Paragraph[] = [];
                    
                    ((question as MatchingTypeQuestion).pairs).forEach((pair, pairIndex) => {
                         premises.push(new Paragraph({
                            children: [new TextRun({text: `${getAlphabetLetter(pairIndex)}. ${String(pair.premise)}\t\t____________________`, size: 24})], 
                            indent: { left: 1080 }, 
                            tabStops: [
                                { type: TabStopType.LEFT, position: 3600 }, 
                            ],
                        }));
                    });
                    children.push(...premises);
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
                        },
                         run: { 
                            font: "Calibri", 
                            size: 24, 
                            color: "000000", 
                        },
                    }
                ],
                characterStyles: [ 
                    {
                        id: 'QuestionNumberChar',
                        name: 'Question Number Char',
                        basedOn: 'DefaultParagraphFont',
                        run: {
                            font: "Calibri",
                            size: 24,
                            color: "000000",
                            bold: false,
                        }
                    }
                ]
            }
        });

        const blob = await Packer.toBlob(wordDocument);
        saveAs(blob, `${String(examForPreview.title).replace(/[^a-z0-9]/gi, '_').toLowerCase()}_exam.docx`);
        toast({ title: "Download Started", description: `"${String(examForPreview.title)}.docx" is downloading.` });

    } catch (error) {
        console.error("Error generating DOCX:", error);
        toast({ title: "DOCX Generation Failed", description: "Could not generate the DOCX file.", variant: "destructive" });
    } finally {
        setIsDownloadingDocxFile(false);
    }
  };


  const handleBackToList = () => {
    setShowPreview(false);
    setExamForPreview(null);
  };


  if (authLoading || (isLoadingExams && !showPreview)) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 sm:h-9 w-36 sm:w-48 mb-2" />
            <Skeleton className="h-4 sm:h-5 w-48 sm:w-64" />
          </div>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-6 sm:h-7 w-24 sm:w-32 mb-1" />
            <Skeleton className="h-4 w-64 sm:w-80" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]"><Skeleton className="h-5 w-20 sm:w-24" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-20 sm:w-24" /></TableHead>
                  <TableHead className="text-center"><Skeleton className="h-5 w-12 sm:w-16" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-5 w-20 sm:w-28" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 sm:w-24" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-6 sm:w-8 mx-auto" /></TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 sm:h-9 w-28 sm:w-36 inline-block" />
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

  if (error && !showPreview) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-4">
        <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" />
        <h2 className="text-xl sm:text-2xl font-semibold mb-2">Oops! Something went wrong.</h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchExams} size="sm" className="text-xs sm:text-sm">Try Again</Button>
      </div>
    );
  }

  if (showPreview && examForPreview) {
    return (
        <ExamPreviewPlaceholder 
            exam={examForPreview} 
            onBack={handleBackToList} 
            onDownloadDocx={generateAndDownloadActualDocx}
            isDownloadingDocxFile={isDownloadingDocxFile}
        />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center">
            <FileType2 className="mr-2 sm:mr-3 h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Render Exam to DOCX
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Select an exam from the list below to generate a DOCX file and preview its content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%] px-2 sm:px-4 text-xs sm:text-sm">Title</TableHead>
                  <TableHead className="hidden sm:table-cell px-2 sm:px-4 text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="hidden md:table-cell px-2 sm:px-4 text-xs sm:text-sm">Date Created</TableHead>
                  <TableHead className="text-center px-1 sm:px-4 text-xs sm:text-sm">Questions</TableHead>
                  <TableHead className="text-right px-2 sm:px-4 text-xs sm:text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium px-2 sm:px-4 text-xs sm:text-sm py-2 sm:py-4">{exam.title}</TableCell>
                    <TableCell className="hidden sm:table-cell px-2 sm:px-4 text-xs sm:text-sm py-2 sm:py-4">
                       <Badge variant={exam.status === 'Published' ? 'default' : exam.status === 'Draft' ? 'secondary' : 'outline'}
                        className={`text-2xs sm:text-xs ${exam.status === 'Archived' ? 'bg-muted text-muted-foreground' : ''}`}>
                           {exam.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-2 sm:px-4 text-xs sm:text-sm py-2 sm:py-4">{format(exam.createdAt.toDate(), "PPP")}</TableCell>
                    <TableCell className="text-center px-1 sm:px-4 text-xs sm:text-sm py-2 sm:py-4">{exam.totalQuestions}</TableCell>
                    <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenConfirmDialog(exam)}
                        disabled={isLoadingPreviewData === exam.id}
                        className="text-xs sm:text-sm w-full whitespace-nowrap"
                      >
                        {isLoadingPreviewData === exam.id ? (
                          <Loader2 className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                        ) : (
                          <FileType2 className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
              <FileText className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm sm:text-lg">No exams available to render.</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Create an exam first, then come back here to generate a DOCX file.
              </p>
              <Button asChild className="mt-4 text-xs sm:text-sm" size="sm">
                <Link href="/create-exam">Create New Exam</Link>
              </Button>
            </div>
          )}
        </CardContent>
        {exams.length > 0 && (
            <CardFooter className="text-xs sm:text-sm text-muted-foreground">
                Showing {exams.length} exam{exams.length === 1 ? '' : 's'} available for rendering.
            </CardFooter>
        )}
      </Card>

      {selectedExamForDialog && (
        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-base sm:text-lg">Confirm Preview Generation</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs sm:text-sm">
                    This will fetch the full exam data for: "{selectedExamForDialog.title}" and prepare it for preview and DOCX download.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 sm:space-y-3 py-2 text-xs sm:text-sm">
                    <div className="flex items-center">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-primary" />
                        <strong>Title:</strong> <span className="ml-1">{selectedExamForDialog.title}</span>
                    </div>
                    {selectedExamForDialog.description && (
                        <div className="flex items-start">
                           <Info className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-muted-foreground flex-shrink-0 mt-0.5" />
                           <div>
                             <strong>Description:</strong>
                             <p className="ml-1 text-muted-foreground text-2xs sm:text-xs">{selectedExamForDialog.description}</p>
                           </div>
                        </div>
                    )}
                    <div className="flex items-center">
                        <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-muted-foreground" />
                        <strong>Created:</strong> <span className="ml-1">{format(selectedExamForDialog.createdAt.toDate(), "PPP p")}</span>
                    </div>
                     <div className="flex items-center">
                        <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-muted-foreground" />
                        <strong>Last Updated:</strong> <span className="ml-1">{format(selectedExamForDialog.updatedAt.toDate(), "PPP p")}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4">
                        <div className="flex items-center">
                            <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-muted-foreground" />
                            <strong>Questions:</strong> <span className="ml-1">{selectedExamForDialog.totalQuestions}</span>
                        </div>
                        <div className="flex items-center">
                            <Star className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-muted-foreground" />
                            <strong>Total Points:</strong> <span className="ml-1">{selectedExamForDialog.totalPoints}</span>
                        </div>
                    </div>
                     <div className="flex items-center">
                        <Info className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-muted-foreground" /> 
                        <strong>Status:</strong> <span className="ml-1">{selectedExamForDialog.status}</span>
                    </div>
                </div>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                    <AlertDialogCancel disabled={isLoadingPreviewData === selectedExamForDialog.id} onClick={() => setSelectedExamForDialog(null)} className="text-xs sm:text-sm">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handlePreparePreview}
                        disabled={isLoadingPreviewData === selectedExamForDialog.id || !selectedExamForDialog.id}
                        className="text-xs sm:text-sm"
                    >
                        {isLoadingPreviewData === selectedExamForDialog.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm & Prepare
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
