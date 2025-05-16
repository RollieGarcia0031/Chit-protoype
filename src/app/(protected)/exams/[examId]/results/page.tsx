// src/app/(protected)/exams/[examId]/results/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, getDocs, query, where, orderBy, setDoc, addDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { ExamSummaryData, ClassInfoForDropdown, Student, StudentExamScore } from '@/types/exam-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BarChart3, Users, AlertTriangle, Info, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SCORES_SUBCOLLECTION_NAME = 'scores';

interface ClassWithStudentsAndScores {
  classInfo: ClassInfoForDropdown;
  students: Student[];
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

  const fetchResultsData = useCallback(async () => {
    if (!user || !examId) return;

    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Exam Details
      const examDocRef = doc(db, EXAMS_COLLECTION_NAME, examId);
      const examSnap = await getDoc(examDocRef);

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

      // 2. Fetch all user subjects and their classes to map classIds to full ClassInfoForDropdown
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

      if (assignedClassesInfo.length === 0) {
        setError("Could not find details for the classes assigned to this exam.");
        setIsLoading(false); return;
      }
      
      // 3. Fetch existing scores for this exam FOR EACH ASSIGNED CLASS
      const scoresMap = new Map<string, { score: number | null; scoreDocId: string }>();
      for (const classInfo of assignedClassesInfo) {
        const scoresRef = collection(db, SUBJECTS_COLLECTION_NAME, classInfo.subjectId, "classes", classInfo.id, SCORES_SUBCOLLECTION_NAME);
        const scoresQuery = query(scoresRef, where("examId", "==", examId), where("userId", "==", user.uid));
        const scoresSnapshot = await getDocs(scoresQuery);
        scoresSnapshot.forEach(scoreDoc => {
          const data = scoreDoc.data() as StudentExamScore;
          scoresMap.set(data.studentId, { score: data.score, scoreDocId: scoreDoc.id });
        });
      }

      // 4. For each assigned class, fetch its students and merge with scores
      const resultsPromises = assignedClassesInfo.map(async (classInfo) => {
        const studentsRef = collection(db, SUBJECTS_COLLECTION_NAME, classInfo.subjectId, "classes", classInfo.id, "students");
        const studentsQuery = query(studentsRef, orderBy("lastName", "asc"), orderBy("firstName", "asc"));
        const studentsSnapshot = await getDocs(studentsQuery);
        
        const studentsWithScores: Student[] = studentsSnapshot.docs.map(studentDoc => {
          const studentData = studentDoc.data() as Student;
          const existingScoreData = scoresMap.get(studentDoc.id);
          return {
            ...studentData,
            id: studentDoc.id,
            score: existingScoreData?.score ?? null,
            currentScoreInput: existingScoreData?.score !== null && existingScoreData?.score !== undefined ? String(existingScoreData.score) : '',
            isSavingScore: false,
            scoreDocId: existingScoreData?.scoreDocId ?? null,
          };
        });
        return { classInfo, students: studentsWithScores };
      });
      
      const results = await Promise.all(resultsPromises);
      setGroupedStudentScores(results);

    } catch (e) {
      console.error("Error fetching exam results data: ", e);
      setError("Failed to load exam results. Please try again.");
      toast({ title: "Error", description: "Could not fetch exam results.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, user, toast]); 

  useEffect(() => {
    if (!authLoading && user && examId) {
      fetchResultsData();
    } else if (!authLoading && !user) {
        router.push('/login');
    }
  }, [examId, user, authLoading, router, fetchResultsData]);


  const handleScoreInputChange = (classIdx: number, studentIdx: number, value: string) => {
    setGroupedStudentScores(prev => {
      const newGroups = [...prev];
      if (newGroups[classIdx] && newGroups[classIdx].students[studentIdx]) {
        newGroups[classIdx].students[studentIdx].currentScoreInput = value;
      }
      return newGroups;
    });
  };

  const handleSaveScore = async (classIdx: number, studentIdx: number) => {
    if (!user || !examDetails) return;

    const student = groupedStudentScores[classIdx].students[studentIdx];
    const classInfo = groupedStudentScores[classIdx].classInfo;

    setGroupedStudentScores(prev => {
      const newGroups = [...prev];
      newGroups[classIdx].students[studentIdx].isSavingScore = true;
      return newGroups;
    });

    const scoreValueRaw = student.currentScoreInput;
    let scoreToSave: number | null = null;

    if (scoreValueRaw !== undefined && scoreValueRaw.trim() !== "") {
        const parsedScore = parseFloat(scoreValueRaw);
        if (!isNaN(parsedScore)) {
            scoreToSave = parsedScore;
        } else {
            toast({ title: "Invalid Score", description: "Score must be a number.", variant: "destructive" });
            setGroupedStudentScores(prev => {
                const newGroups = [...prev];
                newGroups[classIdx].students[studentIdx].isSavingScore = false;
                return newGroups;
            });
            return;
        }
    }


    try {
      // StudentExamScore no longer includes classId or subjectId in its type definition
      const scoreData: Omit<StudentExamScore, 'id' | 'createdAt'> = {
        examId: examDetails.id,
        studentId: student.id,
        userId: user.uid,
        score: scoreToSave,
        updatedAt: serverTimestamp() as Timestamp,
      };

      let newScoreDocId = student.scoreDocId;

      // Path to the scores subcollection for this specific class
      const scoresCollectionPath = collection(db, SUBJECTS_COLLECTION_NAME, classInfo.subjectId, "classes", classInfo.id, SCORES_SUBCOLLECTION_NAME);

      if (student.scoreDocId) {
        // Update existing score document
        const scoreDocRef = doc(scoresCollectionPath, student.scoreDocId);
        await setDoc(scoreDocRef, scoreData, { merge: true }); 
      } else {
        // Add new score document
        const newDocRef = await addDoc(scoresCollectionPath, {
            ...scoreData,
            createdAt: serverTimestamp() as Timestamp
        });
        newScoreDocId = newDocRef.id;
      }
      
      toast({ title: "Score Saved", description: `Score for ${student.firstName} ${student.lastName} saved successfully.` });
      setGroupedStudentScores(prev => {
        const newGroups = [...prev];
        newGroups[classIdx].students[studentIdx].score = scoreToSave;
        newGroups[classIdx].students[studentIdx].scoreDocId = newScoreDocId;
        return newGroups;
      });

    } catch (e) {
      console.error("Error saving score: ", e);
      toast({ title: "Error Saving Score", description: "Could not save the score.", variant: "destructive" });
    } finally {
      setGroupedStudentScores(prev => {
        const newGroups = [...prev];
        if (newGroups[classIdx] && newGroups[classIdx].students[studentIdx]) {
             newGroups[classIdx].students[studentIdx].isSavingScore = false;
        }
        return newGroups;
      });
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
        <Button variant="outline" onClick={() => router.back()} size="sm" className="text-xs sm:text-sm w-full sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams List
        </Button>
      </div>

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

      {groupedStudentScores.map(({ classInfo, students }, classIdx) => (
        <Card key={classInfo.id} className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl flex items-center">
              <Users className="mr-2 h-5 w-5 text-muted-foreground" />
              {classInfo.sectionName} ({classInfo.yearGrade})
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm ml-7">
              Subject: {classInfo.subjectName} ({classInfo.subjectCode}) | Class Code: {classInfo.code}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {students.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%] px-2 sm:px-4 text-xs sm:text-sm">Student Name</TableHead>
                    <TableHead className="w-[30%] text-center px-2 sm:px-4 text-xs sm:text-sm">Score</TableHead>
                    <TableHead className="w-[25%] text-right px-2 sm:px-4 text-xs sm:text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student, studentIdx) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium px-2 sm:px-4 text-xs sm:text-sm py-2 sm:py-3 align-middle">
                        {student.lastName}, {student.firstName} {student.middleName && `${student.middleName.charAt(0)}.`}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 text-xs sm:text-sm py-1.5 sm:py-2 align-middle">
                        <Input
                          type="text" 
                          placeholder={`Score / ${examDetails.totalPoints}`}
                          value={student.currentScoreInput ?? ''}
                          onChange={(e) => handleScoreInputChange(classIdx, studentIdx, e.target.value)}
                          className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full max-w-[120px] mx-auto"
                          disabled={student.isSavingScore}
                        />
                      </TableCell>
                      <TableCell className="text-right px-2 sm:px-4 text-xs sm:text-sm py-1.5 sm:py-2 align-middle">
                        <Button
                          size="sm"
                          onClick={() => handleSaveScore(classIdx, studentIdx)}
                          disabled={student.isSavingScore}
                          className="h-8 sm:h-9 text-2xs sm:text-xs px-2 sm:px-3"
                        >
                          {student.isSavingScore ? (
                            <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          )}
                           <span className="hidden sm:inline ml-1 sm:ml-1.5">Save</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No students found in this class.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

