
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
import type { ExamQuestion, QuestionType, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion, MatchingPair, PoolOption, PooledChoicesQuestion } from "@/types/exam-types";
import { generateId } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExamItemBlockProps {
  item: ExamQuestion;
  questionType: QuestionType;
  onItemChange: (item: ExamQuestion) => void;
  onItemRemove: () => void;
  itemIndex: number;
  disabled?: boolean;
  totalQuestionsInBlock?: number;
  lettersUsedByOtherItemsInBlock?: string[];
  choicePool?: PoolOption[];
}

const getAlphabetLetter = (index: number): string => {
  return String.fromCharCode(65 + index);
};

export function ExamItemBlock({
  item,
  questionType,
  onItemChange,
  onItemRemove,
  itemIndex,
  disabled = false,
  totalQuestionsInBlock,
  lettersUsedByOtherItemsInBlock,
  choicePool,
}: ExamItemBlockProps) {
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

  const handleTrueFalseChange = (value: string) => {
    if (item.type === 'true-false') {
      onItemChange({ ...item, correctAnswer: value === 'true' } as TrueFalseQuestion);
    }
  };

  const handleMatchingPremiseChange = (text: string) => {
    if (item.type === 'matching') {
      const currentPairs = (item as MatchingTypeQuestion).pairs;
      const updatedPairs: MatchingPair[] = currentPairs.length > 0 ? [...currentPairs] : [{ id: generateId('pair'), premise: "", response: "", responseLetter: "" }];
      updatedPairs[0].premise = text;
      onItemChange({ ...item, pairs: updatedPairs } as MatchingTypeQuestion);
    }
  };

  const handleMatchingResponseChange = (text: string) => {
    if (item.type === 'matching') {
      const currentPairs = (item as MatchingTypeQuestion).pairs;
      const updatedPairs: MatchingPair[] = currentPairs.length > 0 ? [...currentPairs] : [{ id: generateId('pair'), premise: "", response: "", responseLetter: "" }];
      updatedPairs[0].response = text;
      onItemChange({ ...item, pairs: updatedPairs } as MatchingTypeQuestion);
    }
  };

  const handleMatchingResponseLetterChange = (letter: string) => {
    if (item.type === 'matching') {
      const currentPairs = (item as MatchingTypeQuestion).pairs;
      const updatedPairs: MatchingPair[] = currentPairs.length > 0 ? [...currentPairs] : [{ id: generateId('pair'), premise: "", response: "", responseLetter: "" }];
      updatedPairs[0].responseLetter = letter;
      onItemChange({ ...item, pairs: updatedPairs } as MatchingTypeQuestion);
    }
  };

  const getAvailableLettersForMatching = (): string[] => {
    if (questionType !== 'matching' || !totalQuestionsInBlock) return [];
    const currentAssignedLetter = (item as MatchingTypeQuestion).pairs[0]?.responseLetter;
    const allPossibleLetters = Array.from({ length: totalQuestionsInBlock }, (_, i) => getAlphabetLetter(i));

    return allPossibleLetters.filter(possibleLetter => {
      if (possibleLetter === currentAssignedLetter) return true;
      if (lettersUsedByOtherItemsInBlock && lettersUsedByOtherItemsInBlock.includes(possibleLetter)) return false;
      return true;
    });
  };

  const getSelectedLetterFromPool = () => {
    if (item.type === 'pooled-choices' && choicePool && choicePool.length > 0) {
      const selectedText = (item as PooledChoicesQuestion).correctAnswersFromPool[0];
      if (selectedText) {
        const selectedOptionIndex = choicePool.findIndex(opt => opt.text === selectedText);
        if (selectedOptionIndex !== -1) {
          return getAlphabetLetter(selectedOptionIndex);
        }
      }
    }
    return "";
  };

  const handlePooledChoiceAnswerChange = (selectedLetter: string) => {
    if (item.type === 'pooled-choices' && choicePool) {
      const selectedOptionIndex = choicePool.findIndex((opt, index) => getAlphabetLetter(index) === selectedLetter);
      if (selectedOptionIndex !== -1) {
        const selectedText = choicePool[selectedOptionIndex].text;
        onItemChange({ ...item, correctAnswersFromPool: [selectedText] } as PooledChoicesQuestion);
      } else {
        onItemChange({ ...item, correctAnswersFromPool: [] } as PooledChoicesQuestion);
      }
    }
  };


  return (
    <Card className="border-border shadow-sm bg-card/50">
      <CardHeader className="flex flex-col items-stretch gap-1.5 py-2 px-3 sm:flex-row sm:items-center sm:justify-between sm:py-3 sm:px-4 sm:gap-2">
        <CardTitle className="text-xs sm:text-sm md:text-base font-medium flex-shrink-0 mr-auto order-first">Question {itemIndex + 1}</CardTitle>
        <div className="flex items-center gap-1 sm:gap-2 w-full justify-between sm:w-auto sm:ml-auto sm:order-none">
            <div className="flex items-center gap-1 sm:gap-1.5">
                <Label htmlFor={`points-${item.id}-q${itemIndex}`} className="text-xs sm:text-sm whitespace-nowrap">Points:</Label>
                <Input
                    id={`points-${item.id}-q${itemIndex}`}
                    type="number"
                    value={item.points}
                    onChange={handlePointsChange}
                    min="0"
                    placeholder="Pts"
                    className="h-7 w-10 text-xs text-center sm:h-8 sm:w-14 sm:text-xs"
                    disabled={disabled}
                />
            </div>
            <Button variant="ghost" size="icon" onClick={onItemRemove} aria-label="Remove question from block" disabled={disabled} className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground hover:text-destructive" />
            </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-3 pb-3 sm:px-4 sm:pb-4">
        {/* Question Text for MC and T/F */}
        {questionType !== 'matching' && questionType !== 'pooled-choices' && (
          <div className="space-y-1">
            <Label htmlFor={`questionText-${item.id}`} className="text-xs sm:text-sm">Question Text / Instructions</Label>
            <Textarea
              id={`questionText-${item.id}`}
              value={item.questionText}
              onChange={handleQuestionTextChange}
              placeholder={
                questionType === 'multiple-choice' ? "e.g., What is the capital of France?" :
                questionType === 'true-false' ? "e.g., The Earth is flat." :
                "Enter question text"
              }
              className="min-h-[60px] sm:min-h-[70px] text-xs sm:text-sm"
              disabled={disabled}
            />
          </div>
        )}

        {/* Specific UI for Pooled Choices */}
        {questionType === 'pooled-choices' && item.type === 'pooled-choices' && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex-shrink-0 w-20 sm:w-24">
                <Label htmlFor={`pooled-choice-answer-trigger-${item.id}`} className="block text-xs sm:text-sm font-medium mb-1">Answer</Label>
                <Select
                  value={getSelectedLetterFromPool()}
                  onValueChange={handlePooledChoiceAnswerChange}
                  disabled={disabled || !choicePool || choicePool.length === 0}
                >
                  <SelectTrigger
                    id={`pooled-choice-answer-trigger-${item.id}`}
                    className="h-9 w-full text-xs sm:text-sm px-2"
                    aria-label="Select correct answer from pool"
                  >
                    <SelectValue placeholder="Ans." />
                  </SelectTrigger>
                  <SelectContent>
                    {(choicePool || []).map((poolOpt, poolOptIndex) => (
                      <SelectItem key={poolOpt.id} value={getAlphabetLetter(poolOptIndex)} className="text-xs sm:text-sm">
                        {getAlphabetLetter(poolOptIndex)}. {poolOpt.text}
                      </SelectItem>
                    ))}
                    {(!choicePool || choicePool.length === 0) && (
                      <SelectItem value="no-options" disabled className="text-xs sm:text-sm">No choices in pool</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-grow">
                <Label htmlFor={`questionText-${item.id}`} className="block text-xs sm:text-sm font-medium mb-1">Question Text</Label>
                <Textarea
                  id={`questionText-${item.id}`}
                  value={item.questionText}
                  onChange={handleQuestionTextChange}
                  placeholder="e.g., Which of the following is a primary color?"
                  className="min-h-[60px] sm:min-h-[70px] text-xs sm:text-sm"
                  disabled={disabled}
                />
              </div>
            </div>
            {!choicePool || choicePool.length === 0 && (
                <p className="text-2xs sm:text-xs text-muted-foreground">No choices in the pool. Add choices in the block settings above.</p>
            )}
          </div>
        )}


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
            <Button type="button" variant="outline" onClick={handleAddOption} size="sm" className="text-xs sm:text-xs h-7 sm:h-8 px-2 sm:px-3" disabled={disabled}>
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
                        {getAvailableLettersForMatching().map(letter => (
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

