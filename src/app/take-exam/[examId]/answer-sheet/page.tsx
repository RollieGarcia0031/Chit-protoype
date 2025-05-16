
// src/app/take-exam/[examId]/answer-sheet/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useMemo } from 'react';
import type { FullExamData, ExamBlock, ExamQuestion, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion, PooledChoicesQuestion } from '@/types/exam-types';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, AlertTriangle, Send, ArrowLeft, Info } from 'lucide-react';
import { QUESTION_TYPES } from '@/types/exam-types'; // Ensure this is imported

const getAlphabetLetter = (index: number): string => String.fromCharCode(65 + index);

const toRoman = (num: number): string => {
  if (num < 1 || num > 3999) return String(num);
  const romanNumerals: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  let n = num;
  for (const [value, symbol] of romanNumerals) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
};

const getQuestionTypeLabel = (type: ExamQuestion['type']): string => {
    const qType = QUESTION_TYPES.find(qt => qt.value === type);
    return qType ? qType.label : type;
};


export default function AnswerSheetPage() {
  const params = useParams();
  const examId = params.examId as string;
  const router = useRouter();

  const [examToDisplay, setExamToDisplay] = useState<FullExamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  let globalQuestionNumber = 1; // For continuous numbering

  useEffect(() => {
    if (typeof window !== 'undefined' && examId) {
      setIsLoading(true);
      try {
        const cachedExamDataString = sessionStorage.getItem(`examData-${examId}`);
        if (cachedExamDataString) {
          const parsedData: FullExamData = JSON.parse(cachedExamDataString);
          setExamToDisplay(parsedData);
        } else {
          setError("Exam data not found. Please return to the previous page and try starting the exam again.");
        }
      } catch (e) {
        console.error("Error parsing exam data from sessionStorage:", e);
        setError("There was an issue loading the exam. Please try again.");
      } finally {
        setIsLoading(false);
      }
    } else if (!examId) {
      setError("No exam ID provided.");
      setIsLoading(false);
    }
  }, [examId]);

  const handleSubmitExam = () => {
    // Placeholder for future submission logic
    alert("Exam submission functionality is coming soon!");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Skeleton className="h-10 w-1/2 mb-2" />
        <Skeleton className="h-6 w-3/4 mb-6" />
        <Skeleton className="h-40 w-full max-w-2xl mb-4" />
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Exam</h1>
        <p className="text-muted-foreground max-w-md mb-4">{error}</p>
        <Button onClick={() => router.push(`/take-exam/${examId}`)} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Try Again
        </Button>
      </div>
    );
  }

  if (!examToDisplay) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Exam Not Found</h1>
        <p className="text-muted-foreground">The exam content could not be loaded from your session.</p>
         <Button onClick={() => router.push(`/take-exam/${examId}`)} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Start
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8 max-w-4xl">
      <Card className="shadow-xl border-border">
        <CardHeader className="text-center border-b">
          <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold text-primary">
            {examToDisplay.title}
          </CardTitle>
          {examToDisplay.description && (
            <CardDescription className="text-sm sm:text-base text-muted-foreground mt-2">
              {examToDisplay.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-4 sm:p-6 md:p-8 prose prose-sm sm:prose-base max-w-none">
          {examToDisplay.examBlocks.map((block, blockIndex) => {
            const blockTypeLabel = getQuestionTypeLabel(block.blockType);
            return (
              <div key={block.id} className="mb-6 last:mb-0">
                <h2 className="text-lg sm:text-xl font-semibold mb-1 text-foreground">
                  {toRoman(blockIndex + 1)}. {blockTypeLabel}
                </h2>
                {block.blockTitle && <p className="italic text-muted-foreground mb-2">{block.blockTitle}</p>}

                {block.blockType === 'pooled-choices' && block.choicePool && block.choicePool.length > 0 && (
                  <div className="mb-3 p-3 border border-dashed rounded-md bg-muted/30">
                    <h3 className="font-medium text-sm mb-1">Choices for this section:</h3>
                    <ul className="list-none pl-0 columns-1 sm:columns-2 md:columns-3 gap-x-4">
                      {block.choicePool.map((poolOpt, poolOptIndex) => (
                        <li key={poolOpt.id} className="text-sm break-inside-avoid-column">
                          {getAlphabetLetter(poolOptIndex)}. {poolOpt.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {block.questions.map((question) => {
                  const questionDisplayNumber = globalQuestionNumber;
                  globalQuestionNumber += question.points; // Increment for the next question based on current question's points
                  const displayLabel = question.points > 1 ? `${questionDisplayNumber}-${globalQuestionNumber - 1}` : `${questionDisplayNumber}`;
                  const answerPrefix = (question.type === 'true-false' || question.type === 'pooled-choices') ? '____ ' : '';

                  return (
                    <div key={question.id} className="mb-3 pl-4">
                      <p className="font-medium">
                        {answerPrefix}{displayLabel}. {question.questionText}
                      </p>
                      {question.type === 'multiple-choice' && (
                        <ul className="list-none pl-5 mt-1 space-y-0.5">
                          {(question as MultipleChoiceQuestion).options.map((opt, optIndex) => (
                            <li key={opt.id}>{getAlphabetLetter(optIndex)}. {opt.text}</li>
                          ))}
                        </ul>
                      )}
                      {question.type === 'matching' && block.blockType === 'matching' && (
                         <div className="text-sm text-muted-foreground pl-5 mt-1"> (Match with choices provided for this section)</div>
                      )}
                       {/* Placeholder for actual answer input fields - to be added later */}
                    </div>
                  );
                })}
                {block.blockType === 'matching' && (
                    <div className="mt-2 pl-4">
                        <h4 className="font-medium text-sm mb-1">Match From:</h4>
                        <ul className="list-none pl-0 columns-1 sm:columns-2 gap-x-4">
                            {(block.questions as MatchingTypeQuestion[]).flatMap(q => q.pairs.map(p => p.response))
                                .filter((value, index, self) => self.indexOf(value) === index) // Unique responses
                                .sort((a,b) => { // Sort by letter if available, otherwise text
                                    const letterA = (block.questions as MatchingTypeQuestion[]).find(q => q.pairs.find(p => p.response === a))?.pairs.find(p => p.response === a)?.responseLetter || '';
                                    const letterB = (block.questions as MatchingTypeQuestion[]).find(q => q.pairs.find(p => p.response === b))?.pairs.find(p => p.response === b)?.responseLetter || '';
                                    if (letterA && letterB) return letterA.localeCompare(letterB);
                                    return a.localeCompare(b);
                                })
                                .map((response, index) => {
                                     const originalPair = (block.questions as MatchingTypeQuestion[]).flatMap(q => q.pairs).find(p => p.response === response);
                                     const letter = originalPair?.responseLetter || getAlphabetLetter(index); // Fallback if no letter
                                     return <li key={`match-resp-${index}`} className="text-sm break-inside-avoid-column">{letter}. {response}</li>;
                                })
                            }
                        </ul>
                    </div>
                )}
              </div>
            );
          })}
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button onClick={handleSubmitExam} size="lg" className="w-full sm:w-auto mx-auto">
            <Send className="mr-2 h-5 w-5" />
            Submit Exam (Coming Soon)
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

