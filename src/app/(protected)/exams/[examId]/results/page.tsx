
// src/app/(protected)/exams/[examId]/results/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { ExamSummaryData, ClassInfoForDropdown, Student } from '@/types/exam-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BarChart3, Users, AlertTriangle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StudentWithScore extends Student {
  score?: number | string; // Score can be number or a string like 'N/A'
}

interface ClassWithStudentsAndScores {
  classInfo: ClassInfoForDropdown;
  students: StudentWithScore[];
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

  useEffect(() => {
    if (!user || !examId) {
      if (!authLoading && !user) {
        router.push('/login');
      }
      setIsLoading(false);
      return;
    }

    const fetchResultsData = async () => {
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

        // 2. Fetch all user subjects and their classes to map classIds to classInfo
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
              id: classDoc.id,
              subjectId: subjectDoc.id,
              subjectName: subjectData.name,
              subjectCode: subjectData.code,
              sectionName: classData.sectionName,
              yearGrade: classData.yearGrade,
              code: classData.code,
            });
          });
        }
        
        // 3. Filter for classes assigned to this exam
        const assignedClassesInfo: ClassInfoForDropdown[] = [];
        currentExamDetails.classIds.forEach(assignedClassId => {
          const classInfo = allUserClassesMap.get(assignedClassId);
          if (classInfo) {
            assignedClassesInfo.push(classInfo);
          }
        });

        if (assignedClassesInfo.length === 0) {
          setError("Could not find details for the classes assigned to this exam.");
          setIsLoading(false);
          return;
        }
        
        // 4. For each assigned class, fetch its students and (mock) scores
        const results: ClassWithStudentsAndScores[] = [];
        for (const classInfo of assignedClassesInfo) {
          const studentsRef = collection(db, SUBJECTS_COLLECTION_NAME, classInfo.subjectId, "classes", classInfo.id, "students");
          const studentsQuery = query(studentsRef, orderBy("lastName", "asc"), orderBy("firstName", "asc"));
          const studentsSnapshot = await getDocs(studentsQuery);
          
          const studentsWithScores: StudentWithScore[] = studentsSnapshot.docs.map(studentDoc => {
            // TODO: Replace with actual score fetching logic
            // For now, score is 'N/A'
            return {
              ...(studentDoc.data() as Student),
              id: studentDoc.id,
              score: 'N/A', 
            };
          });
          results.push({ classInfo, students: studentsWithScores });
        }
        setGroupedStudentScores(results);

      } catch (e) {
        console.error("Error fetching exam results data: ", e);
        setError("Failed to load exam results. Please try again.");
        toast({ title: "Error", description: "Could not fetch exam results.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchResultsData();

  }, [examId, user, authLoading, router, toast]);

  if (isLoading || authLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-2/3 sm:w-1/2" />
          <Skeleton className="h-9 w-24" />
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-7 w-1/3 mb-1" />
            <Skeleton className="h-5 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-5 w-24 mb-4" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
         <Card className="shadow-lg mt-4">
          <CardHeader>
            <Skeleton className="h-7 w-1/3 mb-1" />
            <Skeleton className="h-5 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-5 w-24 mb-4" />
            <Skeleton className="h-10 w-full mb-2" />
          </CardContent>
        </Card>
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
            Total Points: {examDetails.totalPoints} | Total Questions: {examDetails.totalQuestions}
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

      {groupedStudentScores.map(({ classInfo, students }) => (
        <Card key={classInfo.id} className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl flex items-center">
              <Users className="mr-2 h-5 w-5 text-muted-foreground" />
              {classInfo.subjectName} - {classInfo.sectionName} ({classInfo.yearGrade})
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm ml-7">Class Code: {classInfo.code}</CardDescription>
          </CardHeader>
          <CardContent>
            {students.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60%] px-2 sm:px-4 text-xs sm:text-sm">Student Name</TableHead>
                    <TableHead className="text-right px-2 sm:px-4 text-xs sm:text-sm">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium px-2 sm:px-4 text-xs sm:text-sm py-2 sm:py-3">
                        {student.lastName}, {student.firstName} {student.middleName && `${student.middleName.charAt(0)}.`}
                      </TableCell>
                      <TableCell className="text-right px-2 sm:px-4 text-xs sm:text-sm py-2 sm:py-3">
                        {/* Placeholder for score - replace with actual score data when available */}
                        {student.score !== undefined ? student.score : 'N/A'} 
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
