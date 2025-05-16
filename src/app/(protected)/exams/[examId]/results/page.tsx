
// src/app/(protected)/exams/[examId]/results/page.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, getDocs, query, where, orderBy, setDoc, addDoc, serverTimestamp, Timestamp, onSnapshot, type Unsubscribe, writeBatch } from 'firebase/firestore';
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { ExamSummaryData, ClassInfoForDropdown, Student, StudentExamScore } from '@/types/exam-types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BarChart3, Users, AlertTriangle, Info, Save, Loader2, ChevronDown, ChevronUp, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const SCORES_SUBCOLLECTION_NAME = 'scores';

interface ClassWithStudentsAndScores {
  classInfo: ClassInfoForDropdown;
  students: Student[];
}

type ScoreStatus = 'saved' | 'dirty' | 'invalid' | 'emptyAndUnchanged' | 'emptyAndDirty';

interface ScoreStatusDetails {
  status: ScoreStatus;
  icon: React.ElementType | null;
  color?: string;
  isSavable: boolean;
  parsedScore: number | null;
  tooltip: string;
}

export default function ExamResultsPage() {
  const params = useParams();
  const examId = params.examId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [examDetails, setExamDetails] = useState<ExamSummaryData | null>(null);
  const [groupedStudentScores, setGroupedStudentScores] = useState<ClassWithStudentsAndScores[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedStates, setCollapsedStates] = useState<Record<string, boolean>>({});
  const [isSavingAllInProgress, setIsSavingAllInProgress] = useState<Record<string, boolean>>({});
  const [classIdToResetConfirm, setClassIdToResetConfirm] = useState<string | null>(null);
  const [isBackConfirmDialogOpen, setIsBackConfirmDialogOpen] = useState(false);


  const toggleCollapse = (classId: string) => {
    setCollapsedStates(prev => ({
      ...prev,
      [classId]: !(prev[classId] ?? false)
    }));
  };

  const getScoreStatus = useCallback((student: Student): ScoreStatusDetails => {
    const { currentScoreInput, score } = student; // score is from DB, currentScoreInput is from UI
    const inputTrimmed = currentScoreInput?.trim();

    if (inputTrimmed === undefined || inputTrimmed === "") {
      // Input is empty
      if (score === null || score === undefined) {
        // DB score is also null/undefined, so no change if input is empty
        return { status: 'emptyAndUnchanged', icon: null, isSavable: false, parsedScore: null, tooltip: "No score entered." };
      }
      // DB score exists, but input is empty. This is a change (clearing the score).
      return { status: 'emptyAndDirty', icon: Save, color: "text-amber-600", isSavable: true, parsedScore: null, tooltip: "Score will be cleared." };
    }

    // Input is not empty
    const parsedInput = parseFloat(inputTrimmed);

    if (isNaN(parsedInput)) {
      return { status: 'invalid', icon: AlertTriangle, color: "text-destructive", isSavable: false, parsedScore: null, tooltip: "Invalid input. Score must be a number." };
    }
    
    // Specific check for when DB score is null/undefined and user enters 0.
    // This is a valid change (from no score to score of 0).
    if ((score === null || score === undefined) && parsedInput === 0) {
        return { status: 'dirty', icon: Save, color: "text-amber-600", isSavable: true, parsedScore: parsedInput, tooltip: "Unsaved changes." };
    }

    // Compare parsed input with DB score
    if (parsedInput === score) {
      return { status: 'saved', icon: CheckCircle2, color: "text-green-600", isSavable: false, parsedScore: parsedInput, tooltip: "Score saved." };
    }

    // Parsed input is different from DB score
    return { status: 'dirty', icon: Save, color: "text-amber-600", isSavable: true, parsedScore: parsedInput, tooltip: "Unsaved changes." };
  }, []);


  useEffect(() => {
    if (!user || !examId || authLoading) {
        if (!authLoading && !user) router.push('/login');
        return;
    }

    setIsLoading(true);
    setError(null);
    let isMounted = true;
    const unsubscribes: Unsubscribe[] = [];

    const fetchExamAndInitialData = async () => {
        try {
            const examDocRef = doc(db, EXAMS_COLLECTION_NAME, examId);
            const examSnap = await getDoc(examDocRef);

            if (!isMounted) return;

            if (!examSnap.exists() || examSnap.data().userId !== user.uid) {
                setError("Exam not found or you don't have permission to view its results.");
                toast({ title: "Error", description: "Exam not found or access denied.", variant: "destructive" });
                setIsLoading(false);
                return;
            }
            const currentExamDetails = { id: examSnap.id, ...examSnap.data() } as ExamSummaryData;
            setExamDetails(currentExamDetails);

            if (!currentExamDetails.classIds || currentExamDetails.classIds.length === 0) {
                setError("This exam is not assigned to any classes.");
                setIsLoading(false);
                return;
            }

            // Fetch all user classes once
            const allUserClassesMap = new Map<string, ClassInfoForDropdown>();
            const subjectsCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME);
            const subjectsQuery = query(subjectsCollectionRef, where("userId", "==", user.uid));
            const subjectsSnapshot = await getDocs(subjectsQuery);

            for (const subjectDoc of subjectsSnapshot.docs) {
                const subjectData = subjectDoc.data();
                const classesSubCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME, subjectDoc.id, "classes");
                const classesQuerySnapshot = await getDocs(query(classesSubCollectionRef, where("userId", "==", user.uid)));
                classesQuerySnapshot.forEach((classDoc) => {
                    const classData = classDoc.data();
                    allUserClassesMap.set(classDoc.id, {
                        id: classDoc.id, subjectId: subjectDoc.id, subjectName: subjectData.name,
                        subjectCode: subjectData.code, sectionName: classData.sectionName,
                        yearGrade: classData.yearGrade, code: classData.code,
                    });
                });
            }

            const assignedClassesInfo: ClassInfoForDropdown[] = currentExamDetails.classIds
                .map(id => allUserClassesMap.get(id))
                .filter(Boolean) as ClassInfoForDropdown[];

            if (assignedClassesInfo.length === 0 && currentExamDetails.classIds.length > 0) {
                setError("Could not find details for one or more classes assigned to this exam. The classes might have been deleted. Please check class assignments in 'Edit Exam'.");
                setIsLoading(false); 
                return;
            }
             if (assignedClassesInfo.length === 0 && currentExamDetails.classIds.length === 0) {
                setError("This exam is not assigned to any classes yet. Please assign classes via 'Publish Exam'.");
                setIsLoading(false);
                return;
            }


            // Initial structure for groupedStudentScores
            const initialGroups: ClassWithStudentsAndScores[] = await Promise.all(assignedClassesInfo.map(async classInfo => {
                const studentsRef = collection(db, SUBJECTS_COLLECTION_NAME, classInfo.subjectId, "classes", classInfo.id, "students");
                const studentsQuery = query(studentsRef, orderBy("lastName", "asc"), orderBy("firstName", "asc"));
                const studentsSnapshot = await getDocs(studentsQuery);
                const students: Student[] = studentsSnapshot.docs.map(studentDoc => {
                    const studentData = studentDoc.data() as Student; // Omit id from Student if it's just data
                    return {
                        ...studentData,
                        id: studentDoc.id, // Ensure id is assigned from studentDoc.id
                        score: null, // Will be populated by listener
                        currentScoreInput: '',
                        isSavingScore: false,
                        scoreDocId: null,
                    };
                });
                return { classInfo, students };
            }));
            if(isMounted) setGroupedStudentScores(initialGroups);


            // Set up real-time listeners for scores for each class
            initialGroups.forEach((group, groupIndex) => {
                const scoresRef = collection(db, SUBJECTS_COLLECTION_NAME, group.classInfo.subjectId, "classes", group.classInfo.id, SCORES_SUBCOLLECTION_NAME);
                const scoresQuery = query(scoresRef, where("examId", "==", examId), where("userId", "==", user.uid));

                const unsubscribe = onSnapshot(scoresQuery, (scoresSnapshot) => {
                    if (!isMounted) return;
                    const scoresMap = new Map<string, { score: number | null; scoreDocId: string }>();
                    scoresSnapshot.forEach(scoreDoc => {
                        const data = scoreDoc.data() as StudentExamScore;
                        scoresMap.set(data.studentId, { score: data.score, scoreDocId: scoreDoc.id });
                    });

                    setGroupedStudentScores(prevGroups => {
                        const newGroups = prevGroups.map(g => ({ ...g, students: [...g.students] })); // Deep clone for safety

                        if (newGroups[groupIndex]) { // Check if the group exists
                            newGroups[groupIndex].students = newGroups[groupIndex].students.map(student => {
                                const existingScoreData = scoresMap.get(student.id);
                                const dbScore = existingScoreData?.score ?? null; // Score from the database
                                
                                // Preserve user input if it's different from the previous DB score or if it's actively being edited
                                // A simple check: if currentScoreInput is non-empty and differs from the student's old score,
                                // or if input is empty but old score was not, keep currentScoreInput.
                                // Otherwise, update currentScoreInput from the database.
                                let newCurrentScoreInput = student.currentScoreInput;
                                const oldDbScoreForStudent = student.score; // Score previously in state

                                if (student.currentScoreInput === undefined || student.currentScoreInput === null || student.currentScoreInput === "") {
                                    // If UI input is empty, update it from DB unless old DB score was null and new is null
                                    if (!(oldDbScoreForStudent === null && dbScore === null)){
                                        newCurrentScoreInput = dbScore !== null ? String(dbScore) : "";
                                    }
                                } else {
                                    // UI input has a value. Only update it if it matches the OLD db score
                                    // This prevents overwriting active edits.
                                    const currentInputAsNumber = parseFloat(student.currentScoreInput);
                                    if (!isNaN(currentInputAsNumber) && currentInputAsNumber === oldDbScoreForStudent) {
                                         newCurrentScoreInput = dbScore !== null ? String(dbScore) : "";
                                    } else if (isNaN(currentInputAsNumber) && oldDbScoreForStudent === null) {
                                        // If input was invalid (e.g. "abc") and old score was null, also update from DB
                                        newCurrentScoreInput = dbScore !== null ? String(dbScore) : "";
                                    }
                                }

                                return {
                                    ...student,
                                    score: dbScore,
                                    currentScoreInput: newCurrentScoreInput,
                                    scoreDocId: existingScoreData?.scoreDocId ?? null,
                                };
                            });
                        }
                        return newGroups;
                    });
                }, (error) => {
                    console.error(`Error listening to scores for class ${group.classInfo.id}: `, error);
                    if(isMounted) setError(prevError => prevError || `Error fetching scores for ${group.classInfo.sectionName}.`);
                });
                unsubscribes.push(unsubscribe);
            });

        } catch (e) {
            if (isMounted) {
                console.error("Error fetching exam results data: ", e);
                setError("Failed to load exam results. Please try again.");
                toast({ title: "Error", description: "Could not fetch exam results.", variant: "destructive" });
            }
        } finally {
            if (isMounted) setIsLoading(false);
        }
    };

    fetchExamAndInitialData();

    return () => {
        isMounted = false;
        unsubscribes.forEach(unsub => unsub());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, user, authLoading, toast, router]); // Removed getScoreStatus from dependency array


  const handleScoreInputChange = (classIdx: number, studentIdx: number, value: string) => {
    setGroupedStudentScores(prev => {
      const newGroups = [...prev];
      if (newGroups[classIdx] && newGroups[classIdx].students[studentIdx]) {
        newGroups[classIdx].students[studentIdx].currentScoreInput = value;
      }
      return newGroups;
    });
  };
  
  const handleSaveAllScoresForClass = async (classIdx: number) => {
    if (!user || !examDetails) return;

    const classGroup = groupedStudentScores[classIdx];
    if (!classGroup) {
        toast({title: "Error", description: "Class data not found.", variant: "destructive"});
        return;
    }
    const { classInfo, students } = classGroup;

    setIsSavingAllInProgress(prev => ({ ...prev, [classInfo.id]: true }));
    // Reset isSavingScore for individual students for this class before starting batch save
    setGroupedStudentScores(prev => {
        const newGroups = [...prev];
        if (newGroups[classIdx]) { // Ensure the class group exists
          newGroups[classIdx].students = newGroups[classIdx].students.map(s => ({...s, isSavingScore: false })); 
        }
        return newGroups;
    });

    const savableStudentsPromises = students.map(async (student, studentIdx) => {
      const scoreStatusDetails = getScoreStatus(student);
      if (!scoreStatusDetails.isSavable) {
        // No changes or invalid input, so skip saving for this student
        return { studentId: student.id, success: true, noChange: true, finalScore: student.score, scoreDocId: student.scoreDocId }; 
      }

      // Mark this specific student as saving for individual row feedback
      setGroupedStudentScores(prev => {
        const newGroups = [...prev];
        if (newGroups[classIdx] && newGroups[classIdx].students[studentIdx]) {
          newGroups[classIdx].students[studentIdx].isSavingScore = true;
        }
        return newGroups;
      });
      
      const scoreToSave = scoreStatusDetails.parsedScore; // This can be null if input was cleared

      try {
        // scoreData needs to allow null for score
        const scoreData: Omit<StudentExamScore, 'id' | 'createdAt'> & { score: number | null } = {
          examId: examDetails.id,
          studentId: student.id,
          userId: user.uid,
          score: scoreToSave, 
          updatedAt: serverTimestamp() as Timestamp,
        };

        const scoresCollectionPath = collection(db, SUBJECTS_COLLECTION_NAME, classInfo.subjectId, "classes", classInfo.id, SCORES_SUBCOLLECTION_NAME);
        let newScoreDocId = student.scoreDocId;

        if (student.scoreDocId) {
          const scoreDocRef = doc(scoresCollectionPath, student.scoreDocId);
          await setDoc(scoreDocRef, scoreData, { merge: true });
        } else {
          // If scoreDocId is null, it means it's a new score record or one being reset to null
          // If scoreToSave is null and no scoreDocId, no need to create a doc just for null.
          // But if scoreToSave is not null, we need to create.
          if (scoreToSave !== null) {
            const newDocRef = await addDoc(scoresCollectionPath, { ...scoreData, createdAt: serverTimestamp() as Timestamp });
            newScoreDocId = newDocRef.id;
          } else {
            // If score is null and no existing doc, do nothing (effectively deleting if it existed, though covered by emptyAndDirty -> parsedScore: null)
          }
        }
        return { studentId: student.id, success: true, finalScore: scoreToSave, newScoreDocId };
      } catch (e) {
        console.error(`Error saving score for ${student.firstName} ${student.lastName}:`, e);
        return { studentId: student.id, success: false, error: e, finalScore: student.score, scoreDocId: student.scoreDocId };
      }
    });

    const results = await Promise.allSettled(savableStudentsPromises);
    let allSuccessful = true;
    let changesMade = false;

    // Update local state based on results
    setGroupedStudentScores(prev => {
      const newGroups = [...prev];
      if (!newGroups[classIdx]) return prev; // Should not happen if classGroup was found

      const studentsToUpdate = newGroups[classIdx].students.map(s => {
        const resultItem = results.find(r => r.status === 'fulfilled' && r.value.studentId === s.id);
        if (resultItem && resultItem.status === 'fulfilled') {
          const resultValue = resultItem.value;
          if (resultValue.success) {
            if (!resultValue.noChange) changesMade = true;
            return {
              ...s,
              score: resultValue.finalScore, // Update the 'official' score
              scoreDocId: resultValue.newScoreDocId,
              currentScoreInput: resultValue.finalScore !== null && resultValue.finalScore !== undefined ? String(resultValue.finalScore) : '', // Reset input to saved value
              isSavingScore: false,
            };
          } else { // Save failed for this student
            allSuccessful = false;
            return { ...s, isSavingScore: false }; // Clear saving flag even on failure
          }
        } else if (resultItem && resultItem.status === 'rejected') {
          allSuccessful = false;
          return { ...s, isSavingScore: false };
        }
        // If student was not part of savableStudentsPromises (noChange was true), or resultItem not found (should not happen)
        return { ...s, isSavingScore: false }; // Ensure saving flag is cleared
      });
      newGroups[classIdx].students = studentsToUpdate;
      return newGroups;
    });

    if (allSuccessful && changesMade) {
      toast({ title: "Scores Saved", description: `All changes for ${classInfo.sectionName} saved successfully.` });
    } else if (!changesMade && allSuccessful) {
      // toast({ title: "No Changes", description: `No scores needed saving for ${classInfo.sectionName}.`}); // Removed this line
    } else if (!allSuccessful) {
      toast({ title: "Partial Save", description: `Some scores for ${classInfo.sectionName} could not be saved. Please check individual statuses.`, variant: "destructive" });
    }
    
    setIsSavingAllInProgress(prev => ({ ...prev, [classInfo.id]: false }));
  };

  const handleConfirmResetScores = (classIdToReset: string) => {
    setGroupedStudentScores(prevGroups => 
      prevGroups.map(group => {
        if (group.classInfo.id === classIdToReset) {
          return {
            ...group,
            students: group.students.map(student => ({
              ...student,
              // Revert currentScoreInput to the last saved score (or empty if no score was saved)
              currentScoreInput: student.score !== null && student.score !== undefined ? String(student.score) : '',
            })),
          };
        }
        return group;
      })
    );
    const classInfoForToast = groupedStudentScores.find(g => g.classInfo.id === classIdToReset)?.classInfo;
    toast({ title: "Changes Discarded", description: `Unsaved scores for ${classInfoForToast?.sectionName || 'the class'} have been reverted.` });
    setClassIdToResetConfirm(null);
  };

  const hasAnyUnsavedChanges = useMemo(() => {
    return groupedStudentScores.some(classGroup => 
      classGroup.students.some(student => getScoreStatus(student).isSavable)
    );
  }, [groupedStudentScores, getScoreStatus]);

  const handleBackClick = () => {
    if (hasAnyUnsavedChanges) {
      setIsBackConfirmDialogOpen(true);
    } else {
      router.back();
    }
  };


  if (isLoading || authLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="w-full sm:w-auto">
            <Skeleton className="h-8 w-2/3 sm:w-80 mb-1" />
            <Skeleton className="h-5 w-1/2 sm:w-60 ml-8 sm:ml-10" />
          </div>
          <Skeleton className="h-9 w-full sm:w-36" />
        </div>
        {[1,2].map(i => (
        <Card key={i} className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-7 w-1/2 sm:w-1/3 mb-1" />
            <Skeleton className="h-5 w-3/4 sm:w-1/2 ml-7" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-4">
        <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" />
        <h2 className="text-xl sm:text-2xl font-semibold mb-2">Error Loading Results</h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => router.back()} size="sm" className="text-xs sm:text-sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  if (!examDetails) {
     return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-4">
        <Info className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
        <p className="text-sm sm:text-base text-muted-foreground">Exam details not found.</p>
         <Button onClick={() => router.back()} size="sm" className="text-xs sm:text-sm mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center">
            <BarChart3 className="mr-2 sm:mr-3 h-5 w-5 sm:h-7 sm:w-7 text-primary" />
            Results for: {examDetails.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground ml-8 sm:ml-10">
            Total Points Possible: {examDetails.totalPoints} | Total Questions: {examDetails.totalQuestions}
          </p>
        </div>
        <Button variant="outline" onClick={handleBackClick} size="sm" className="text-xs sm:text-sm w-full sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams List
        </Button>
      </div>
      
      <AlertDialog open={isBackConfirmDialogOpen} onOpenChange={setIsBackConfirmDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
                You have unsaved scores. Are you sure you want to leave this page? Your changes will be lost.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsBackConfirmDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { router.back(); setIsBackConfirmDialogOpen(false); }} className="bg-destructive hover:bg-destructive/90">
                Leave Page
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {groupedStudentScores.length === 0 && !isLoading && (
        <Card className="shadow-md">
          <CardContent className="text-center py-10">
            <Info className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm sm:text-base">
              No students or class assignments found for this exam, or no scores recorded yet.
            </p>
          </CardContent>
        </Card>
      )}

      {groupedStudentScores.map(({ classInfo, students }, classIdx) => {
        const isCollapsed = collapsedStates[classInfo.id] ?? false;
        const classIsSaving = isSavingAllInProgress[classInfo.id] || false;
        const hasSavableChangesForThisClass = students.some(s => getScoreStatus(s).isSavable);

        return (
          <Card key={classInfo.id} className="shadow-lg">
            <CardHeader className="flex flex-row justify-between items-center">
              <div className="flex-grow">
                <CardTitle className="text-lg sm:text-xl flex items-center">
                  <Users className="mr-2 h-5 w-5 text-muted-foreground" />
                  {classInfo.sectionName} ({classInfo.yearGrade})
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm ml-7">
                  Subject: {classInfo.subjectName} ({classInfo.subjectCode}) | Class Code: {classInfo.code}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleCollapse(classInfo.id)}
                aria-expanded={!isCollapsed}
                aria-controls={`class-content-${classInfo.id}`}
                className="flex-shrink-0"
              >
                {isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                <span className="sr-only">{isCollapsed ? 'Expand' : 'Collapse'}</span>
              </Button>
            </CardHeader>
            <CardContent
              id={`class-content-${classInfo.id}`}
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                "px-2 sm:px-4", 
                isCollapsed 
                  ? "max-h-0 py-0 opacity-0" 
                  : "max-h-[100dvh] overflow-y-auto pt-0 pb-4 sm:pb-6 opacity-100" 
              )}
            >
              {students.length > 0 ? (
                <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%] px-2 sm:px-4 text-xs sm:text-sm">Student Name</TableHead>
                      <TableHead className="w-[30%] text-center px-2 sm:px-4 text-xs sm:text-sm">Score</TableHead>
                      <TableHead className="w-[20%] text-center px-2 sm:px-4 text-xs sm:text-sm">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student, studentIdx) => {
                      const scoreStatus = getScoreStatus(student);
                      const IconComponent = scoreStatus.icon;
                      return (
                        <TableRow key={student.id} className={cn(student.isSavingScore && "opacity-50 bg-muted/30")}>
                          <TableCell className="font-medium px-2 sm:px-4 text-xs sm:text-sm py-2 sm:py-3 align-middle">
                            {student.lastName}, {student.firstName} {student.middleName && `${student.middleName.charAt(0)}.`}
                          </TableCell>
                          <TableCell className="px-2 sm:px-4 text-xs sm:text-sm py-1.5 sm:py-2 align-middle">
                            <Input
                              type="text" 
                              placeholder={`Score / ${examDetails.totalPoints}`}
                              value={student.currentScoreInput ?? ''}
                              onChange={(e) => handleScoreInputChange(classIdx, studentIdx, e.target.value)}
                              className={cn(
                                "h-8 sm:h-9 text-xs sm:text-sm text-center w-full max-w-[120px] mx-auto",
                                scoreStatus.status === 'invalid' && "border-destructive focus-visible:ring-destructive"
                              )}
                              disabled={classIsSaving || student.isSavingScore}
                            />
                          </TableCell>
                          <TableCell className="text-center px-2 sm:px-4 text-xs sm:text-sm py-1.5 sm:py-2 align-middle">
                            <div className="flex items-center justify-center" title={scoreStatus.tooltip}>
                              {student.isSavingScore ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ): IconComponent ? (
                                <IconComponent className={cn("h-4 w-4", scoreStatus.color)} />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <CardFooter className="mt-4 px-0 py-0 flex justify-end gap-2">
                    <AlertDialog open={classIdToResetConfirm === classInfo.id} onOpenChange={(isOpen) => !isOpen && setClassIdToResetConfirm(null)}>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setClassIdToResetConfirm(classInfo.id)}
                                disabled={classIsSaving || !hasSavableChangesForThisClass}
                                className="text-xs sm:text-sm"
                            >
                                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Discard Unsaved Changes?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to discard all unsaved score changes for {classInfo.sectionName} ({classInfo.yearGrade})? This cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setClassIdToResetConfirm(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleConfirmResetScores(classInfo.id)} className="bg-destructive hover:bg-destructive/90">
                                    Discard Changes
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button
                        size="sm"
                        onClick={() => handleSaveAllScoresForClass(classIdx)}
                        disabled={classIsSaving || !hasSavableChangesForThisClass}
                        className="text-xs sm:text-sm"
                    >
                        {classIsSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save
                    </Button>
                </CardFooter>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No students found in this class.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
    
    
