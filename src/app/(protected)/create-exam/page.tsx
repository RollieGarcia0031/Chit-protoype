// src/app/(protected)/create-exam/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, type FormEvent } from "react";
import type { ExamBlock, ExamQuestion, QuestionType } from "@/types/exam-types";
import { generateId } from "@/lib/utils";
import { ExamQuestionGroupBlock } from "@/components/exam/ExamQuestionGroupBlock"; // New component
import { PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


// Helper to create a default question based on type
const createDefaultQuestion = (type: QuestionType, idPrefix: string = 'question'): ExamQuestion => {
  const baseQuestionProps = {
    id: generateId(idPrefix),
    questionText: "",
    points: 1, // Default points for a new question
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
        // questionText for matching serves as instruction
        pairs: [{ id: generateId('pair'), premise: "", response: "" }],
      };
    default: // Should not be reached if types are handled correctly
      return {
        ...baseQuestionProps,
        type: 'multiple-choice', // Fallback
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

  const handleAddExamBlock = () => {
    let newBlockType: QuestionType = 'multiple-choice'; // Default for the very first block
    if (examBlocks.length > 0) {
      newBlockType = examBlocks[examBlocks.length - 1].blockType; // Inherit from last block
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
      questions: [initialQuestion], // Reset questions in the block to one default of the new type
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
    const newQuestion = createDefaultQuestion(block.blockType);
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const examData = {
      title: examTitle,
      description: examDescription,
      blocks: examBlocks,
    };
    console.log("Exam Data to save:", JSON.stringify(examData, null, 2)); // Pretty print for readability
    toast({ title: "Exam Saved (Simulated)", description: "Exam data logged to console."});
    // Here you would typically send data to a backend or state management
  };


  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold tracking-tight">Create New Exam</CardTitle>
            <CardDescription>Fill in the details below to create a new exam.</CardDescription>
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
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">Question Blocks</CardTitle>
            <CardDescription>Add blocks of questions. Each block contains questions of the same type. New blocks inherit the type of the previous block.</CardDescription>
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
              />
            ))}
            <Button type="button" variant="outline" onClick={handleAddExamBlock} className="w-full">
              <PlusCircle className="mr-2 h-5 w-5" />
              Add Question Block
            </Button>
          </CardContent>
        </Card>
        
        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" disabled={examBlocks.length === 0 || !examTitle}>
            Save Exam
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
