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
import type { ExamQuestion, QuestionType, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion, MatchingPair } from "@/types/exam-types";
import { generateId } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExamItemBlockProps {
  item: ExamQuestion;
  questionType: QuestionType;
  onItemChange: (item: ExamQuestion) => void;
  onItemRemove: () => void;
  itemIndex: number;
  disabled?: boolean;
  totalQuestionsInBlock?: number; // New prop for matching type
}

// Helper function to get alphabet letter
const getAlphabetLetter = (index: number): string => {
  return String.fromCharCode(65 + index); // 65 is ASCII for 'A'
};

export function ExamItemBlock({ item, questionType, onItemChange, onItemRemove, itemIndex, disabled = false, totalQuestionsInBlock }: ExamItemBlockProps) {
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
      if (newOptions.length === 1) {
        newOptions[0].isCorrect = true;
      } else if (currentOptions.length > 0 && !currentOptions.some(opt => opt.isCorrect) && newOptions.length > 0) {
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
  const handleMatchingPremiseChange = (text: string) => { // Renamed for clarity
    if (item.type === 'matching') {
      const currentPairs = (item as MatchingTypeQuestion).pairs;
      const updatedPairs: MatchingPair[] = currentPairs.length > 0 ? [...currentPairs] : [{ id: generateId('pair'), premise: "", response: "" }];
      updatedPairs[0].premise = text;
      onItemChange({ ...item, pairs: updatedPairs } as MatchingTypeQuestion);
    }
  };

  const handleMatchingResponseChange = (text: string) => { // Renamed for clarity
    if (item.type === 'matching') {
      const currentPairs = (item as MatchingTypeQuestion).pairs;
      const updatedPairs: MatchingPair[] = currentPairs.length > 0 ? [...currentPairs] : [{ id: generateId('pair'), premise: "", response: "" }];
      updatedPairs[0].response = text;
      onItemChange({ ...item, pairs: updatedPairs } as MatchingTypeQuestion);
    }
  };

  const handleMatchingResponseLetterChange = (letter: string) => {
    if (item.type === 'matching') {
      const currentPairs = (item as MatchingTypeQuestion).pairs;
      const updatedPairs: MatchingPair[] = currentPairs.length > 0 ? [...currentPairs] : [{ id: generateId('pair'), premise: "", response: "" }];
      updatedPairs[0].responseLetter = letter;
      onItemChange({ ...item, pairs: updatedPairs } as MatchingTypeQuestion);
    }
  };


  return (
    <Card className="border-border shadow-sm bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 sm:py-3 sm:px-4 gap-2">
        <CardTitle className="text-xs sm:text-sm md:text-base font-medium flex-shrink-0">Question {itemIndex + 1}</CardTitle>
        <div className="flex items-center gap-2 ml-auto">
            <div className="space-y-0 md:hidden"> {/* Show only on mobile/small screens */}
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
        {questionType !== 'matching' && ( // Standard layout for MC and T/F
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 sm:gap-4 items-start">
            <div className="space-y-1">
              <Label htmlFor={`questionText-${item.id}`} className="text-xs sm:text-sm">Question Text / Instructions</Label>
              <Textarea
                id={`questionText-${item.id}`}
                value={item.questionText}
                onChange={handleQuestionTextChange}
                placeholder={ "e.g., What is the capital of France?"}
                className="min-h-[60px] sm:min-h-[70px] text-xs sm:text-sm"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1 w-20 sm:w-24 hidden md:block"> {/* Points for desktop */}
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
        )}

        {/* Specific fields based on questionType */}
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

        {questionType === 'matching' && item.type === 'matching' && (
          <div className="space-y-2 sm:space-y-3">
             {/* General instructions (item.questionText) for matching are handled by blockTitle or can be displayed here if needed */}
             {/* This layout assumes block.blockTitle provides overall instructions for matching. */}
             {/* If item.questionText is used for per-pair instructions, it's currently not displayed. */}
             {/* Points input for desktop, hidden for mobile as it's in header */}
            <div className="space-y-1 w-20 sm:w-24 hidden md:block self-start">
              <Label htmlFor={`points-${item.id}-desktop-matching`} className="text-xs sm:text-sm">Points</Label>
              <Input
                id={`points-${item.id}-desktop-matching`}
                type="number"
                value={item.points}
                onChange={handlePointsChange}
                min="0"
                placeholder="Pts"
                className="h-8 sm:h-9 text-xs sm:text-sm text-center"
                disabled={disabled}
              />
            </div>

             <div className="space-y-1">
                <Label htmlFor={`matching-premise-${item.id}`} className="text-xs sm:text-sm">Question / Term</Label>
                <Input
                    id={`matching-premise-${item.id}`}
                    type="text"
                    value={(item as MatchingTypeQuestion).pairs[0]?.premise || ""}
                    onChange={(e) => handleMatchingPremiseChange(e.target.value)}
                    placeholder="e.g., Photosynthesis"
                    className="h-8 sm:h-9 text-xs sm:text-sm"
                    disabled={disabled}
                />
             </div>
             <div className="space-y-1">
                <Label htmlFor={`matching-response-${item.id}`} className="text-xs sm:text-sm">Answer / Definition</Label>
                <div className="flex items-center gap-2">
                    <Input
                        id={`matching-response-${item.id}`}
                        type="text"
                        value={(item as MatchingTypeQuestion).pairs[0]?.response || ""}
                        onChange={(e) => handleMatchingResponseChange(e.target.value)}
                        placeholder="e.g., Process plants use to make food"
                        className="flex-grow h-8 sm:h-9 text-xs sm:text-sm"
                        disabled={disabled}
                    />
                    {totalQuestionsInBlock && totalQuestionsInBlock > 0 && (
                    <Select
                        value={(item as MatchingTypeQuestion).pairs[0]?.responseLetter || ""}
                        onValueChange={handleMatchingResponseLetterChange}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-[70px] sm:w-[80px] h-8 sm:h-9 text-xs sm:text-sm flex-shrink-0">
                        <SelectValue placeholder="ID" />
                        </SelectTrigger>
                        <SelectContent>
                        {Array.from({ length: totalQuestionsInBlock }, (_, i) => getAlphabetLetter(i)).map(letter => (
                            <SelectItem key={letter} value={letter} className="text-xs sm:text-sm">
                            {letter}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    )}
                </div>
             </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
