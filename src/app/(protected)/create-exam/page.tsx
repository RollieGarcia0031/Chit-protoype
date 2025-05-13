
// src/app/(protected)/create-exam/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useState, type FormEvent, useEffect, useCallback, useMemo } from "react";
import type { ExamBlock, ExamQuestion, QuestionType, Option, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion } from "@/types/exam-types";
import { generateId, debounce } from "@/lib/utils";
import { ExamQuestionGroupBlock } from "@/components/exam/ExamQuestionGroupBlock";
import { PlusCircle, Loader2, Sparkles, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from '@/lib/firebase/config';
import { collection, doc, writeBatch, serverTimestamp, getDoc, getDocs, query, orderBy } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { EXAMS_COLLECTION_NAME } from "@/config/firebase-constants";
import { analyzeExamFlow, type AnalyzeExamInput, type AnalyzeExamOutput } from "@/ai/flows/analyze-exam-flow";

const LOCAL_STORAGE_KEY = 'pendingExamData';

type AISuggestion = AnalyzeExamOutput['suggestions'][0];

const createDefaultQuestion = (type: QuestionType, idPrefix: string = 'question'): ExamQuestion => {
  const baseQuestionProps = {
    id: generateId(idPrefix),
    questionText: "",
    points: 1,
  };

  switch (type) {
    case 'multiple-choice':
      return {
        ...baseQuestionProps,
        type: 'multiple-choice',
        options: [
          { id: generateId('option'), text: "", isCorrect: true },
          { id: generateId('option'), text: "", isCorrect: false },
        ],
      };
    case 'true-false':
      return {
        ...baseQuestionProps,
        type: 'true-false',
        correctAnswer: null,
      };
    case 'matching':
      return {
        ...baseQuestionProps,
        type: 'matching',
        pairs: [{ id: generateId('pair'), premise: "", response: "" }],
      };
    default:
      console.warn(`createDefaultQuestion received an unknown type: ${type}. Defaulting to multiple-choice.`);
      return {
        ...baseQuestionProps,
        type: 'multiple-choice',
        options: [
            { id: generateId('option'), text: "", isCorrect: true },
            { id: generateId('option'), text: "", isCorrect: false },
        ],
      };
  }
};

export default function CreateExamPage() {
  const [examTitle, setExamTitle] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [examBlocks, setExamBlocks] = useState<ExamBlock[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [isLoadingExamData, setIsLoadingExamData] = useState(false);

  // AI Feature States
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiFeedbackList, setAiFeedbackList] = useState<AISuggestion[]>([]);
  const [isAnalyzingWithAI, setIsAnalyzingWithAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);


  const performAIAnalysis = useCallback(async () => {
    if (!aiSuggestionsEnabled || !user || isSaving || isLoadingExamData) {
      setAiFeedbackList([]);
      return;
    }

    // Check for exam content completeness before calling AI
    let isContentSufficientForAnalysis = true;
    let missingInfoMessage = "";

    if (examBlocks.length === 0) {
        isContentSufficientForAnalysis = false;
        missingInfoMessage = "Add at least one question block to get AI suggestions.";
    } else {
        for (const block of examBlocks) {
            if (block.questions.length === 0) {
                isContentSufficientForAnalysis = false;
                missingInfoMessage = "Some question blocks are empty. Add questions to all blocks for analysis.";
                break;
            }
            for (const q of block.questions) {
                if (!q.questionText.trim()) {
                    isContentSufficientForAnalysis = false;
                    missingInfoMessage = "Some questions are missing text. Please fill them in.";
                    break;
                }
                if (q.type === 'multiple-choice') {
                    const mcq = q as MultipleChoiceQuestion;
                    if (!mcq.options || mcq.options.length < 2) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Multiple-choice questions need at least two options.";
                        break;
                    }
                    if (!mcq.options.some(opt => opt.isCorrect)) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Mark a correct answer for all multiple-choice questions.";
                        break;
                    }
                    if (mcq.options.some(opt => !opt.text.trim())) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Fill in all option texts for multiple-choice questions.";
                        break;
                    }
                } else if (q.type === 'true-false') {
                    if ((q as TrueFalseQuestion).correctAnswer === null) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Select True or False for all true/false questions.";
                        break;
                    }
                } else if (q.type === 'matching') {
                    const matq = q as MatchingTypeQuestion;
                    if (!matq.pairs || matq.pairs.length < 1) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Matching questions need at least one pair.";
                        break;
                    }
                    if (matq.pairs.some(p => !p.premise.trim() || !p.response.trim())) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Fill in all premise and response texts for matching pairs.";
                        break;
                    }
                }
            }
            if (!isContentSufficientForAnalysis) break;
        }
    }
    
    if (!isContentSufficientForAnalysis) {
        setAiFeedbackList([{ 
            suggestionText: missingInfoMessage || "AI analysis requires more complete exam content (e.g., all questions filled, answers selected, options defined).", 
            severity: "info" 
        }]);
        setIsAnalyzingWithAI(false);
        setAiError(null);
        return;
    }


    setIsAnalyzingWithAI(true);
    setAiError(null);

    const examDataForAI: AnalyzeExamInput = {
      examTitle,
      examDescription,
      examBlocks: examBlocks.map(block => ({
        ...block,
        questions: block.questions.map(q => {
          const questionPayload: any = {
            id: q.id,
            questionText: q.questionText,
            points: q.points,
            type: q.type,
          };
          if (q.type === 'multiple-choice') {
            questionPayload.options = (q as MultipleChoiceQuestion).options;
          } else if (q.type === 'true-false') {
            questionPayload.correctAnswer = (q as TrueFalseQuestion).correctAnswer;
          } else if (q.type === 'matching') {
            questionPayload.pairs = (q as MatchingTypeQuestion).pairs;
          }
          return questionPayload;
        })
      })),
    };

    try {
      const result = await analyzeExamFlow(examDataForAI);
      setAiFeedbackList(result.suggestions || []);
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAiError("Failed to get AI suggestions. Please try again.");
      setAiFeedbackList([]);
    } finally {
      setIsAnalyzingWithAI(false);
    }
  }, [aiSuggestionsEnabled, examTitle, examDescription, examBlocks, user, isSaving, isLoadingExamData]);

  const debouncedAIAnalysis = useMemo(() => debounce(performAIAnalysis, 20000), [performAIAnalysis]); // Rate limit to 20 seconds

  useEffect(() => {
    if (aiSuggestionsEnabled && isInitialLoadComplete && !isLoadingExamData && !isSaving) {
      debouncedAIAnalysis();
    } else if (!aiSuggestionsEnabled) {
        setAiFeedbackList([]); 
        setAiError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [aiSuggestionsEnabled, examTitle, examDescription, examBlocks, isInitialLoadComplete, isLoadingExamData, isSaving]); // debouncedAIAnalysis removed as it's stable


  useEffect(() => {
    const examIdFromUrl = searchParams.get('examId');

    if (examIdFromUrl) {
      setEditingExamId(examIdFromUrl);
      setIsLoadingExamData(true); // Start loading if examId is present
    } else {
      // Create mode or no examId in URL
      if (typeof window !== 'undefined' && !isInitialLoadComplete) {
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedData) {
          try {
            const parsedData = JSON.parse(savedData);
            if (parsedData.title) setExamTitle(parsedData.title);
            if (parsedData.description) setExamDescription(parsedData.description);
            if (parsedData.blocks && Array.isArray(parsedData.blocks)) {
              const validatedBlocks = parsedData.blocks.map((block: ExamBlock) => ({
                ...block,
                id: block.id || generateId('block'),
                questions: block.questions.map((q: ExamQuestion) => ({
                  ...q,
                  id: q.id || generateId('question'),
                  ...(q.type === 'multiple-choice' && {
                    options: (q as MultipleChoiceQuestion).options?.map((opt: Option) => ({
                      ...opt,
                      id: opt.id || generateId('option'),
                    })) || [],
                  }),
                  ...(q.type === 'matching' && {
                    pairs: (q as MatchingTypeQuestion).pairs?.map((p: any) => ({
                      ...p,
                      id: p.id || generateId('pair'),
                    })) || [],
                  }),
                })),
              }));
              setExamBlocks(validatedBlocks);
            }
          } catch (error) {
            console.error("Error parsing exam data from localStorage:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        }
      }
      setIsLoadingExamData(false); // Not loading from DB in create mode initially
    }
     if (!isInitialLoadComplete) {
        setIsInitialLoadComplete(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); 


  useEffect(() => {
    if (!editingExamId || !user || !isInitialLoadComplete || !isLoadingExamData ) { 
      if (editingExamId && !isLoadingExamData && isInitialLoadComplete && examBlocks.length === 0 && examTitle === "") {
          // This case might mean fetch failed or exam was empty, but we should not re-trigger loading unless intended.
      }
      return;
    }
    
    const fetchExamForEditing = async () => {
      setExamTitle("");
      setExamDescription("");
      setExamBlocks([]);
      setAiFeedbackList([]);
      
      try {
        const examDocRef = doc(db, EXAMS_COLLECTION_NAME, editingExamId);
        const examSnap = await getDoc(examDocRef);

        if (!examSnap.exists() || examSnap.data().userId !== user.uid) {
          toast({ title: "Error", description: "Exam not found or you don't have permission to edit it.", variant: "destructive" });
          router.push('/exams');
          return;
        }

        const examData = examSnap.data();
        setExamTitle(examData.title);
        setExamDescription(examData.description || "");

        const loadedBlocks: ExamBlock[] = [];
        const blocksCollectionRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks");
        const blocksQuery = query(blocksCollectionRef, orderBy("orderIndex"));
        const blocksSnapshot = await getDocs(blocksQuery);

        for (const blockDoc of blocksSnapshot.docs) {
          const blockData = blockDoc.data();
          const loadedQuestions: ExamQuestion[] = [];
          const questionsCollectionRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks", blockDoc.id, "questions");
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
                  options: (qData.options || []).map((opt: any) => ({ ...opt, id: opt.id || generateId('option')})),
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
                  pairs: (qData.pairs || []).map((p: any) => ({ ...p, id: p.id || generateId('pair')})),
                } as MatchingTypeQuestion;
                break;
              default:
                console.warn("Unknown question type from Firestore:", qData.type);
                question = createDefaultQuestion('multiple-choice', questionDocSnap.id) as MultipleChoiceQuestion;
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
        setExamBlocks(loadedBlocks);
        localStorage.removeItem(LOCAL_STORAGE_KEY); 
        toast({ title: "Exam Loaded", description: `Editing "${examData.title}". Your changes will be saved to the database.` });

      } catch (error) {
        console.error("Error fetching exam for editing:", error);
        toast({ title: "Error Loading Exam", description: "Could not load the exam data for editing.", variant: "destructive" });
        router.push('/exams');
      } finally {
        setIsLoadingExamData(false); 
      }
    };

    if (isLoadingExamData) { 
        fetchExamForEditing();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExamId, user, router, toast, isInitialLoadComplete, isLoadingExamData]); 


  useEffect(() => {
    if (editingExamId || !isInitialLoadComplete || typeof window === 'undefined' || isLoadingExamData) return;

    const examDataToSave = {
      title: examTitle,
      description: examDescription,
      blocks: examBlocks,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(examDataToSave));
  }, [examTitle, examDescription, examBlocks, editingExamId, isInitialLoadComplete, isLoadingExamData]);


  const handleAddExamBlock = () => {
    let newBlockType: QuestionType = 'multiple-choice';
    if (examBlocks.length > 0) {
      newBlockType = examBlocks[examBlocks.length - 1].blockType;
    }
    const initialQuestion = createDefaultQuestion(newBlockType);
    const newBlock: ExamBlock = {
      id: generateId('block'),
      blockType: newBlockType,
      questions: [initialQuestion],
      blockTitle: "",
    };
    setExamBlocks([...examBlocks, newBlock]);
  };

  const handleRemoveExamBlock = (blockIndex: number) => {
    setExamBlocks(examBlocks.filter((_, i) => i !== blockIndex));
  };

  const handleChangeBlockType = (blockIndex: number, newType: QuestionType) => {
    const newBlocks = [...examBlocks];
    const currentBlock = newBlocks[blockIndex];
    const initialQuestion = createDefaultQuestion(newType);

    newBlocks[blockIndex] = {
      ...currentBlock,
      blockType: newType,
      questions: [initialQuestion], 
    };
    setExamBlocks(newBlocks);
    toast({ title: "Block Type Changed", description: `Questions in block ${blockIndex + 1} reset for new type.`});
  };

  const handleBlockTitleChange = (blockIndex: number, title: string) => {
    const newBlocks = [...examBlocks];
    newBlocks[blockIndex].blockTitle = title;
    setExamBlocks(newBlocks);
  };

  const handleAddQuestionToBlock = (blockIndex: number) => {
    const newBlocks = [...examBlocks];
    const block = newBlocks[blockIndex];
    const lastQuestion = block.questions[block.questions.length - 1];
    const inheritedPoints = lastQuestion.points;
    let newOptionsForMC: Option[] = [
      { id: generateId('option'), text: "", isCorrect: true },
      { id: generateId('option'), text: "", isCorrect: false },
    ];

    if (block.blockType === 'multiple-choice' && lastQuestion.type === 'multiple-choice') {
      const numOptions = (lastQuestion as MultipleChoiceQuestion).options?.length > 0 ? (lastQuestion as MultipleChoiceQuestion).options.length : 2;
      newOptionsForMC = Array.from({ length: numOptions }, (_, i) => ({
        id: generateId('option'),
        text: "",
        isCorrect: i === 0 && numOptions > 0, 
      }));
    }

    const baseNewQuestionProps = { id: generateId('question'), questionText: "", points: inheritedPoints };
    let newQuestion: ExamQuestion;

    switch (block.blockType) {
      case 'multiple-choice':
        newQuestion = { ...baseNewQuestionProps, type: 'multiple-choice', options: newOptionsForMC };
        break;
      case 'true-false':
        newQuestion = { ...baseNewQuestionProps, type: 'true-false', correctAnswer: null };
        break;
      case 'matching':
        newQuestion = { ...baseNewQuestionProps, type: 'matching', pairs: [{ id: generateId('pair'), premise: "", response: "" }] };
        break;
      default: 
        newQuestion = { ...baseNewQuestionProps, type: 'multiple-choice', options: newOptionsForMC };
        break;
    }
    block.questions.push(newQuestion);
    setExamBlocks(newBlocks);
  };

  const handleUpdateQuestionInBlock = (blockIndex: number, questionIndex: number, updatedQuestion: ExamQuestion) => {
    const newBlocks = [...examBlocks];
    newBlocks[blockIndex].questions[questionIndex] = updatedQuestion;
    setExamBlocks(newBlocks);
  };

  const handleRemoveQuestionFromBlock = (blockIndex: number, questionIndex: number) => {
    const newBlocks = [...examBlocks];
    if (newBlocks[blockIndex].questions.length > 1) {
      newBlocks[blockIndex].questions.splice(questionIndex, 1);
      setExamBlocks(newBlocks);
    } else {
      toast({ title: "Action Denied", description: "A block must have at least one question.", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setExamTitle("");
    setExamDescription("");
    setExamBlocks([]);
    setAiSuggestionsEnabled(false);
    setAiFeedbackList([]);
    setAiError(null);
    if (!editingExamId && typeof window !== 'undefined') { 
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    setEditingExamId(null); 
    setIsLoadingExamData(false); 
    if (searchParams.get('examId')) router.push('/create-exam'); 
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (examBlocks.length === 0 || !examTitle.trim() || examBlocks.some(b => b.questions.length === 0)) {
      toast({ title: "Validation Error", description: "Exam title and at least one question in each block are required.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    let totalQuestions = 0;
    let totalPoints = 0;
    examBlocks.forEach(block => {
      totalQuestions += block.questions.length;
      block.questions.forEach(question => { totalPoints += question.points; });
    });

    const batch = writeBatch(db);

    try {
        const examDocId = editingExamId || doc(collection(db, EXAMS_COLLECTION_NAME)).id;
        const examDocRef = doc(db, EXAMS_COLLECTION_NAME, examDocId);

        if (editingExamId) {
            batch.update(examDocRef, {
                title: examTitle,
                description: examDescription,
                updatedAt: serverTimestamp(),
                totalQuestions,
                totalPoints,
            });

            const existingBlocksRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks");
            const existingBlocksSnap = await getDocs(existingBlocksRef);
            for (const blockDocSnap of existingBlocksSnap.docs) {
                const existingQuestionsRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks", blockDocSnap.id, "questions");
                const existingQuestionsSnap = await getDocs(existingQuestionsRef);
                for (const qDocSnap of existingQuestionsSnap.docs) {
                    batch.delete(qDocSnap.ref);
                }
                batch.delete(blockDocSnap.ref);
            }
        } else {
            batch.set(examDocRef, {
                title: examTitle,
                description: examDescription,
                userId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                totalQuestions,
                totalPoints,
                status: "Draft",
            });
        }

        examBlocks.forEach((block, blockIndex) => {
            const blockDocRef = doc(collection(db, EXAMS_COLLECTION_NAME, examDocId, "questionBlocks"));
            batch.set(blockDocRef, {
                clientSideBlockId: block.id, 
                blockType: block.blockType,
                blockTitle: block.blockTitle || "",
                orderIndex: blockIndex,
                examId: examDocId,
            });
            block.questions.forEach((question, questionIndex) => {
                const questionDocRef = doc(collection(db, EXAMS_COLLECTION_NAME, examDocId, "questionBlocks", blockDocRef.id, "questions")); 
                const questionData: any = {
                    clientSideQuestionId: question.id, 
                    questionText: question.questionText,
                    points: question.points,
                    type: question.type,
                    orderIndex: questionIndex,
                    blockCollectionId: blockDocRef.id, 
                    examId: examDocId,
                };
                if (question.type === 'multiple-choice') questionData.options = (question as MultipleChoiceQuestion).options.map(opt => ({ ...opt, id: opt.id || generateId('option-save') }));
                else if (question.type === 'true-false') questionData.correctAnswer = (question as TrueFalseQuestion).correctAnswer;
                else if (question.type === 'matching') questionData.pairs = (question as MatchingTypeQuestion).pairs.map(pair => ({ ...pair, id: pair.id || generateId('pair-save')}));
                batch.set(questionDocRef, questionData);
            });
        });
        
        await batch.commit();
        
        if (editingExamId) {
            toast({ title: "Exam Updated", description: `Exam "${examTitle}" updated successfully.` });
            router.push('/exams'); 
        } else {
            toast({ title: "Exam Saved", description: `Exam "${examTitle}" saved. Local draft cleared.` });
            resetForm(); 
        }
    } catch (e) {
        console.error("Error saving exam: ", e);
        toast({ title: "Error Saving Exam", description: "There was an issue. Please try again.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };


  if (isLoadingExamData && editingExamId && !isInitialLoadComplete && examBlocks.length === 0) {
    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <Skeleton className="h-9 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
             <Card className="shadow-lg">
                <CardHeader>
                    <Skeleton className="h-8 w-1/3 mb-2" />
                     <Skeleton className="h-5 w-full" />
                </CardHeader>
                <CardContent>
                   <Skeleton className="h-10 w-1/4 mb-4" />
                   <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
            <Card className="shadow-lg">
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
            <div className="flex justify-end pt-4">
                <Skeleton className="h-12 w-28" />
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      {aiSuggestionsEnabled && (
        <Button
          variant="outline"
          size="icon"
          className="fixed left-4 bottom-4 z-50 rounded-full h-14 w-14 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setIsAiDialogOpen(true)}
          aria-label="Open AI Suggestions"
          disabled={isAnalyzingWithAI}
        >
          {isAnalyzingWithAI ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
          {aiFeedbackList.length > 0 && !isAnalyzingWithAI && (
             aiFeedbackList.some(f => f.suggestionText !== "AI analysis requires more complete exam content (e.g., all questions filled, answers selected, options defined)." &&
                                     f.suggestionText !== "Add at least one question block to get AI suggestions." &&
                                     f.suggestionText !== "Some question blocks are empty. Add questions to all blocks for analysis." &&
                                     f.suggestionText !== "Some questions are missing text. Please fill them in." &&
                                     f.suggestionText !== "Multiple-choice questions need at least two options." &&
                                     f.suggestionText !== "Mark a correct answer for all multiple-choice questions." &&
                                     f.suggestionText !== "Fill in all option texts for multiple-choice questions." &&
                                     f.suggestionText !== "Select True or False for all true/false questions." &&
                                     f.suggestionText !== "Matching questions need at least one pair." &&
                                     f.suggestionText !== "Fill in all premise and response texts for matching pairs." &&
                                     f.suggestionText !== "AI analysis failed to produce output. Please try again." && // Exclude error message
                                     f.suggestionText !== "Exam content is empty. Please add a title or some questions to analyze." && // Exclude from genkit flow
                                     f.suggestionText !== "All question blocks are empty. Add questions to get feedback." // Exclude from genkit flow
                                    ) 
            ) && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {aiFeedbackList.filter(f => f.suggestionText !== "AI analysis requires more complete exam content (e.g., all questions filled, answers selected, options defined)." && 
                                            f.suggestionText !== "Add at least one question block to get AI suggestions." &&
                                            f.suggestionText !== "Some question blocks are empty. Add questions to all blocks for analysis." &&
                                            f.suggestionText !== "Some questions are missing text. Please fill them in." &&
                                            f.suggestionText !== "Multiple-choice questions need at least two options." &&
                                            f.suggestionText !== "Mark a correct answer for all multiple-choice questions." &&
                                            f.suggestionText !== "Fill in all option texts for multiple-choice questions." &&
                                            f.suggestionText !== "Select True or False for all true/false questions." &&
                                            f.suggestionText !== "Matching questions need at least one pair." &&
                                            f.suggestionText !== "Fill in all premise and response texts for matching pairs." &&
                                            f.suggestionText !== "AI analysis failed to produce output. Please try again." &&
                                            f.suggestionText !== "Exam content is empty. Please add a title or some questions to analyze." &&
                                            f.suggestionText !== "All question blocks are empty. Add questions to get feedback."
                                        ).length}
            </Badge>
          )}
        </Button>
      )}

      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center">
              <Sparkles className="mr-2 h-6 w-6 text-primary" />
              AI Exam Analysis & Suggestions
            </DialogTitle>
            <DialogDescription>
              Review AI-generated feedback to improve your exam. Analysis is based on current exam content.
              Content is analyzed approximately every 20 seconds if changes are made.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto space-y-3 pr-2">
            {isAnalyzingWithAI && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing exam content...</p>
              </div>
            )}
            {aiError && !isAnalyzingWithAI && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Analysis Error</AlertTitle>
                <AlertDescription>{aiError}</AlertDescription>
              </Alert>
            )}
            {!isAnalyzingWithAI && !aiError && aiFeedbackList.length === 0 && (
              <div className="text-center py-10">
                <Info className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No AI suggestions available at the moment.</p>
                <p className="text-sm text-muted-foreground">Ensure AI suggestions are enabled and you have some exam content that is sufficiently complete.</p>
              </div>
            )}
            {!isAnalyzingWithAI && !aiError && aiFeedbackList.length > 0 && (
               <ul className="space-y-2">
                {aiFeedbackList.map((feedback, index) => (
                  <li key={index} className="text-sm text-foreground p-3 bg-muted/50 rounded-md shadow-sm">
                    <p className="font-medium">Suggestion:</p>
                    <ul className="list-disc pl-5 mt-1 text-muted-foreground">
                       {feedback.suggestionText.split('\n').map((line, lineIndex) => {
                          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                            return <li key={lineIndex}>{line.trim().substring(2)}</li>;
                          }
                          return line.trim() ? <li key={lineIndex}>{line.trim()}</li> : null;
                       }).filter(Boolean)}
                    </ul>
                    {feedback.elementPath && (
                       <p className="text-xs text-primary/80 mt-1">Related to: <code>{feedback.elementPath}</code></p>
                    )}
                    {feedback.severity && (
                       <Badge variant={feedback.severity === 'error' ? 'destructive' : feedback.severity === 'warning' ? 'secondary' : 'outline'} className="mt-1.5 text-xs">
                         {feedback.severity.charAt(0).toUpperCase() + feedback.severity.slice(1)}
                       </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAiDialogOpen(false)}>Close</Button>
            <Button onClick={performAIAnalysis} disabled={isAnalyzingWithAI || !aiSuggestionsEnabled}>
              {isAnalyzingWithAI && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Re-analyze Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold tracking-tight">
              {editingExamId ? "Edit Exam" : "Create New Exam"}
            </CardTitle>
            <CardDescription>
              {editingExamId 
                ? `Editing exam: "${examTitle || 'Loading...'}"` 
                : "Fill in the details below to create a new exam. Your progress is saved locally for new exams."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="examTitle" className="text-base">Exam Title</Label>
                <Input
                  id="examTitle"
                  placeholder="e.g., Midterm Mathematics"
                  className="text-base"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  required
                  disabled={isSaving || isLoadingExamData}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="examDescription" className="text-base">Description (Optional)</Label>
                <Textarea
                  id="examDescription"
                  placeholder="A brief description of the exam content or instructions."
                  className="text-base min-h-[100px]"
                  value={examDescription}
                  onChange={(e) => setExamDescription(e.target.value)}
                  disabled={isSaving || isLoadingExamData}
                />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                    id="ai-suggestions-toggle"
                    checked={aiSuggestionsEnabled}
                    onCheckedChange={setAiSuggestionsEnabled}
                    disabled={isSaving || isLoadingExamData}
                />
                <Label htmlFor="ai-suggestions-toggle" className="text-sm">
                    Enable AI Suggestions
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">Question Blocks</CardTitle>
            <CardDescription>Add blocks of questions. Each block contains questions of the same type. New blocks inherit the type of the previous block. New questions inherit points and (for MCQs) option count from the previous question in the block.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {examBlocks.map((block, blockIndex) => {
              return (
                <ExamQuestionGroupBlock
                  key={block.id}
                  block={block}
                  blockIndex={blockIndex}
                  onBlockTypeChange={handleChangeBlockType}
                  onBlockTitleChange={handleBlockTitleChange}
                  onAddQuestionToBlock={handleAddQuestionToBlock}
                  onUpdateQuestionInBlock={handleUpdateQuestionInBlock}
                  onRemoveQuestionFromBlock={handleRemoveQuestionFromBlock}
                  onRemoveBlock={handleRemoveExamBlock}
                  disabled={isSaving || isLoadingExamData}
                />
              );
            })}
            <Button type="button" variant="outline" onClick={handleAddExamBlock} className="w-full" disabled={isSaving || isLoadingExamData}>
              <PlusCircle className="mr-2 h-5 w-5" />
              Add Question Block
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center pt-4">
           <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving || isLoadingExamData}>
            {editingExamId ? "Cancel Edit" : "Clear Form & Reset Draft"}
          </Button>
          <Button type="submit" size="lg" disabled={isSaving || isLoadingExamData || examBlocks.length === 0 || !examTitle.trim() || examBlocks.some(b => b.questions.length === 0)}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : (editingExamId ? 'Update Exam' : 'Save Exam')}
          </Button>
        </div>
      </form>
    </div>
  );
}

