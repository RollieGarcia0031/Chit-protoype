// src/components/exam/ExamQuestionGroupBlock.tsx
'use client';

import type { MatchingTypeQuestion } from "@/types/exam-types"; // Import MatchingTypeQuestion
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2 } from "lucide-react";
import type { ExamBlock, ExamQuestion, QuestionType } from "@/types/exam-types";
import { QUESTION_TYPES } from "@/types/exam-types";
import { ExamItemBlock } from "./ExamItemBlock";
import { Textarea } from "../ui/textarea";


interface ExamQuestionGroupBlockProps {
  block: ExamBlock;
  blockIndex: number;
  onBlockTypeChange: (blockIndex: number, newType: QuestionType) => void;
  onBlockTitleChange: (blockIndex: number, title: string) => void;
  onAddQuestionToBlock: (blockIndex: number) => void;
  onUpdateQuestionInBlock: (blockIndex: number, questionIndex: number, updatedQuestion: ExamQuestion) => void;
  onRemoveQuestionFromBlock: (blockIndex: number, questionIndex: number) => void;
  onRemoveBlock: (blockIndex: number) => void;
  disabled?: boolean;
}

export function ExamQuestionGroupBlock({
  block,
  blockIndex,
  onBlockTypeChange,
  onBlockTitleChange,
  onAddQuestionToBlock,
  onUpdateQuestionInBlock,
  onRemoveQuestionFromBlock,
  onRemoveBlock,
  disabled = false,
}: ExamQuestionGroupBlockProps) {
  return (
    <Card className="shadow-md border-border">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 pb-3 sm:pb-4">
        <div className="flex-grow">
          <CardTitle className="text-lg sm:text-xl">Question Block {blockIndex + 1}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Configure questions of type: <span className="font-semibold">{QUESTION_TYPES.find(qt => qt.value === block.blockType)?.label || block.blockType}</span>
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={block.blockType}
            onValueChange={(newType) => onBlockTypeChange(blockIndex, newType as QuestionType)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs sm:text-sm" disabled={disabled}>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map(qt => (
                <SelectItem key={qt.value} value={qt.value} className="text-xs sm:text-sm">
                  {qt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="destructive" size="icon" onClick={() => onRemoveBlock(blockIndex)} aria-label="Remove question block" disabled={disabled} className="h-9 w-9">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <div>
          <Label htmlFor={`blockTitle-${block.id}`} className="mb-1 block text-xs sm:text-sm">
            Block Instructions (Optional)
          </Label>
          <Textarea
            id={`blockTitle-${block.id}`}
            value={block.blockTitle || ""}
            onChange={(e) => onBlockTitleChange(blockIndex, e.target.value)}
            placeholder="e.g., Answer all questions in this section."
            className="min-h-[60px] text-xs sm:text-sm"
            disabled={disabled}
          />
        </div>
        <div className="space-y-3">
          {block.questions.map((question, questionIndex) => {
            let lettersUsedByOtherItemsInBlock: string[] = [];
            if (block.blockType === 'matching') {
              lettersUsedByOtherItemsInBlock = block.questions
                .filter((q, i) => i !== questionIndex && (q as MatchingTypeQuestion).pairs[0]?.responseLetter)
                .map(q => (q as MatchingTypeQuestion).pairs[0]!.responseLetter!);
            }
            return (
              <ExamItemBlock
                key={question.id}
                item={question}
                questionType={block.blockType}
                onItemChange={(updatedItem) => onUpdateQuestionInBlock(blockIndex, questionIndex, updatedItem)}
                onItemRemove={() => onRemoveQuestionFromBlock(blockIndex, questionIndex)}
                itemIndex={questionIndex}
                disabled={disabled}
                totalQuestionsInBlock={block.blockType === 'matching' ? block.questions.length : undefined}
                lettersUsedByOtherItemsInBlock={block.blockType === 'matching' ? lettersUsedByOtherItemsInBlock : undefined}
              />
            );
          })}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onAddQuestionToBlock(blockIndex)}
          size="sm"
          className="w-full md:w-auto text-xs sm:text-sm"
          disabled={disabled}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add Question to this Block
        </Button>
      </CardFooter>
    </Card>
  );
}
