
// src/app/take-exam/[examId]/answer-sheet/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import type { FullExamData, ExamBlock, ExamQuestion, MultipleChoiceQuestion, TrueFalseQuestion, Student, MatchingTypeQuestion, PooledChoicesQuestion } from '@/types/exam-types';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, AlertTriangle, Send, ArrowLeft, Info, UserCheck, Loader2 } from 'lucide-react';
import { QUESTION_TYPES } from '@/types/exam-types';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { SUBJECTS_COLLECTION_NAME, EXAMS_COLLECTION_NAME } from '@/config/firebase-constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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

interface StudentAnswers {
  [questionId: string]: string | null;
}

const getLocalStorageKey = (currentExamId: string | null) => {
  if (!currentExamId) return null;
  return `studentExamProgress-${currentExamId}`;
}

export default function AnswerSheetPage() {
  const params = useParams();
  const examId = params.examId as string;
  const router = useRouter();
  const { toast } = useToast();

  const [examToDisplay, setExamToDisplay] = useState<FullExamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedClassIdFromSession, setSelectedClassIdFromSession] = useState<string | null>(null);
  const [selectedClassNameFromSession, setSelectedClassNameFromSession] = useState<string | null>(null);
  const [selectedSubjectIdForExamFromSession, setSelectedSubjectIdForExamFromSession] = useState<string | null>(null);

  const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  
  const [selectedStudentIdFromDropdown, setSelectedStudentIdFromDropdown] = useState<string | null>(null);
  const [enteredFirstName, setEnteredFirstName] = useState('');
  const [enteredLastName, setEnteredLastName] = useState('');
  const [isNameConfirmed, setIsNameConfirmed] = useState(false);
  const [studentDetailsError, setStudentDetailsError] = useState<string | null>(null);
  
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswers>({});
  let globalQuestionNumber = 1;

  const [isSubmitConfirmDialogOpen, setIsSubmitConfirmDialogOpen] = useState(false);
  const [unansweredQuestionsList, setUnansweredQuestionsList] = useState<string[]>([]);
  const [currentTimeForDialog, setCurrentTimeForDialog] = useState('');
  const [studentInfoForDialog, setStudentInfoForDialog] = useState<{ name: string; className: string; } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);


  useEffect(() => {
    if (typeof window !== 'undefined' && examId) {
      setIsLoading(true);
      setError(null);
      setStudentDetailsError(null);
      let localExamData: FullExamData | null = null;

      try {
        const cachedExamDataString = sessionStorage.getItem(`examData-${examId}`);
        const cachedClassId = sessionStorage.getItem(`selectedClassId-${examId}`);
        const cachedClassName = sessionStorage.getItem(`selectedClassName-${examId}`);
        const cachedSubjectIdForExam = sessionStorage.getItem(`selectedSubjectIdForExam-${examId}`);


        if (cachedExamDataString) {
          localExamData = JSON.parse(cachedExamDataString);
          setExamToDisplay(localExamData);
        } else {
          setError("Exam data not found. Please return to the exam start page and try again.");
          setIsLoading(false);
          return;
        }

        if (cachedClassId) {
          setSelectedClassIdFromSession(cachedClassId);
        } else {
          setError("Selected class information not found. Please return to the exam start page.");
          setIsLoading(false);
          return;
        }
        if (cachedClassName) {
          setSelectedClassNameFromSession(cachedClassName);
        }
        if (cachedSubjectIdForExam) {
          setSelectedSubjectIdForExamFromSession(cachedSubjectIdForExam);
        } else {
          setError("Selected subject information for the exam not found. Please return to the exam start page.");
          setIsLoading(false);
          return;
        }


        const localStorageKey = getLocalStorageKey(examId);
        if (localStorageKey) {
          const savedProgressString = localStorage.getItem(localStorageKey);
          if (savedProgressString) {
            const savedProgress = JSON.parse(savedProgressString);
            if (savedProgress.selectedStudentId) setSelectedStudentIdFromDropdown(savedProgress.selectedStudentId);
            if (savedProgress.enteredFirstName) setEnteredFirstName(savedProgress.enteredFirstName);
            if (savedProgress.enteredLastName) setEnteredLastName(savedProgress.enteredLastName);
            if (typeof savedProgress.isNameConfirmed === 'boolean') setIsNameConfirmed(savedProgress.isNameConfirmed);
            
            if (savedProgress.studentAnswers && localExamData) {
              const validAnswers: StudentAnswers = {};
              const allQuestionIdsInExam = new Set<string>();
              localExamData.examBlocks.forEach(block => {
                block.questions.forEach(q => allQuestionIdsInExam.add(q.id));
              });

              for (const questionId in savedProgress.studentAnswers) {
                if (allQuestionIdsInExam.has(questionId)) {
                  validAnswers[questionId] = savedProgress.studentAnswers[questionId];
                }
              }
              setStudentAnswers(validAnswers);
            } else {
              setStudentAnswers({});
            }
          }
        }
      } catch (e) {
        console.error("Error processing initial data from storage:", e);
        setError("There was an issue loading exam or progress information. Please try again.");
        const lsKey = getLocalStorageKey(examId);
        if(lsKey) localStorage.removeItem(lsKey);
      }
    } else if (!examId) {
      setError("No exam ID provided.");
      setIsLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    const fetchStudents = async () => {
      // Use selectedSubjectIdForExamFromSession here
      if (!selectedClassIdFromSession || !selectedSubjectIdForExamFromSession) { 
        if (examToDisplay && !selectedSubjectIdForExamFromSession) {
             setStudentDetailsError("Exam configuration is missing subject ID, cannot fetch student list.");
        }
        setIsLoadingStudents(false);
        setIsLoading(false);
        return;
      }
      setIsLoadingStudents(true);
      setStudentDetailsError(null);
      try {
        // Use selectedSubjectIdForExamFromSession
        const studentsRef = collection(db, SUBJECTS_COLLECTION_NAME, selectedSubjectIdForExamFromSession, "classes", selectedClassIdFromSession, "students");
        const q = query(studentsRef, orderBy("lastName", "asc"), orderBy("firstName", "asc"));
        const querySnapshot = await getDocs(q);
        const fetchedStudents: Student[] = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Student));
        setStudentsInClass(fetchedStudents);
        if (fetchedStudents.length === 0) {
            setStudentDetailsError("No students found for the selected class. Please check with your instructor.");
        }
      } catch (e) {
        console.error("Error fetching students for class:", e);
        setStudentDetailsError("Could not load the student list for your class.");
      } finally {
        setIsLoadingStudents(false);
        setIsLoading(false); 
      }
    };

    if (selectedClassIdFromSession && examToDisplay && selectedSubjectIdForExamFromSession) {
      fetchStudents();
    } else if (examToDisplay && (!selectedClassIdFromSession || !selectedSubjectIdForExamFromSession)) {
      setIsLoading(false); // Not enough info to fetch students
    }
  }, [selectedClassIdFromSession, examToDisplay, selectedSubjectIdForExamFromSession]);


  useEffect(() => {
    if (examId && examToDisplay && !isLoading && typeof window !== 'undefined') {
      const localStorageKey = getLocalStorageKey(examId);
      if (localStorageKey) {
        const progressToSave = {
          selectedStudentId: selectedStudentIdFromDropdown,
          enteredFirstName,
          enteredLastName,
          isNameConfirmed,
          studentAnswers,
        };
        localStorage.setItem(localStorageKey, JSON.stringify(progressToSave));
      }
    }
  }, [
    examId,
    selectedStudentIdFromDropdown,
    enteredFirstName,
    enteredLastName,
    isNameConfirmed,
    studentAnswers,
    examToDisplay,
    isLoading
  ]);


  const handleAnswerChange = (questionId: string, answer: string | null) => {
    setStudentAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNameConfirmation = () => {
    if (!selectedStudentIdFromDropdown || !enteredFirstName.trim() || !enteredLastName.trim()) {
      setStudentDetailsError("Please select your name and enter your first and last name.");
      return;
    }
    const selectedStudent = studentsInClass.find(s => s.id === selectedStudentIdFromDropdown);
    if (selectedStudent && 
        selectedStudent.firstName.trim().toLowerCase() === enteredFirstName.trim().toLowerCase() &&
        selectedStudent.lastName.trim().toLowerCase() === enteredLastName.trim().toLowerCase()) {
      setIsNameConfirmed(true);
      setStudentDetailsError(null);
    } else {
      setStudentDetailsError("The entered first and last name do not match the selected student. Please try again.");
      setIsNameConfirmed(false);
    }
  };

  const checkUnansweredQuestions = () => {
    if (!examToDisplay) return [];
    const unanswered: string[] = [];
    let currentQNumber = 1;
    examToDisplay.examBlocks.forEach(block => {
      block.questions.forEach(question => {
        const questionLabel = question.points > 1 ? `${currentQNumber}-${currentQNumber + question.points - 1}` : `${currentQNumber}`;
        if (!studentAnswers[question.id] || studentAnswers[question.id]?.trim() === "") {
          unanswered.push(questionLabel);
        }
        currentQNumber += question.points;
      });
    });
    return unanswered;
  };

  const handleOpenSubmitConfirmDialog = () => {
    const unanswered = checkUnansweredQuestions();
    setUnansweredQuestionsList(unanswered);

    const student = studentsInClass.find(s => s.id === selectedStudentIdFromDropdown);
    const studentName = student ? `${student.firstName} ${student.lastName}` : "N/A";
    const className = selectedClassNameFromSession || "N/A";

    setStudentInfoForDialog({ name: studentName, className });
    setCurrentTimeForDialog(format(new Date(), "PPP p"));
    setIsSubmitConfirmDialogOpen(true);
  };

  const handleActualExamSubmit = async () => {
    if (!examId || !selectedStudentIdFromDropdown || !selectedClassIdFromSession || !selectedSubjectIdForExamFromSession) {
        toast({ title: "Error", description: "Missing information to submit. Please ensure all details are correct.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    try {
        const submissionPayload = {
            examId,
            studentId: selectedStudentIdFromDropdown,
            classId: selectedClassIdFromSession,
            subjectId: selectedSubjectIdForExamFromSession,
            answers: studentAnswers,
        };

        const response = await fetch('/api/score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(submissionPayload),
        });

        const result = await response.json();

        if (response.ok) {
            const localStorageKey = getLocalStorageKey(examId);
            if (localStorageKey) {
                localStorage.removeItem(localStorageKey);
            }
            toast({ 
                title: "Exam Submitted!", 
                description: `Your score: ${result.achievedScore} / ${result.maxPossibleScore}. Results saved.`,
            });
            setIsSubmitConfirmDialogOpen(false);
            // router.push(`/take-exam/submission-success?examId=${examId}`); // Optional: redirect to a success page
        } else {
            toast({ title: "Submission Failed", description: result.error || "There was an error submitting your exam. Please try again.", variant: "destructive" });
        }
    } catch (e) {
        console.error("Error submitting exam:", e);
        toast({ title: "Submission Failed", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Skeleton className="h-10 w-1/2 mb-2" />
        <Skeleton className="h-6 w-3/4 mb-6" />
        <Skeleton className="h-20 w-full max-w-2xl mb-4" />
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
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
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
        <CardContent className="p-4 sm:p-6 md:p-8">
          {!isNameConfirmed && (
            <Card className="mb-6 shadow-md bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl text-foreground">Student Identification</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Please select your name and confirm by typing it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="studentSelect" className="text-sm">Select Your Name</Label>
                  {isLoadingStudents ? (
                    <Skeleton className="h-10 w-full" />
                  ) : studentsInClass.length > 0 ? (
                    <Select
                      onValueChange={setSelectedStudentIdFromDropdown}
                      value={selectedStudentIdFromDropdown || ""}
                      disabled={isLoadingStudents}
                    >
                      <SelectTrigger id="studentSelect" className="w-full">
                        <SelectValue placeholder="-- Select your name --" />
                      </SelectTrigger>
                      <SelectContent>
                        {studentsInClass.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.lastName}, {student.firstName} {student.middleName && `${student.middleName.charAt(0)}.`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                     <p className="text-sm text-muted-foreground">{studentDetailsError || "Student list is unavailable for this class."}</p>
                  )}
                </div>

                {selectedStudentIdFromDropdown && (
                  <>
                    <div>
                      <Label htmlFor="firstNameConfirm" className="text-sm">Enter Your First Name</Label>
                      <Input
                        id="firstNameConfirm"
                        value={enteredFirstName}
                        onChange={(e) => setEnteredFirstName(e.target.value)}
                        placeholder="First Name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastNameConfirm" className="text-sm">Enter Your Last Name</Label>
                      <Input
                        id="lastNameConfirm"
                        value={enteredLastName}
                        onChange={(e) => setEnteredLastName(e.target.value)}
                        placeholder="Last Name"
                      />
                    </div>
                    <Button onClick={handleNameConfirmation} className="w-full sm:w-auto">
                      <UserCheck className="mr-2 h-4 w-4"/> Confirm Name
                    </Button>
                  </>
                )}
                {studentDetailsError && !isLoadingStudents && (
                  <p className="text-sm text-destructive">{studentDetailsError}</p>
                )}
              </CardContent>
            </Card>
          )}

          {isNameConfirmed && (
            <div className="prose prose-sm sm:prose-base max-w-none">
              {examToDisplay.examBlocks.map((block, blockIndex) => {
                const blockTypeLabel = getQuestionTypeLabel(block.blockType);
                if (blockIndex === 0) globalQuestionNumber = 1;

                return (
                  <div key={block.id} className="mb-6 last:mb-0">
                    <h2 className="text-lg sm:text-xl font-semibold mb-1 text-foreground">
                      {toRoman(blockIndex + 1)}. {blockTypeLabel}
                    </h2>
                    {block.blockTitle && <p className="italic text-muted-foreground mb-2 text-sm sm:text-base">{block.blockTitle}</p>}

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
                      globalQuestionNumber += question.points;
                      const displayLabel = question.points > 1 ? `${questionDisplayNumber}-${globalQuestionNumber - 1}` : `${questionDisplayNumber}`;

                      if (question.type === 'pooled-choices') {
                        return (
                          <div key={question.id} className="mb-4 pl-4 flex items-start gap-2 sm:gap-3">
                            <div className="flex-shrink-0 pt-0.5">
                              <select
                                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-24"
                                value={studentAnswers[question.id] || ""}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                aria-label={`Answer for question ${displayLabel}`}
                              >
                                <option value="" disabled>Answer</option>
                                {block.choicePool?.map((_poolOpt, poolOptIndex) => (
                                  <option key={poolOptIndex} value={getAlphabetLetter(poolOptIndex)}>
                                    {getAlphabetLetter(poolOptIndex)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <p className="font-medium flex-grow text-sm sm:text-base">
                              {displayLabel}. {question.questionText}
                            </p>
                          </div>
                        );
                      } else {
                        return (
                          <div key={question.id} className="mb-4 pl-4">
                            <p className="font-medium mb-1 text-sm sm:text-base">
                              {displayLabel}. {question.questionText}
                            </p>
                            {question.type === 'multiple-choice' && (
                              <RadioGroup
                                name={question.id}
                                value={studentAnswers[question.id] || ""}
                                onValueChange={(value) => handleAnswerChange(question.id, value)}
                                className="space-y-1 pl-5 mt-1"
                              >
                                {(question as MultipleChoiceQuestion).options.map((opt, optIndex) => (
                                  <div key={opt.id} className="flex items-center space-x-2">
                                    <RadioGroupItem value={opt.id} id={`option-${question.id}-${opt.id}`} />
                                    <Label htmlFor={`option-${question.id}-${opt.id}`} className="font-normal cursor-pointer text-sm sm:text-base">
                                      {getAlphabetLetter(optIndex)}. {opt.text}
                                    </Label>
                                  </div>
                                ))}
                              </RadioGroup>
                            )}
                            {question.type === 'true-false' && (
                              <RadioGroup
                                name={question.id}
                                value={studentAnswers[question.id] || ""}
                                onValueChange={(value) => handleAnswerChange(question.id, value)}
                                className="flex space-x-4 pl-5 mt-1"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="true" id={`true-${question.id}`} />
                                  <Label htmlFor={`true-${question.id}`} className="font-normal cursor-pointer text-sm sm:text-base">True</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="false" id={`false-${question.id}`} />
                                  <Label htmlFor={`false-${question.id}`} className="font-normal cursor-pointer text-sm sm:text-base">False</Label>
                                </div>
                              </RadioGroup>
                            )}
                            {question.type === 'matching' && (
                              <div className="pl-5 mt-1">
                                <input
                                  type="text"
                                  placeholder="Enter matching letter"
                                  className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full max-w-xs"
                                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                  value={studentAnswers[question.id] || ""}
                                />
                              </div>
                            )}
                          </div>
                        );
                      }
                    })}
                    {block.blockType === 'matching' && (
                        <div className="mt-2 pl-4">
                            <h4 className="font-medium text-sm mb-1">Match From:</h4>
                            <ul className="list-none pl-0 columns-1 sm:columns-2 gap-x-4">
                                {(block.questions as MatchingTypeQuestion[]).flatMap(q => (q as MatchingTypeQuestion).pairs.map(p => p.response))
                                    .filter((value, index, self) => self.indexOf(value) === index)
                                    .sort((a, b) => {
                                        const pairA = (block.questions as MatchingTypeQuestion[]).flatMap(q => q.pairs).find(p => p.response === a);
                                        const pairB = (block.questions as MatchingTypeQuestion[]).flatMap(q => q.pairs).find(p => p.response === b);
                                        const letterA = pairA?.responseLetter || '';
                                        const letterB = pairB?.responseLetter || '';
                                        if (letterA && letterB) return letterA.localeCompare(letterB);
                                        return String(a).localeCompare(String(b));
                                    })
                                    .map((response, index) => {
                                         const originalPair = (block.questions as MatchingTypeQuestion[]).flatMap(q => q.pairs).find(p => p.response === response);
                                         const letter = originalPair?.responseLetter || getAlphabetLetter(index);
                                         return <li key={`match-resp-${index}`} className="text-sm break-inside-avoid-column">{letter}. {response}</li>;
                                    })
                                }
                            </ul>
                        </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button 
            onClick={handleOpenSubmitConfirmDialog} 
            size="lg" 
            className="w-full sm:w-auto mx-auto"
            disabled={!isNameConfirmed || isLoading || isLoadingStudents || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            <Send className="mr-2 h-5 w-5" />
            Submit Exam
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={isSubmitConfirmDialogOpen} onOpenChange={setIsSubmitConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Please review your details and ensure all answers are final.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm">
            {studentInfoForDialog && (
              <>
                <p><strong>Student:</strong> {studentInfoForDialog.name}</p>
                <p><strong>Class:</strong> {studentInfoForDialog.className}</p>
              </>
            )}
            <p><strong>Submission Time:</strong> {currentTimeForDialog}</p>
            {unansweredQuestionsList.length > 0 ? (
              <div>
                <p className="text-destructive font-semibold">You have unanswered questions:</p>
                <ul className="list-disc list-inside text-destructive text-xs max-h-24 overflow-y-auto">
                  {unansweredQuestionsList.map((qNum, index) => (
                    <li key={index}>Question {qNum}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-green-600">All questions appear to be answered. Good job!</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsSubmitConfirmDialogOpen(false)} disabled={isSubmitting}>
                Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleActualExamSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

    
