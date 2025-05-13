
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
    const newItem: ExamQuestion = {
      id: generateId('question'),
      type: 'multiple-choice', // Default type
      questionText: "",
      options: [
        { id: generateId('option'), text: "", isCorrect: false },
        { id: generateId('option'), text: "", isCorrect: false },
      ],
    };
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

    switch (newType) {
      case 'multiple-choice':
        newItem = {
          id: currentItem.id,
          type: 'multiple-choice',
          questionText: currentItem.questionText,
          options: [{ id: generateId('option'), text: "", isCorrect: false }, { id: generateId('option'), text: "", isCorrect: false }],
        };
        break;
      case 'true-false':
        newItem = {
          id: currentItem.id,
          type: 'true-false',
          questionText: currentItem.questionText,
          correctAnswer: null,
        };
        break;
      case 'matching':
        newItem = {
          id: currentItem.id,
          type: 'matching',
          questionText: currentItem.questionText, // Serves as instruction
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
            <CardDescription>Add and configure questions for your exam.</CardDescription>
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
          <Button type="submit" size="lg">
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
