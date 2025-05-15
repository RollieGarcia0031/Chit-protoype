
// src/components/exam/ExamQuestionGroupBlock.tsx
'use client';

import type { MatchingTypeQuestion, PoolOption } from "@/types/exam-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2 } from "lucide-react";
import type { ExamBlock, ExamQuestion, QuestionType } from "@/types/exam-types";
import { QUESTION_TYPES } from "@/types/exam-types";
import { ExamItemBlock } from "./ExamItemBlock";
import { Textarea } from "../ui/textarea";
import { generateId } from "@/lib/utils";

interface ExamQuestionGroupBlockProps {
  block: ExamBlock;
  blockIndex: number;
  onBlockTypeChange: (blockIndex: number, newType: QuestionType) => void;
  onBlockTitleChange: (blockIndex: number, title: string) => void;
  onAddQuestionToBlock: (blockIndex: number) => void;
  onUpdateQuestionInBlock: (blockIndex: number, questionIndex: number, updatedQuestion: ExamQuestion) => void;
  onRemoveQuestionFromBlock: (blockIndex: number, questionIndex: number) => void;
  onRemoveBlock: (blockIndex: number) => void;
  onUpdateBlock: (blockIndex: number, updatedBlock: ExamBlock) => void; // For choice pool updates
  disabled?: boolean;
}

// Helper function to get alphabet letter
const getAlphabetLetter = (index: number): string => {
  return String.fromCharCode(65 + index); // 65 is ASCII for 'A'
};

export function ExamQuestionGroupBlock({
  block,
  blockIndex,
  onBlockTypeChange,
  onBlockTitleChange,
  onAddQuestionToBlock,
  onUpdateQuestionInBlock,
  onRemoveQuestionFromBlock,
  onRemoveBlock,
  onUpdateBlock,
  disabled = false,
}: ExamQuestionGroupBlockProps) {

  const handleAddChoiceToPool = () => {
    if (block.blockType === 'pooled-choices') {
      const newChoicePool = [...(block.choicePool || []), { id: generateId('pool-opt'), text: "" }];
      onUpdateBlock(blockIndex, { ...block, choicePool: newChoicePool });
    }
  };

  const handleChoicePoolTextChange = (choiceIndex: number, text: string) => {
    if (block.blockType === 'pooled-choices' && block.choicePool) {
      const newChoicePool = [...block.choicePool];
      newChoicePool[choiceIndex].text = text;
      onUpdateBlock(blockIndex, { ...block, choicePool: newChoicePool });
    }
  };

  const handleRemoveChoiceFromPool = (choiceIndex: number) => {
    if (block.blockType === 'pooled-choices' && block.choicePool) {
      const choiceToRemove = block.choicePool[choiceIndex];
      const newChoicePool = block.choicePool.filter((_, i) => i !== choiceIndex);
      
      // Also update questions that might have used this choice
      const updatedQuestions = block.questions.map(q => {
        if (q.type === 'pooled-choices' && q.correctAnswersFromPool.includes(choiceToRemove.text)) {
          return { ...q, correctAnswersFromPool: [] }; // Clear selection if removed choice was selected
        }
        return q;
      });

      onUpdateBlock(blockIndex, { ...block, choicePool: newChoicePool, questions: updatedQuestions });
    }
  };


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

        {block.blockType === 'pooled-choices' && (
          <div className="space-y-2 p-3 border rounded-md bg-muted/30">
            <Label className="block text-xs sm:text-sm font-medium">Choice Pool for this Block</Label>
            {(block.choicePool || []).map((poolOpt, poolOptIndex) => (
              <div key={poolOpt.id} className="flex items-center gap-1.5 sm:gap-2">
                <Label htmlFor={`pool-opt-text-${poolOpt.id}`} className="font-semibold text-xs sm:text-sm">{getAlphabetLetter(poolOptIndex)}.</Label>
                <Input
                  id={`pool-opt-text-${poolOpt.id}`}
                  type="text"
                  value={poolOpt.text}
                  onChange={(e) => handleChoicePoolTextChange(poolOptIndex, e.target.value)}
                  placeholder={`Choice ${getAlphabetLetter(poolOptIndex)} text`}
                  className="flex-grow h-8 sm:h-9 text-xs sm:text-sm"
                  disabled={disabled}
                />
                {(block.choicePool || []).length > 1 && (
                   <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveChoiceFromPool(poolOptIndex)} aria-label={`Remove choice ${getAlphabetLetter(poolOptIndex)} from pool`} disabled={disabled} className="h-7 w-7 sm:h-8 sm:w-8">
                     <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                   </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={handleAddChoiceToPool} size="sm" className="text-xs h-7 sm:h-8 px-2 sm:px-3" disabled={disabled}>
              <PlusCircle className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" /> Add Choice to Pool
            </Button>
          </div>
        )}

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
                choicePool={block.blockType === 'pooled-choices' ? block.choicePool : undefined}
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
