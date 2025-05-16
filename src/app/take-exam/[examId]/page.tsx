
// src/app/take-exam/[examId]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useMemo } from 'react';
import { doc, getDoc, collection, getDocs, query, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { FullExamData, ExamAssignment, ClassInfoForDropdown, ExamQuestion, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion, PooledChoicesQuestion, ExamBlock } from '@/types/exam-types';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, AlertTriangle, Info, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ClassForSelection {
  id: string;
  name: string; // e.g., "Section A (Grade 10)"
}

function sanitizeExamDataForStudent(fullExamData: FullExamData): FullExamData {
  const sanitizedBlocks = fullExamData.examBlocks.map(block => {
    const sanitizedQuestions = block.questions.map(question => {
      const baseSanitizedQuestion = { ...question };
      if (question.type === 'multiple-choice') {
        (baseSanitizedQuestion as MultipleChoiceQuestion).options = (question as MultipleChoiceQuestion).options.map(opt => ({ ...opt, isCorrect: false }));
      } else if (question.type === 'true-false') {
        (baseSanitizedQuestion as TrueFalseQuestion).correctAnswer = null;
      } else if (question.type === 'matching') {
        // For matching, students need to see both premises and responses.
        // The 'correctness' is determined by their matching activity.
        // No direct answer to remove here from the core question data.
      } else if (question.type === 'pooled-choices') {
        // Students need the choice pool (on the block) but not the direct answer for each question.
        (baseSanitizedQuestion as PooledChoicesQuestion).correctAnswersFromPool = [];
      }
      // Remove points if not needed by student, or keep for student reference
      // delete baseSanitizedQuestion.points; // Example: if points are not for student view
      return baseSanitizedQuestion;
    });
    return { ...block, questions: sanitizedQuestions as ExamQuestion[] }; // Ensure type cast
  });
  return { ...fullExamData, examBlocks: sanitizedBlocks as ExamBlock[] }; // Ensure type cast
}


export default function TakeExamLandingPage() {
  const params = useParams();
  const examId = params.examId as string;
  const router = useRouter();

  const [examDetails, setExamDetails] = useState<FullExamData | null>(null);
  const [isLoadingExam, setIsLoadingExam] = useState(true);
  const [examError, setExamError] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<ExamAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);

  const [availableClassesForSelection, setAvailableClassesForSelection] = useState<ClassForSelection[]>([]);
  const [isLoadingClassDetails, setIsLoadingClassDetails] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [isExamTime, setIsExamTime] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch full exam details (including blocks and questions)
  useEffect(() => {
    if (examId) {
      const fetchFullExamDetails = async () => {
        setIsLoadingExam(true);
        setExamError(null);
        try {
          const examDocRef = doc(db, EXAMS_COLLECTION_NAME, examId);
          const examSnap = await getDoc(examDocRef);

          if (examSnap.exists()) {
            const data = examSnap.data() as Omit<FullExamData, 'id' | 'examBlocks'>;
            if (data.status !== 'Published') {
              setExamError("This exam is not currently published or active.");
              setExamDetails(null);
              return;
            }

            const loadedBlocks: ExamBlock[] = [];
            const blocksCollectionRef = collection(db, EXAMS_COLLECTION_NAME, examId, "questionBlocks");
            const blocksQuery = query(blocksCollectionRef, orderBy("orderIndex"));
            const blocksSnapshot = await getDocs(blocksQuery);

            for (const blockDoc of blocksSnapshot.docs) {
              const blockData = blockDoc.data();
              const loadedQuestions: ExamQuestion[] = [];
              const questionsCollectionRef = collection(db, EXAMS_COLLECTION_NAME, examId, "questionBlocks", blockDoc.id, "questions");
              const questionsQuery = query(questionsCollectionRef, orderBy("orderIndex"));
              const questionsSnapshot = await getDocs(questionsQuery);

              questionsSnapshot.forEach(questionDocSnap => {
                loadedQuestions.push({ id: questionDocSnap.id, ...questionDocSnap.data() } as ExamQuestion);
              });
              loadedBlocks.push({ id: blockDoc.id, ...blockData, questions: loadedQuestions } as ExamBlock);
            }
            
            const fullExamData: FullExamData = { id: examSnap.id, ...data, examBlocks: loadedBlocks };
            setExamDetails(fullExamData);

            // Sanitize and cache data for student
            if (typeof window !== 'undefined' && fullExamData.status === 'Published') {
              const sanitizedData = sanitizeExamDataForStudent(fullExamData);
              sessionStorage.setItem(`examData-${examId}`, JSON.stringify(sanitizedData));
            }

          } else {
            setExamError("Exam not found. The link may be invalid or the exam may have been removed.");
          }
        } catch (e) {
          console.error("Error fetching full exam details:", e);
          setExamError("An error occurred while trying to load the exam details.");
        } finally {
          setIsLoadingExam(false);
        }
      };
      fetchFullExamDetails();
    } else {
      setExamError("No exam ID provided.");
      setIsLoadingExam(false);
    }
  }, [examId]);

  // Fetch assignments for the exam
  useEffect(() => {
    if (examId && examDetails?.status === 'Published') {
      const fetchAssignments = async () => {
        setIsLoadingAssignments(true);
        try {
          const assignmentsRef = collection(db, EXAMS_COLLECTION_NAME, examId, "assignments");
          const assignmentsSnap = await getDocs(assignmentsRef);
          const fetchedAssignments: ExamAssignment[] = [];
          assignmentsSnap.forEach(docSnap => {
            fetchedAssignments.push({ id: docSnap.id, ...docSnap.data() } as ExamAssignment);
          });
          setAssignments(fetchedAssignments);
        } catch (e) {
          console.error("Error fetching exam assignments:", e);
          setAccessMessage("Could not load schedule information for this exam.");
        } finally {
          setIsLoadingAssignments(false);
        }
      };
      fetchAssignments();
    } else {
      setIsLoadingAssignments(false);
    }
  }, [examId, examDetails?.status]);

  // Populate available classes for selection
  useEffect(() => {
    if (assignments.length > 0 && examDetails?.subjectId) {
      const fetchClassDetailsForAssignments = async () => {
        setIsLoadingClassDetails(true);
        const classSelectionPromises = assignments.map(async (assignment) => {
          try {
            const classDocRef = doc(db, SUBJECTS_COLLECTION_NAME, examDetails.subjectId!, "classes", assignment.classId);
            const classSnap = await getDoc(classDocRef);
            if (classSnap.exists()) {
              const classData = classSnap.data();
              return {
                id: assignment.classId,
                name: `${classData.sectionName} (${classData.yearGrade})`,
              };
            }
          } catch (e) {
            console.error(`Error fetching details for class ${assignment.classId}:`, e);
          }
          return null;
        });

        const results = (await Promise.all(classSelectionPromises)).filter(Boolean) as ClassForSelection[];
        const uniqueResults = results.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
        setAvailableClassesForSelection(uniqueResults);
        setIsLoadingClassDetails(false);
      };
      fetchClassDetailsForAssignments();
    } else if (assignments.length > 0 && !examDetails?.subjectId) {
        setAccessMessage("Exam configuration incomplete (missing subject details). Cannot determine classes.");
        setAvailableClassesForSelection([]);
        setIsLoadingClassDetails(false);
    } else {
      setAvailableClassesForSelection([]);
      setIsLoadingClassDetails(false);
    }
  }, [assignments, examDetails?.subjectId]);

  // Check schedule when selectedClassId or assignments change
  useEffect(() => {
    if (!selectedClassId || assignments.length === 0) {
      setIsExamTime(false);
      if (selectedClassId && assignments.length > 0 && !isLoadingAssignments && !isLoadingClassDetails) {
        setAccessMessage("No schedule found for the selected class.");
      } else if (selectedClassId && (isLoadingAssignments || isLoadingClassDetails)) {
        // Handled by main loading indicator
      } else {
        setAccessMessage(null);
      }
      return;
    }

    const assignment = assignments.find(a => a.classId === selectedClassId);
    if (assignment && assignment.assignedDateTime) {
      const assignedTime = assignment.assignedDateTime.toDate();
      const now = new Date();
      setCurrentTime(now);

      if (now >= assignedTime) {
        setIsExamTime(true);
        setAccessMessage(null); // Clear previous messages
      } else {
        setIsExamTime(false);
        setAccessMessage(`This exam is scheduled for your class on ${format(assignedTime, "PPP 'at' p")}. Please return at that time.`);
      }
    } else {
      setIsExamTime(false);
      setAccessMessage("No specific schedule found for your selected class in this exam.");
    }
  }, [selectedClassId, assignments, isLoadingAssignments, isLoadingClassDetails]);

  // Periodically re-check time
  useEffect(() => {
    if (!isExamTime && accessMessage && accessMessage.startsWith("This exam is scheduled")) {
      const interval = setInterval(() => {
        const assignment = assignments.find(a => a.classId === selectedClassId);
        if (assignment && assignment.assignedDateTime) {
          const assignedTime = assignment.assignedDateTime.toDate();
          const now = new Date();
          setCurrentTime(now);
          if (now >= assignedTime) {
            setIsExamTime(true);
            setAccessMessage(null);
            clearInterval(interval);
          }
        } else {
          clearInterval(interval);
        }
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isExamTime, accessMessage, assignments, selectedClassId]);

  const handleStartExam = () => {
    if (examId && isExamTime && selectedClassId) {
      router.push(`/take-exam/${examId}/answer-sheet`);
    }
  };

  if (isLoadingExam) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader className="text-center"> <Skeleton className="h-8 w-3/4 mx-auto mb-2" /> <Skeleton className="h-5 w-1/2 mx-auto" /> </CardHeader>
          <CardContent className="py-10 text-center space-y-4"> <Skeleton className="h-10 w-full max-w-xs mx-auto" /> <Skeleton className="h-6 w-2/3 mx-auto" /> <Skeleton className="h-12 w-1/2 mx-auto" /> </CardContent>
        </Card>
      </main>
    );
  }

  if (examError) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
        <p className="text-muted-foreground max-w-md">{examError}</p>
      </main>
    );
  }

  if (!examDetails) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Exam Not Available</h1>
        <p className="text-muted-foreground">The requested exam could not be loaded or is not published.</p>
      </main>
    );
  }

  const isPageLoading = isLoadingAssignments || isLoadingClassDetails;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-primary"> {examDetails.title} </CardTitle>
          {examDetails.description && ( <CardDescription className="text-sm sm:text-base text-muted-foreground mt-2"> {examDetails.description} </CardDescription> )}
          <CardDescription className="text-xs sm:text-sm text-muted-foreground/80 mt-1"> Total Points: {examDetails.totalPoints} | Total Questions: {examDetails.totalQuestions} </CardDescription>
        </CardHeader>
        <CardContent className="py-8 sm:py-10 text-center space-y-4">
          {isPageLoading ? (
            <> <Skeleton className="h-10 w-full max-w-xs mx-auto" /> <Skeleton className="h-5 w-1/2 mx-auto" /> </>
          ) : availableClassesForSelection.length > 0 ? (
            <div className="w-full max-w-xs mx-auto">
              <Select onValueChange={setSelectedClassId} value={selectedClassId || undefined} disabled={isPageLoading}>
                <SelectTrigger className="w-full"> <SelectValue placeholder="Select your class section" /> </SelectTrigger>
                <SelectContent> {availableClassesForSelection.map((cls) => ( <SelectItem key={cls.id} value={cls.id}> {cls.name} </SelectItem> ))} </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center justify-center text-muted-foreground p-3 border rounded-md bg-muted/50">
              <Info className="h-5 w-5 mr-2" />
              <span>No class schedules found for this exam, or exam setup is incomplete.</span>
            </div>
          )}

          {accessMessage && !isPageLoading && (
            <div className={`p-3 border rounded-md text-sm ${isExamTime ? 'border-green-500 bg-green-50 text-green-700' : 'border-amber-500 bg-amber-50 text-amber-700'} flex items-center justify-center`}>
              <Clock className="h-5 w-5 mr-2" />
              <span>{accessMessage}</span>
            </div>
          )}

          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4"
            onClick={handleStartExam}
            disabled={!isExamTime || !selectedClassId || isPageLoading || isLoadingExam}
          >
            {isLoadingExam || isPageLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            Start Exam
          </Button>
        </CardContent>
        <CardFooter className="text-center justify-center"> <p className="text-xs text-muted-foreground"> Current time: {format(currentTime, "PPP p")} </p> </CardFooter>
      </Card>
    </main>
  );
}
