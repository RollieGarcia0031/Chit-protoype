// src/app/(protected)/create-exam/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, type FormEvent } from "react";
import { ExamQuestion, QUESTION_TYPES, QuestionType } from "@/types/exam-types";
import { generateId } from "@/lib/utils";
import { ExamItemBlock } from "@/components/exam/ExamItemBlock";
import { PlusCircle } from "lucide-react";

export default function CreateExamPage() {
  const [examTitle, setExamTitle] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [examItems, setExamItems] = useState<ExamQuestion[]>([]);

  const handleAddExamItem = () => {
    let newQuestionType: QuestionType = 'multiple-choice'; // Default type
    if (examItems.length > 0) {
      newQuestionType = examItems[examItems.length - 1].type;
    }

    let newItem: ExamQuestion;

    switch (newQuestionType) {
      case 'multiple-choice':
        newItem = {
          id: generateId('question'),
          type: 'multiple-choice',
          questionText: "",
          options: [
            { id: generateId('option'), text: "", isCorrect: true }, // Default first option to correct for new MCQs
            { id: generateId('option'), text: "", isCorrect: false },
          ],
        };
        break;
      case 'true-false':
        newItem = {
          id: generateId('question'),
          type: 'true-false',
          questionText: "",
          correctAnswer: null, // No default correct answer
        };
        break;
      case 'matching':
        newItem = {
          id: generateId('question'),
          type: 'matching',
          questionText: "", // Serves as instruction
          pairs: [{ id: generateId('pair'), premise: "", response: "" }],
        };
        break;
      default:
        // Should not happen with defined types, but as a fallback
        newItem = {
          id: generateId('question'),
          type: 'multiple-choice',
          questionText: "",
          options: [
            { id: generateId('option'), text: "", isCorrect: true },
            { id: generateId('option'), text: "", isCorrect: false },
          ],
        };
        break;
    }
    setExamItems([...examItems, newItem]);
  };

  const handleUpdateExamItem = (index: number, updatedItem: ExamQuestion) => {
    const newItems = [...examItems];
    newItems[index] = updatedItem;
    setExamItems(newItems);
  };

  const handleRemoveExamItem = (index: number) => {
    setExamItems(examItems.filter((_, i) => i !== index));
  };

  const handleChangeExamItemType = (index: number, newType: QuestionType) => {
    const currentItem = examItems[index];
    let newItem: ExamQuestion;

    // Preserve question text if switching types
    const questionText = currentItem.questionText;

    switch (newType) {
      case 'multiple-choice':
        newItem = {
          id: currentItem.id,
          type: 'multiple-choice',
          questionText: questionText,
          options: [{ id: generateId('option'), text: "", isCorrect: true }, { id: generateId('option'), text: "", isCorrect: false }],
        };
        break;
      case 'true-false':
        newItem = {
          id: currentItem.id,
          type: 'true-false',
          questionText: questionText,
          correctAnswer: null,
        };
        break;
      case 'matching':
        newItem = {
          id: currentItem.id,
          type: 'matching',
          questionText: questionText, 
          pairs: [{ id: generateId('pair'), premise: "", response: "" }],
        };
        break;
      default:
        return; // Should not happen
    }
    handleUpdateExamItem(index, newItem);
  };
  
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Combine examTitle, examDescription, and examItems for submission
    const examData = {
      title: examTitle,
      description: examDescription,
      questions: examItems,
    };
    console.log("Exam Data to save:", examData);
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
            <CardTitle className="text-2xl font-semibold">Exam Questions</CardTitle>
            <CardDescription>Add and configure questions for your exam. New questions will inherit the type of the previous question.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {examItems.map((item, index) => (
              <ExamItemBlock
                key={item.id}
                item={item}
                onItemChange={(updatedItem) => handleUpdateExamItem(index, updatedItem)}
                onItemRemove={() => handleRemoveExamItem(index)}
                onItemTypeChange={(newType) => handleChangeExamItemType(index, newType)}
                itemIndex={index}
              />
            ))}
            <Button type="button" variant="outline" onClick={handleAddExamItem} className="w-full">
              <PlusCircle className="mr-2 h-5 w-5" />
              Add Question Block
            </Button>
          </CardContent>
        </Card>
        
        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" disabled={examItems.length === 0 || !examTitle}>
            Save Exam
          </Button>
        </div>
      </form>

      {/* Placeholder for AI-powered question generation or other features */}
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
