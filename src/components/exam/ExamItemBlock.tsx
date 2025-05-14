
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
  disabled?: boolean;
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
      const newOptions = [...(item as MultipleChoiceQuestion).options];
      newOptions[optionIndex].text = text;
      onItemChange({ ...item, options: newOptions } as MultipleChoiceQuestion);
    }
  };

  const handleCorrectOptionChange = (optionId: string) => {
    if (item.type === 'multiple-choice') {
      const newOptions = (item as MultipleChoiceQuestion).options.map(opt => ({
        ...opt,
        isCorrect: opt.id === optionId,
      }));
      onItemChange({ ...item, options: newOptions } as MultipleChoiceQuestion);
    }
  };
  
  const handleAddOption = () => {
    if (item.type === 'multiple-choice') {
      const currentOptions = (item as MultipleChoiceQuestion).options;
      const newOptions = [...currentOptions, { id: generateId('option'), text: "", isCorrect: false }];
      if (newOptions.length === 1) { // If this is the first option being added
        newOptions[0].isCorrect = true;
      } else if (currentOptions.length > 0 && !currentOptions.some(opt => opt.isCorrect) && newOptions.length > 0) {
        // If no option was correct before and we add more, make the first one correct by default
        // This logic might need refinement based on desired UX for adding options when none are correct
        if (newOptions.length > 0) newOptions[0].isCorrect = true;
      }
      onItemChange({ ...item, options: newOptions } as MultipleChoiceQuestion);
    }
  };

  const handleRemoveOption = (optionIndex: number) => {
    if (item.type === 'multiple-choice') {
      const currentOptions = (item as MultipleChoiceQuestion).options;
      if (currentOptions.length <= 1) return; 
      const newOptions = currentOptions.filter((_, i) => i !== optionIndex);
      // If the removed option was the only correct one, make the new first option correct
      if (!newOptions.some(opt => opt.isCorrect) && newOptions.length > 0) {
        newOptions[0].isCorrect = true;
      }
      onItemChange({ ...item, options: newOptions } as MultipleChoiceQuestion);
    }
  };

  // --- True/False Specific Handlers ---
  const handleTrueFalseChange = (value: string) => {
    if (item.type === 'true-false') {
      onItemChange({ ...item, correctAnswer: value === 'true' } as TrueFalseQuestion);
    }
  };

  // --- Matching Type Specific Handlers ---
  const handlePairPremiseChange = (pairIndex: number, premise: string) => {
    if (item.type === 'matching') {
      const newPairs = [...(item as MatchingTypeQuestion).pairs];
      newPairs[pairIndex].premise = premise;
      onItemChange({ ...item, pairs: newPairs } as MatchingTypeQuestion);
    }
  };

  const handlePairResponseChange = (pairIndex: number, response: string) => {
    if (item.type === 'matching') {
      const newPairs = [...(item as MatchingTypeQuestion).pairs];
      newPairs[pairIndex].response = response;
      onItemChange({ ...item, pairs: newPairs } as MatchingTypeQuestion);
    }
  };

  const handleAddPair = () => {
    if (item.type === 'matching') {
      const newPairs = [...(item as MatchingTypeQuestion).pairs, { id: generateId('pair'), premise: "", response: "" }];
      onItemChange({ ...item, pairs: newPairs } as MatchingTypeQuestion);
    }
  };

  const handleRemovePair = (pairIndex: number) => {
    if (item.type === 'matching') {
      const currentPairs = (item as MatchingTypeQuestion).pairs;
      if (currentPairs.length <= 1) return; 
      const newPairs = currentPairs.filter((_, i) => i !== pairIndex);
      onItemChange({ ...item, pairs: newPairs } as MatchingTypeQuestion);
    }
  };


  return (
    <Card className="border-border shadow-sm bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 sm:py-3 sm:px-4 gap-2">
        <CardTitle className="text-xs sm:text-sm md:text-base font-medium flex-shrink-0">Question {itemIndex + 1}</CardTitle>
        <div className="flex items-center gap-2 ml-auto">
            <div className="space-y-0"> {/* Points input always in header, shown/hidden by md:hidden on its desktop counterpart */}
                <Label htmlFor={`points-${item.id}-mobile`} className="sr-only">Points</Label>
                <Input
                id={`points-${item.id}-mobile`}
                type="number"
                value={item.points}
                onChange={handlePointsChange}
                min="0"
                placeholder="Pts"
                className="h-8 w-16 text-xs text-center"
                disabled={disabled}
                />
            </div>
            <Button variant="ghost" size="icon" onClick={onItemRemove} aria-label="Remove question from block" disabled={disabled} className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground hover:text-destructive" />
            </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 sm:gap-4 items-start">
          <div className="space-y-1">
            <Label htmlFor={`questionText-${item.id}`} className="text-xs sm:text-sm">Question Text / Instructions</Label>
            <Textarea
              id={`questionText-${item.id}`}
              value={item.questionText}
              onChange={handleQuestionTextChange}
              placeholder={questionType === 'matching' ? "e.g., Match the terms with their definitions." : "e.g., What is the capital of France?"}
              className="min-h-[60px] sm:min-h-[70px] text-xs sm:text-sm"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1 w-20 sm:w-24 hidden md:block"> {/* Points input for desktop, next to textarea */}
            <Label htmlFor={`points-${item.id}-desktop`} className="text-xs sm:text-sm">Points</Label>
            <Input
              id={`points-${item.id}-desktop`}
              type="number"
              value={item.points}
              onChange={handlePointsChange}
              min="0"
              placeholder="Pts"
              className="h-8 sm:h-9 text-xs sm:text-sm text-center"
              disabled={disabled}
            />
          </div>
        </div>
        

        {/* Multiple Choice Fields */}
        {questionType === 'multiple-choice' && item.type === 'multiple-choice' && (
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="block text-xs sm:text-sm font-medium">Options (Mark the correct one)</Label>
            {(item as MultipleChoiceQuestion).options.map((option, optIndex) => (
              <div key={option.id} className="flex items-center gap-1.5 sm:gap-2">
                <Checkbox
                  id={`correct-opt-${option.id}`}
                  checked={option.isCorrect}
                  onCheckedChange={() => handleCorrectOptionChange(option.id)}
                  aria-label={`Mark option ${getAlphabetLetter(optIndex)} as correct`}
                  disabled={disabled}
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                />
                <Label htmlFor={`option-text-${option.id}`} className="font-semibold text-xs sm:text-sm">{getAlphabetLetter(optIndex)}.</Label>
                <Input
                  id={`option-text-${option.id}`}
                  type="text"
                  value={option.text}
                  onChange={(e) => handleOptionTextChange(optIndex, e.target.value)}
                  placeholder={`Option ${getAlphabetLetter(optIndex)} text`}
                  className="flex-grow h-8 sm:h-9 text-xs sm:text-sm"
                  disabled={disabled}
                />
                {(item as MultipleChoiceQuestion).options.length > 1 && (
                   <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveOption(optIndex)} aria-label={`Remove option ${getAlphabetLetter(optIndex)}`} disabled={disabled} className="h-7 w-7 sm:h-8 sm:w-8">
                     <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                   </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={handleAddOption} size="sm" className="text-xs h-7 sm:h-8 px-2 sm:px-3" disabled={disabled}>
              <PlusCircle className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" /> Add Option
            </Button>
          </div>
        )}

        {/* True/False Fields */}
        {questionType === 'true-false' && item.type === 'true-false' && (
          <div>
            <Label className="block text-xs sm:text-sm font-medium mb-1 sm:mb-1.5">Correct Answer</Label>
            <RadioGroup
              value={(item as TrueFalseQuestion).correctAnswer === null ? '' : String((item as TrueFalseQuestion).correctAnswer)}
              onValueChange={handleTrueFalseChange}
              className="flex space-x-2 sm:space-x-3"
              disabled={disabled}
            >
              <div className="flex items-center space-x-1 sm:space-x-1.5">
                <RadioGroupItem value="true" id={`true-${item.id}`} disabled={disabled} className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
                <Label htmlFor={`true-${item.id}`} className="text-xs sm:text-sm font-normal">True</Label>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-1.5">
                <RadioGroupItem value="false" id={`false-${item.id}`} disabled={disabled} className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
                <Label htmlFor={`false-${item.id}`} className="text-xs sm:text-sm font-normal">False</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Matching Type Fields */}
        {questionType === 'matching' && item.type === 'matching' && (
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="block text-xs sm:text-sm font-medium">Matching Pairs</Label>
            {(item as MatchingTypeQuestion).pairs.map((pair, pairIndex) => (
              <div key={pair.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-1.5 sm:gap-2 items-center">
                <Input
                  type="text"
                  value={pair.premise}
                  onChange={(e) => handlePairPremiseChange(pairIndex, e.target.value)}
                  placeholder={`Premise ${pairIndex + 1}`}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                  disabled={disabled}
                />
                <span className="text-center text-muted-foreground hidden md:inline text-xs sm:text-sm">=</span>
                <Input
                  type="text"
                  value={pair.response}
                  onChange={(e) => handlePairResponseChange(pairIndex, e.target.value)}
                  placeholder={`Response ${pairIndex + 1}`}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                  disabled={disabled}
                />
                 {(item as MatchingTypeQuestion).pairs.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePair(pairIndex)} aria-label={`Remove pair ${pairIndex + 1}`} disabled={disabled} className="h-7 w-7 sm:h-8 sm:w-8">
                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={handleAddPair} size="sm" className="text-xs h-7 sm:h-8 px-2 sm:px-3" disabled={disabled}>
              <PlusCircle className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" /> Add Pair
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

