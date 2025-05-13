
// src/app/(protected)/create-exam/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, type FormEvent, useEffect } from "react";
import type { ExamBlock, ExamQuestion, QuestionType, Option } from "@/types/exam-types";
import { generateId } from "@/lib/utils";
import { ExamQuestionGroupBlock } from "@/components/exam/ExamQuestionGroupBlock";
import { PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from '@/lib/firebase/config';
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";

const LOCAL_STORAGE_KEY = 'pendingExamData';
const EXAMS_COLLECTION_NAME = 'chit1'; // Updated collection name

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
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
                  options: q.options?.map((opt: Option) => ({ // Added null check for options
                    ...opt,
                    id: opt.id || generateId('option'),
                  })) || [], // Default to empty array if options is undefined
                }),
                ...(q.type === 'matching' && {
                  pairs: q.pairs?.map((p: any) => ({ // Added null check for pairs
                    ...p,
                    id: p.id || generateId('pair'),
                  })) || [], // Default to empty array if pairs is undefined
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
    setIsInitialLoadComplete(true);
  }, []);

  useEffect(() => {
    if (!isInitialLoadComplete || typeof window === 'undefined') return;

    const examDataToSave = {
      title: examTitle,
      description: examDescription,
      blocks: examBlocks,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(examDataToSave));
  }, [examTitle, examDescription, examBlocks, isInitialLoadComplete]);


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

    const baseNewQuestionProps = {
      id: generateId('question'),
      questionText: "",
      points: inheritedPoints,
    };

    let newQuestion: ExamQuestion;

    switch (block.blockType) {
      case 'multiple-choice':
        newQuestion = {
          ...baseNewQuestionProps,
          type: 'multiple-choice',
          options: newOptionsForMC,
        };
        break;
      case 'true-false':
        newQuestion = {
          ...baseNewQuestionProps,
          type: 'true-false',
          correctAnswer: null,
        };
        break;
      case 'matching':
        newQuestion = {
          ...baseNewQuestionProps,
          type: 'matching',
          pairs: [{ id: generateId('pair'), premise: "", response: "" }],
        };
        break;
      default:
        console.warn(`Unhandled block type in handleAddQuestionToBlock: ${block.blockType}. Defaulting to multiple-choice.`);
        newQuestion = {
          ...baseNewQuestionProps,
          type: 'multiple-choice',
          options: [
              { id: generateId('option'), text: "", isCorrect: true },
              { id: generateId('option'), text: "", isCorrect: false },
          ],
        };
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
    const block = newBlocks[blockIndex];
    if (block.questions.length > 1) {
      block.questions.splice(questionIndex, 1);
      setExamBlocks(newBlocks);
    } else {
      toast({
        title: "Action Denied",
        description: "A block must have at least one question. To remove all questions, remove the block itself.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setExamTitle("");
    setExamDescription("");
    setExamBlocks([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to save an exam.",
        variant: "destructive",
      });
      return;
    }

    if (examBlocks.length === 0 || !examTitle.trim()) {
      toast({
        title: "Validation Error",
        description: "Exam title and at least one question block are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    let totalQuestions = 0;
    let totalPoints = 0;
    examBlocks.forEach(block => {
      totalQuestions += block.questions.length;
      block.questions.forEach(question => {
        totalPoints += question.points;
      });
    });

    const batch = writeBatch(db);
    const examDocRef = doc(collection(db, EXAMS_COLLECTION_NAME)); // Use updated collection name

    batch.set(examDocRef, {
      title: examTitle,
      description: examDescription,
      userId: user.uid, // User information is already included
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      totalQuestions: totalQuestions,
      totalPoints: totalPoints,
      status: "Draft", // Default status
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

        const questionData: Partial<ExamQuestion> & { orderIndex: number, type: QuestionType, blockId: string, examId: string } = {
          originalQuestionId: question.id,
          questionText: question.questionText,
          points: question.points,
          type: question.type,
          orderIndex: questionIndex,
          blockId: blockDocRef.id,
          examId: examDocRef.id,
        };

        if (question.type === 'multiple-choice') {
          questionData.options = question.options.map(opt => ({ ...opt }));
        } else if (question.type === 'true-false') {
          questionData.correctAnswer = question.correctAnswer;
        } else if (question.type === 'matching') {
          questionData.pairs = question.pairs.map(pair => ({ ...pair }));
        }

        batch.set(questionDocRef, questionData);
      });
    });

    try {
      await batch.commit();
      toast({
        title: "Exam Saved Successfully",
        description: `Exam "${examTitle}" has been saved. Local draft cleared.`,
      });
      resetForm(); // Clear form and local storage
    } catch (e) {
      console.error("Error saving exam to Firestore: ", e);
      toast({
        title: "Error Saving Exam",
        description: "There was an issue saving your exam. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold tracking-tight">Create New Exam</CardTitle>
            <CardDescription>Fill in the details below to create a new exam. Your progress is saved locally.</CardDescription>
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
                  disabled={isSaving}
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
                  disabled={isSaving}
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
                disabled={isSaving}
              />
            ))}
            <Button type="button" variant="outline" onClick={handleAddExamBlock} className="w-full" disabled={isSaving}>
              <PlusCircle className="mr-2 h-5 w-5" />
              Add Question Block
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" disabled={isSaving || examBlocks.length === 0 || !examTitle.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Exam'}
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

