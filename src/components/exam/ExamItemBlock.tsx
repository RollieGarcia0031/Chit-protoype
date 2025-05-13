// src/components/exam/ExamItemBlock.tsx
'use client';

import type { ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, PlusCircle } from "lucide-react";
import type { ExamQuestion, QuestionType, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion } from "@/types/exam-types";
import { generateId } from "@/lib/utils";

interface ExamItemBlockProps {
  item: ExamQuestion;
  questionType: QuestionType; 
  onItemChange: (item: ExamQuestion) => void;
  onItemRemove: () => void;
  itemIndex: number; 
  disabled?: boolean; // Added disabled prop
}

// Helper function to get alphabet letter for options
const getAlphabetLetter = (index: number): string => {
  return String.fromCharCode(65 + index); // 65 is ASCII for 'A'
};

export function ExamItemBlock({ item, questionType, onItemChange, onItemRemove, itemIndex, disabled = false }: ExamItemBlockProps) {
  const handleQuestionTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onItemChange({ ...item, questionText: e.target.value });
  };

  const handlePointsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const points = parseInt(e.target.value, 10);
    if (!isNaN(points) && points >= 0) { 
      onItemChange({ ...item, points });
    } else if (e.target.value === "") { 
        onItemChange({ ...item, points: 0 });
    }
  };

  // --- Multiple Choice Specific Handlers ---
  const handleOptionTextChange = (optionIndex: number, text: string) => {
    if (item.type === 'multiple-choice') {
      const newOptions = [...item.options];
      newOptions[optionIndex].text = text;
      onItemChange({ ...item, options: newOptions });
    }
  };

  const handleCorrectOptionChange = (optionId: string) => {
    if (item.type === 'multiple-choice') {
      const newOptions = item.options.map(opt => ({
        ...opt,
        isCorrect: opt.id === optionId,
      }));
      onItemChange({ ...item, options: newOptions });
    }
  };
  
  const handleAddOption = () => {
    if (item.type === 'multiple-choice') {
      const newOptions = [...item.options, { id: generateId('option'), text: "", isCorrect: false }];
      if (newOptions.length === 1) {
        newOptions[0].isCorrect = true;
      }
      onItemChange({ ...item, options: newOptions });
    }
  };

  const handleRemoveOption = (optionIndex: number) => {
    if (item.type === 'multiple-choice') {
      if (item.options.length <= 1) return; 
      const newOptions = item.options.filter((_, i) => i !== optionIndex);
      if (!newOptions.some(opt => opt.isCorrect) && newOptions.length > 0) {
        newOptions[0].isCorrect = true;
      }
      onItemChange({ ...item, options: newOptions });
    }
  };

  // --- True/False Specific Handlers ---
  const handleTrueFalseChange = (value: string) => {
    if (item.type === 'true-false') {
      onItemChange({ ...item, correctAnswer: value === 'true' });
    }
  };

  // --- Matching Type Specific Handlers ---
  const handlePairPremiseChange = (pairIndex: number, premise: string) => {
    if (item.type === 'matching') {
      const newPairs = [...item.pairs];
      newPairs[pairIndex].premise = premise;
      onItemChange({ ...item, pairs: newPairs });
    }
  };

  const handlePairResponseChange = (pairIndex: number, response: string) => {
    if (item.type === 'matching') {
      const newPairs = [...item.pairs];
      newPairs[pairIndex].response = response;
      onItemChange({ ...item, pairs: newPairs });
    }
  };

  const handleAddPair = () => {
    if (item.type === 'matching') {
      const newPairs = [...item.pairs, { id: generateId('pair'), premise: "", response: "" }];
      onItemChange({ ...item, pairs: newPairs });
    }
  };

  const handleRemovePair = (pairIndex: number) => {
    if (item.type === 'matching') {
      if (item.pairs.length <= 1) return; 
      const newPairs = item.pairs.filter((_, i) => i !== pairIndex);
      onItemChange({ ...item, pairs: newPairs });
    }
  };


  return (
    <Card className="border-border shadow-sm bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-md font-medium">Question {itemIndex + 1}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onItemRemove} aria-label="Remove question from block" disabled={disabled}>
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
          <div className="space-y-1">
            <Label htmlFor={`questionText-${item.id}`} className="text-sm">Question Text / Instructions</Label>
            <Textarea
              id={`questionText-${item.id}`}
              value={item.questionText}
              onChange={handleQuestionTextChange}
              placeholder={questionType === 'matching' ? "e.g., Match the terms with their definitions." : "e.g., What is the capital of France?"}
              className="min-h-[70px] text-sm"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1 md:w-24">
            <Label htmlFor={`points-${item.id}`} className="text-sm">Points</Label>
            <Input
              id={`points-${item.id}`}
              type="number"
              value={item.points}
              onChange={handlePointsChange}
              min="0"
              placeholder="Pts"
              className="h-9 text-sm text-center"
              disabled={disabled}
            />
          </div>
        </div>
        

        {/* Multiple Choice Fields */}
        {questionType === 'multiple-choice' && item.type === 'multiple-choice' && (
          <div className="space-y-2">
            <Label className="block text-sm font-medium">Options (Mark the correct one)</Label>
            {(item as MultipleChoiceQuestion).options.map((option, optIndex) => (
              <div key={option.id} className="flex items-center gap-2">
                <Checkbox
                  id={`correct-opt-${option.id}`}
                  checked={option.isCorrect}
                  onCheckedChange={() => handleCorrectOptionChange(option.id)}
                  aria-label={`Mark option ${getAlphabetLetter(optIndex)} as correct`}
                  disabled={disabled}
                />
                <Label htmlFor={`option-text-${option.id}`} className="font-semibold text-sm">{getAlphabetLetter(optIndex)}.</Label>
                <Input
                  id={`option-text-${option.id}`}
                  type="text"
                  value={option.text}
                  onChange={(e) => handleOptionTextChange(optIndex, e.target.value)}
                  placeholder={`Option ${getAlphabetLetter(optIndex)} text`}
                  className="flex-grow h-9 text-sm"
                  disabled={disabled}
                />
                {(item as MultipleChoiceQuestion).options.length > 1 && (
                   <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveOption(optIndex)} aria-label={`Remove option ${getAlphabetLetter(optIndex)}`} disabled={disabled}>
                     <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                   </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={handleAddOption} size="sm" className="text-xs" disabled={disabled}>
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Option
            </Button>
          </div>
        )}

        {/* True/False Fields */}
        {questionType === 'true-false' && item.type === 'true-false' && (
          <div>
            <Label className="block text-sm font-medium mb-1.5">Correct Answer</Label>
            <RadioGroup
              value={(item as TrueFalseQuestion).correctAnswer === null ? '' : String((item as TrueFalseQuestion).correctAnswer)}
              onValueChange={handleTrueFalseChange}
              className="flex space-x-3"
              disabled={disabled}
            >
              <div className="flex items-center space-x-1.5">
                <RadioGroupItem value="true" id={`true-${item.id}`} disabled={disabled} />
                <Label htmlFor={`true-${item.id}`} className="text-sm font-normal">True</Label>
              </div>
              <div className="flex items-center space-x-1.5">
                <RadioGroupItem value="false" id={`false-${item.id}`} disabled={disabled} />
                <Label htmlFor={`false-${item.id}`} className="text-sm font-normal">False</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Matching Type Fields */}
        {questionType === 'matching' && item.type === 'matching' && (
          <div className="space-y-2">
            <Label className="block text-sm font-medium">Matching Pairs</Label>
            {(item as MatchingTypeQuestion).pairs.map((pair, pairIndex) => (
              <div key={pair.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                <Input
                  type="text"
                  value={pair.premise}
                  onChange={(e) => handlePairPremiseChange(pairIndex, e.target.value)}
                  placeholder={`Premise ${pairIndex + 1}`}
                  className="h-9 text-sm"
                  disabled={disabled}
                />
                <span className="text-center text-muted-foreground hidden md:inline text-sm">=</span>
                <Input
                  type="text"
                  value={pair.response}
                  onChange={(e) => handlePairResponseChange(pairIndex, e.target.value)}
                  placeholder={`Response ${pairIndex + 1}`}
                  className="h-9 text-sm"
                  disabled={disabled}
                />
                 {(item as MatchingTypeQuestion).pairs.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePair(pairIndex)} aria-label={`Remove pair ${pairIndex + 1}`} disabled={disabled}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={handleAddPair} size="sm" className="text-xs" disabled={disabled}>
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Pair
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
