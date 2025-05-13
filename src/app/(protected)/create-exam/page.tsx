
// src/app/(protected)/create-exam/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, type FormEvent, useEffect } from "react";
import type { ExamBlock, ExamQuestion, QuestionType, Option, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion } from "@/types/exam-types";
import { generateId } from "@/lib/utils";
import { ExamQuestionGroupBlock } from "@/components/exam/ExamQuestionGroupBlock";
import { PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from '@/lib/firebase/config';
import { collection, doc, writeBatch, serverTimestamp, getDoc, getDocs, query, orderBy, deleteDoc } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { EXAMS_COLLECTION_NAME } from "@/config/firebase-constants";

const LOCAL_STORAGE_KEY = 'pendingExamData';

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


  // Effect to determine mode (create or edit) and load initial data accordingly
  useEffect(() => {
    const examIdFromUrl = searchParams.get('examId');
    if (examIdFromUrl) {
      setEditingExamId(examIdFromUrl);
      setIsLoadingExamData(true); // Trigger Firestore load
      // Prevent local storage load for generic key when editing
      if (!isInitialLoadComplete) setIsInitialLoadComplete(true);
    } else {
      // Create mode: load from local storage if available and not already loaded
      if (!isInitialLoadComplete && typeof window !== 'undefined') {
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
                    options: q.options?.map((opt: Option) => ({
                      ...opt,
                      id: opt.id || generateId('option'),
                    })) || [],
                  }),
                  ...(q.type === 'matching' && {
                    pairs: q.pairs?.map((p: any) => ({
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
        setIsInitialLoadComplete(true);
      }
    }
  }, [searchParams, isInitialLoadComplete]);


  // Effect to fetch exam data from Firestore when in edit mode
  useEffect(() => {
    if (!editingExamId || !user || !isLoadingExamData) {
      return;
    }

    const fetchExamForEditing = async () => {
      // Clear form before loading to prevent state merging issues
      setExamTitle("");
      setExamDescription("");
      setExamBlocks([]);
      
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
                  options: qData.options || [],
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
                  pairs: qData.pairs || [],
                } as MatchingTypeQuestion;
                break;
              default:
                console.warn("Unknown question type from Firestore:", qData.type);
                // Fallback or skip - for now, create a default MC to avoid crashing
                question = createDefaultQuestion('multiple-choice', questionDocSnap.id) as MultipleChoiceQuestion;
            }
            loadedQuestions.push(question);
          });

          loadedBlocks.push({
            id: blockDoc.id, // Use Firestore doc ID for the block
            blockType: blockData.blockType,
            blockTitle: blockData.blockTitle || "",
            questions: loadedQuestions,
          });
        }
        setExamBlocks(loadedBlocks);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear generic draft as we're editing a specific exam
        toast({ title: "Exam Loaded", description: `Editing "${examData.title}". Your changes will be saved to the database.` });

      } catch (error) {
        console.error("Error fetching exam for editing:", error);
        toast({ title: "Error Loading Exam", description: "Could not load the exam data for editing.", variant: "destructive" });
        router.push('/exams');
      } finally {
        setIsLoadingExamData(false);
      }
    };

    fetchExamForEditing();
  }, [editingExamId, user, router, toast, isLoadingExamData]); // isLoadingExamData ensures this runs when set to true


  // Effect to save to local storage (only in create mode)
  useEffect(() => {
    if (editingExamId || !isInitialLoadComplete || typeof window === 'undefined') return;

    const examDataToSave = {
      title: examTitle,
      description: examDescription,
      blocks: examBlocks,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(examDataToSave));
  }, [examTitle, examDescription, examBlocks, editingExamId, isInitialLoadComplete]);


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
      const numOptions = (lastQuestion.options && lastQuestion.options.length > 0) ? lastQuestion.options.length : 2;
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
    if (!editingExamId && typeof window !== 'undefined') { // Only clear local storage if not in edit mode from start
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    setEditingExamId(null); // Reset editing mode
    setIsLoadingExamData(false); // Reset loading state
    // if editingExamId was set, user might want to go to clean create page or exams list
    if (searchParams.get('examId')) router.push('/create-exam');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (examBlocks.length === 0 || !examTitle.trim()) {
      toast({ title: "Validation Error", description: "Exam title and at least one question block are required.", variant: "destructive" });
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
        if (editingExamId) {
            // ---- UPDATE EXISTING EXAM ----
            const examDocRef = doc(db, EXAMS_COLLECTION_NAME, editingExamId);
            batch.update(examDocRef, {
                title: examTitle,
                description: examDescription,
                updatedAt: serverTimestamp(),
                totalQuestions,
                totalPoints,
                status: "Draft", // Or manage status explicitly
            });

            // Strategy: Delete existing subcollections and recreate them
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

            // Re-add blocks and questions (they will get new Firestore IDs for subcollections)
            examBlocks.forEach((block, blockIndex) => {
                const blockDocRef = doc(collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks"));
                batch.set(blockDocRef, {
                    originalBlockId: block.id, // This is the client-state ID (could be old Firestore ID or new gen ID)
                    blockType: block.blockType,
                    blockTitle: block.blockTitle || "",
                    orderIndex: blockIndex,
                    examId: editingExamId,
                });
                block.questions.forEach((question, questionIndex) => {
                    const questionDocRef = doc(collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks", blockDocRef.id, "questions"));
                    const questionData: any = {
                        originalQuestionId: question.id, // Client-state ID
                        questionText: question.questionText,
                        points: question.points,
                        type: question.type,
                        orderIndex: questionIndex,
                        blockId: blockDocRef.id,
                        examId: editingExamId,
                    };
                    if (question.type === 'multiple-choice') questionData.options = (question as MultipleChoiceQuestion).options.map(opt => ({ ...opt }));
                    else if (question.type === 'true-false') questionData.correctAnswer = (question as TrueFalseQuestion).correctAnswer;
                    else if (question.type === 'matching') questionData.pairs = (question as MatchingTypeQuestion).pairs.map(pair => ({ ...pair }));
                    batch.set(questionDocRef, questionData);
                });
            });
            await batch.commit();
            toast({ title: "Exam Updated", description: `Exam "${examTitle}" updated successfully.` });
            router.push('/exams'); // Navigate to exams list after update

        } else {
            // ---- CREATE NEW EXAM ----
            const examDocRef = doc(collection(db, EXAMS_COLLECTION_NAME));
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
            examBlocks.forEach((block, blockIndex) => {
                const blockDocRef = doc(collection(db, EXAMS_COLLECTION_NAME, examDocRef.id, "questionBlocks"));
                batch.set(blockDocRef, {
                    originalBlockId: block.id,
                    blockType: block.blockType,
                    blockTitle: block.blockTitle || "",
                    orderIndex: blockIndex,
                    examId: examDocRef.id,
                });
                block.questions.forEach((question, questionIndex) => {
                    const questionDocRef = doc(collection(db, EXAMS_COLLECTION_NAME, examDocRef.id, "questionBlocks", blockDocRef.id, "questions"));
                    const questionData: any = {
                        originalQuestionId: question.id,
                        questionText: question.questionText,
                        points: question.points,
                        type: question.type,
                        orderIndex: questionIndex,
                        blockId: blockDocRef.id,
                        examId: examDocRef.id,
                    };
                    if (question.type === 'multiple-choice') questionData.options = (question as MultipleChoiceQuestion).options.map(opt => ({ ...opt }));
                    else if (question.type === 'true-false') questionData.correctAnswer = (question as TrueFalseQuestion).correctAnswer;
                    else if (question.type === 'matching') questionData.pairs = (question as MatchingTypeQuestion).pairs.map(pair => ({ ...pair }));
                    batch.set(questionDocRef, questionData);
                });
            });
            await batch.commit();
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

  if (isLoadingExamData && editingExamId) {
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

  // Attempting to fix parsing error by ensuring this comment exists.
  return (
    <div className="space-y-6">
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
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">Question Blocks</CardTitle>
            <CardDescription>Add blocks of questions. Each block contains questions of the same type. New blocks inherit the type of the previous block. New questions inherit points and (for MCQs) option count from the previous question in the block.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {examBlocks.map((block, blockIndex) => (
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
            ))}
            <Button type="button" variant="outline" onClick={handleAddExamBlock} className="w-full" disabled={isSaving || isLoadingExamData}>
              <PlusCircle className="mr-2 h-5 w-5" />
              Add Question Block
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center pt-4">
           <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving || isLoadingExamData}>
            {editingExamId ? "Cancel Edit" : "Clear Form"}
          </Button>
          <Button type="submit" size="lg" disabled={isSaving || isLoadingExamData || examBlocks.length === 0 || !examTitle.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : (editingExamId ? 'Update Exam' : 'Save Exam')}
          </Button>
        </div>
      </form>

      <Card className="shadow-md">
        <CardHeader>
            <CardTitle className="text-xl">AI Tools</CardTitle>
            <CardDescription>Use AI to help generate questions or exam structures.</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">AI features coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
