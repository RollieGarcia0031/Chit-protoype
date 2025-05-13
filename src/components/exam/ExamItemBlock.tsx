// src/components/exam/ExamItemBlock.tsx
'use client';

import type { ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, PlusCircle } from "lucide-react";
import type { ExamQuestion, QuestionType, Option, MatchingPair, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion } from "@/types/exam-types";
import { QUESTION_TYPES } from "@/types/exam-types";
import { generateId } from "@/lib/utils";

interface ExamItemBlockProps {
  item: ExamQuestion;
  onItemChange: (item: ExamQuestion) => void;
  onItemRemove: () => void;
  onItemTypeChange: (newType: QuestionType) => void;
  itemIndex: number;
}

// Helper function to get alphabet letter for options
const getAlphabetLetter = (index: number): string => {
  return String.fromCharCode(65 + index); // 65 is ASCII for 'A'
};

export function ExamItemBlock({ item, onItemChange, onItemRemove, onItemTypeChange, itemIndex }: ExamItemBlockProps) {
  const handleQuestionTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onItemChange({ ...item, questionText: e.target.value });
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
      onItemChange({ ...item, options: newOptions });
    }
  };

  const handleRemoveOption = (optionIndex: number) => {
    if (item.type === 'multiple-choice') {
      // Ensure at least one option remains for multiple choice
      if (item.options.length <= 1) return;
      const newOptions = item.options.filter((_, i) => i !== optionIndex);
      // If the removed option was correct, and no other option is correct, mark the first as correct.
      // This is a simple fallback, could be more sophisticated.
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
       // Ensure at least one pair remains for matching type
      if (item.pairs.length <= 1) return;
      const newPairs = item.pairs.filter((_, i) => i !== pairIndex);
      onItemChange({ ...item, pairs: newPairs });
    }
  };


  return (
    <Card className="border-border shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg">Question {itemIndex + 1}</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={item.type} onValueChange={(newType) => onItemTypeChange(newType as QuestionType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map(qt => (
                <SelectItem key={qt.value} value={qt.value}>{qt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="destructive" size="icon" onClick={onItemRemove} aria-label="Remove question">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor={`questionText-${item.id}`} className="mb-1 block">Question Text / Instructions</Label>
          <Textarea
            id={`questionText-${item.id}`}
            value={item.questionText}
            onChange={handleQuestionTextChange}
            placeholder={item.type === 'matching' ? "e.g., Match the terms with their definitions." : "e.g., What is the capital of France?"}
            className="min-h-[80px]"
          />
        </div>

        {/* Multiple Choice Fields */}
        {item.type === 'multiple-choice' && (
          <div className="space-y-3">
            <Label className="block font-medium">Options (Mark the correct one)</Label>
            {(item as MultipleChoiceQuestion).options.map((option, optIndex) => (
              <div key={option.id} className="flex items-center gap-3">
                <Checkbox
                  id={`correct-opt-${option.id}`}
                  checked={option.isCorrect}
                  onCheckedChange={() => handleCorrectOptionChange(option.id)}
                  aria-label={`Mark option ${getAlphabetLetter(optIndex)} as correct`}
                />
                <Label htmlFor={`option-text-${option.id}`} className="font-semibold">{getAlphabetLetter(optIndex)}.</Label>
                <Input
                  id={`option-text-${option.id}`}
                  type="text"
                  value={option.text}
                  onChange={(e) => handleOptionTextChange(optIndex, e.target.value)}
                  placeholder={`Option ${getAlphabetLetter(optIndex)} text`}
                  className="flex-grow"
                />
                {(item as MultipleChoiceQuestion).options.length > 1 && ( // Show remove button if more than 1 option
                   <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveOption(optIndex)} aria-label={`Remove option ${getAlphabetLetter(optIndex)}`}>
                     <Trash2 className="h-4 w-4 text-muted-foreground" />
                   </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={handleAddOption} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Option
            </Button>
          </div>
        )}

        {/* True/False Fields */}
        {item.type === 'true-false' && (
          <div>
            <Label className="block font-medium mb-2">Correct Answer</Label>
            <RadioGroup
              value={(item as TrueFalseQuestion).correctAnswer === null ? '' : String((item as TrueFalseQuestion).correctAnswer)}
              onValueChange={handleTrueFalseChange}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id={`true-${item.id}`} />
                <Label htmlFor={`true-${item.id}`}>True</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id={`false-${item.id}`} />
                <Label htmlFor={`false-${item.id}`}>False</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Matching Type Fields */}
        {item.type === 'matching' && (
          <div className="space-y-3">
            <Label className="block font-medium">Matching Pairs</Label>
            {(item as MatchingTypeQuestion).pairs.map((pair, pairIndex) => (
              <div key={pair.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                <Input
                  type="text"
                  value={pair.premise}
                  onChange={(e) => handlePairPremiseChange(pairIndex, e.target.value)}
                  placeholder={`Premise ${pairIndex + 1}`}
                />
                <span className="text-center text-muted-foreground hidden md:inline">=</span>
                <Input
                  type="text"
                  value={pair.response}
                  onChange={(e) => handlePairResponseChange(pairIndex, e.target.value)}
                  placeholder={`Response ${pairIndex + 1}`}
                />
                 {(item as MatchingTypeQuestion).pairs.length > 1 && ( // Show remove if more than 1 pair
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePair(pairIndex)} aria-label={`Remove pair ${pairIndex + 1}`}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={handleAddPair} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Pair
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
