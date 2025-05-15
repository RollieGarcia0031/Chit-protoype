
// src/app/(protected)/exams/page.tsx
'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Edit3, Trash2, AlertTriangle, Loader2, Layers, BookOpen, Users2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, Timestamp, orderBy, doc, deleteDoc, getDocsFromServer } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
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
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from "@/config/firebase-constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExamSummaryData, FetchedSubjectInfo, ClassInfoForDropdown } from "@/types/exam-types";

type DisplayMode = 'all' | 'bySubject' | 'byClass';

interface GroupedExamsBySubject {
  [subjectId: string]: {
    groupTitle: string;
    exams: ExamSummaryData[];
  };
}

// Interface specifically for the "Group by Class" view to aid sorting
interface ClassGroup {
  groupKey: string; // e.g., "SectionA-Grade10"
  groupTitle: string; // e.g., "Section A (Grade 10)"
  exams: ExamSummaryData[];
  parsedYear: number; // For sorting by year
  sectionName: string; // For secondary sorting by section name
}


export default function ViewExamsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [exams, setExams] = useState<ExamSummaryData[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  const [displayMode, setDisplayMode] = useState<DisplayMode>('all');
  const [allUserSubjects, setAllUserSubjects] = useState<FetchedSubjectInfo[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [allUserClasses, setAllUserClasses] = useState<ClassInfoForDropdown[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  useEffect(() => {
    const fetchExamsData = async () => {
      if (!user) {
        setIsLoadingExams(false);
        return;
      }
      setIsLoadingExams(true);
      setError(null);
      try {
        const examsCollectionRef = collection(db, EXAMS_COLLECTION_NAME);
        const q = query(examsCollectionRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedExams: ExamSummaryData[] = [];
        querySnapshot.forEach((docSnap) => {
          fetchedExams.push({ id: docSnap.id, ...docSnap.data() } as ExamSummaryData);
        });
        setExams(fetchedExams);
      } catch (e) {
        console.error("Error fetching exams: ", e);
        setError("Failed to load exams. Please try again.");
        toast({ title: "Error", description: "Could not fetch exams.", variant: "destructive" });
      } finally {
        setIsLoadingExams(false);
      }
    };

    const fetchUserSubjects = async () => {
        if (!user) {
            setIsLoadingSubjects(false);
            setAllUserSubjects([]);
            return;
        }
        setIsLoadingSubjects(true);
        try {
            const subjectsCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME);
            const q = query(subjectsCollectionRef, where("userId", "==", user.uid), orderBy("name", "asc"));
            const querySnapshot = await getDocs(q);
            const fetchedSubjects: FetchedSubjectInfo[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FetchedSubjectInfo));
            setAllUserSubjects(fetchedSubjects);
        } catch (e) {
            console.error("Error fetching subjects:", e);
            toast({ title: "Error", description: "Could not fetch subjects.", variant: "destructive" });
        } finally {
            setIsLoadingSubjects(false);
        }
    };
    

    if (!authLoading && user) {
      fetchExamsData();
      fetchUserSubjects();
    } else if (!authLoading && !user) {
      setIsLoadingExams(false);
      setExams([]);
      setIsLoadingSubjects(false);
      setAllUserSubjects([]);
      setIsLoadingClasses(false);
      setAllUserClasses([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  useEffect(() => {
    if (user && !isLoadingSubjects && allUserSubjects.length > 0) {
        const fetchUserClasses = async () => {
            setIsLoadingClasses(true);
            const fetchedClasses: ClassInfoForDropdown[] = [];
            try {
                for (const subject of allUserSubjects) {
                    const classesSubCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME, subject.id, "classes");
                    const q = query(classesSubCollectionRef, where("userId", "==", user.uid), orderBy("sectionName", "asc"));
                    const classesSnapshot = await getDocs(q);
                    classesSnapshot.forEach((classDoc) => {
                        const classData = classDoc.data();
                        fetchedClasses.push({
                            id: classDoc.id,
                            subjectId: subject.id,
                            subjectName: subject.name,
                            subjectCode: subject.code,
                            sectionName: classData.sectionName,
                            yearGrade: classData.yearGrade,
                            code: classData.code,
                        });
                    });
                }
                setAllUserClasses(fetchedClasses);
            } catch (e) {
                console.error("Error fetching classes:", e);
                toast({ title: "Error", description: "Could not fetch classes.", variant: "destructive" });
            } finally {
                setIsLoadingClasses(false);
            }
        };
        fetchUserClasses();
    } else if (user && !isLoadingSubjects && allUserSubjects.length === 0) {
        setAllUserClasses([]); 
        setIsLoadingClasses(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, allUserSubjects, isLoadingSubjects]);

  const groupedExamsBySubject = useMemo(() => {
    if (displayMode !== 'bySubject') return {};
    const grouped: GroupedExamsBySubject = {};
    allUserSubjects.forEach(subject => {
        grouped[subject.id] = { 
            groupTitle: `${subject.name} (${subject.code})`, 
            exams: exams.filter(exam => exam.subjectId === subject.id)
                        .sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis())
        };
    });
    const uncategorizedExams = exams.filter(exam => !exam.subjectId || !allUserSubjects.find(s => s.id === exam.subjectId))
                                    .sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    if (uncategorizedExams.length > 0) {
        grouped['uncategorized'] = { groupTitle: "Uncategorized Exams", exams: uncategorizedExams };
    }
    return grouped;
  }, [displayMode, exams, allUserSubjects]);

  const groupedExamsByClass: ClassGroup[] = useMemo(() => {
    if (displayMode !== 'byClass' || isLoadingClasses || isLoadingExams || allUserClasses.length === 0) return [];

    const extractNumericYear = (yearGradeStr: string): number => {
        if (!yearGradeStr) return Infinity;
        const numericMatch = yearGradeStr.match(/\d+/);
        if (numericMatch) {
            return parseInt(numericMatch[0], 10);
        }
        const lowerYearGrade = yearGradeStr.toLowerCase();
        if (lowerYearGrade.includes('k') || lowerYearGrade.includes('kinder')) return -1; // Kindergarten sorts before Grade 1
        if (lowerYearGrade.includes('pre-k') || lowerYearGrade.includes('pre k')) return -2; // Pre-K sorts before Kindergarten
        return Infinity; // Non-numeric grades without specific handling sort last
    };

    // Step 1: Create temporary group data with sorting fields
    interface TempClassGroupData {
      groupTitle: string;
      classIdsInGroup: string[];
      sectionName: string;
      parsedYear: number;
    }
    const tempGroupData: { [key: string]: TempClassGroupData } = {};

    allUserClasses.forEach(cls => {
        const groupKey = `${cls.sectionName}-${cls.yearGrade}`; // Unique key for section-year combo
        const parsedYear = extractNumericYear(cls.yearGrade);

        if (!tempGroupData[groupKey]) {
            tempGroupData[groupKey] = {
                groupTitle: `${cls.sectionName} (${cls.yearGrade})`,
                classIdsInGroup: [],
                sectionName: cls.sectionName,
                parsedYear: parsedYear
            };
        }
        tempGroupData[groupKey].classIdsInGroup.push(cls.id);
    });

    // Step 2: Populate groups with exams
    const classGroupMap: { [key: string]: ClassGroup } = {};

    Object.entries(tempGroupData).forEach(([groupKey, groupInfo]) => {
        const examsInGroup = exams.filter(exam =>
            exam.classIds && exam.classIds.some(assignedClassId => groupInfo.classIdsInGroup.includes(assignedClassId))
        ).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()); // Sort exams within group by date

        if (groupInfo.classIdsInGroup.length > 0 || examsInGroup.length > 0) { // Only create group if classes exist or exams are assigned
            if (!classGroupMap[groupKey]) {
                 classGroupMap[groupKey] = {
                    groupKey: groupKey,
                    groupTitle: groupInfo.groupTitle,
                    exams: [],
                    sectionName: groupInfo.sectionName,
                    parsedYear: groupInfo.parsedYear,
                };
            }
            // Deduplicate exams before pushing
            const existingExamIds = new Set(classGroupMap[groupKey].exams.map(e => e.id));
            examsInGroup.forEach(exam => {
                if (!existingExamIds.has(exam.id)) {
                    classGroupMap[groupKey].exams.push(exam);
                    existingExamIds.add(exam.id);
                }
            });
        }
    });

    // Step 3: Convert to array and sort
    let finalGroupArray: ClassGroup[] = Object.values(classGroupMap);

    finalGroupArray.sort((groupA, groupB) => {
        if (groupA.parsedYear !== groupB.parsedYear) {
            return groupA.parsedYear - groupB.parsedYear; // Sort by numeric year first
        }
        return groupA.sectionName.localeCompare(groupB.sectionName); // Then by section name
    });

    return finalGroupArray;
  }, [displayMode, exams, allUserClasses, isLoadingClasses, isLoadingExams]);


  const handleDeleteExam = async (examId: string) => {
    setDeletingExamId(examId);
    try {
        const questionBlocksRef = collection(db, EXAMS_COLLECTION_NAME, examId, "questionBlocks");
        const questionBlocksSnapshot = await getDocsFromServer(questionBlocksRef);
        for (const blockDoc of questionBlocksSnapshot.docs) {
            const questionsRef = collection(db, EXAMS_COLLECTION_NAME, examId, "questionBlocks", blockDoc.id, "questions");
            const questionsSnapshot = await getDocsFromServer(questionsRef);
            for (const questionDoc of questionsSnapshot.docs) {
                await deleteDoc(doc(db, EXAMS_COLLECTION_NAME, examId, "questionBlocks", blockDoc.id, "questions", questionDoc.id));
            }
            await deleteDoc(doc(db, EXAMS_COLLECTION_NAME, examId, "questionBlocks", blockDoc.id));
        }
        await deleteDoc(doc(db, EXAMS_COLLECTION_NAME, examId));
        toast({ title: "Exam Deleted", description: "The exam and its associated data have been successfully deleted." });
        setExams(prevExams => prevExams.filter(exam => exam.id !== examId));
    } catch (e) {
        console.error("Error deleting exam: ", e);
        toast({ title: "Error Deleting Exam", description: "Could not delete the exam. Please try again.", variant: "destructive" });
    } finally {
        setDeletingExamId(null);
    }
  };

  const renderExamTable = (examList: ExamSummaryData[], context: string) => {
    if (examList.length === 0) {
        return <p className="text-sm text-muted-foreground py-4 text-center">No exams found for this {context}.</p>;
    }
    return (
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead className="w-[30%] sm:w-[35%] px-2 sm:px-4 text-xs sm:text-sm">Title</TableHead>
                <TableHead className="hidden md:table-cell px-2 sm:px-4 text-xs sm:text-sm">Date Created</TableHead>
                <TableHead className="px-2 sm:px-4 text-xs sm:text-sm">Status</TableHead>
                <TableHead className="text-center px-1 sm:px-4 text-xs sm:text-sm">Questions</TableHead>
                <TableHead className="hidden sm:table-cell text-center px-1 sm:px-4 text-xs sm:text-sm">Points</TableHead>
                <TableHead className="text-right px-2 sm:px-4 text-xs sm:text-sm">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {examList.map((exam) => (
                <TableRow key={exam.id}>
                <TableCell className="font-medium px-2 sm:px-4 text-xs sm:text-sm py-2 sm:py-4">{exam.title}</TableCell>
                <TableCell className="hidden md:table-cell px-2 sm:px-4 text-xs sm:text-sm py-2 sm:py-4">{exam.createdAt.toDate().toLocaleDateString()}</TableCell>
                <TableCell className="px-2 sm:px-4 text-xs sm:text-sm py-2 sm:py-4">
                    <Badge 
                    variant={exam.status === 'Published' ? 'default' : exam.status === 'Draft' ? 'secondary' : 'outline'}
                    className={`text-2xs sm:text-xs ${exam.status === 'Archived' ? 'bg-muted text-muted-foreground' : ''}`}
                    >
                    {exam.status}
                    </Badge>
                </TableCell>
                <TableCell className="text-center px-1 sm:px-4 text-xs sm:text-sm py-2 sm:py-4">{exam.totalQuestions}</TableCell>
                <TableCell className="hidden sm:table-cell text-center px-1 sm:px-4 text-xs sm:text-sm py-2 sm:py-4">{exam.totalPoints}</TableCell>
                <TableCell className="text-right space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 sm:py-4">
                    <Button variant="outline" size="icon" aria-label="Edit Exam" asChild className="h-7 w-7 sm:h-8 sm:w-8">
                    <Link href={`/create-exam?examId=${exam.id}`}><Edit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></Link>
                    </Button>
                    <Button variant="outline" size="icon" aria-label="View Exam Results" className="text-primary hover:text-primary h-7 w-7 sm:h-8 sm:w-8" asChild>
                    <Link href={`/exams/${exam.id}/results`}><ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></Link>
                    </Button>
                    <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" aria-label="Delete Exam" disabled={deletingExamId === exam.id} className="h-7 w-7 sm:h-8 sm:w-8">
                        {deletingExamId === exam.id ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle className="text-base sm:text-lg">Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs sm:text-sm">
                            This action cannot be undone. This will permanently delete the exam
                            &quot;{exam.title}&quot; and all its associated questions and data.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                        <AlertDialogCancel disabled={deletingExamId === exam.id} className="text-xs sm:text-sm">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleDeleteExam(exam.id)}
                            disabled={deletingExamId === exam.id}
                            className="bg-destructive hover:bg-destructive/90 text-xs sm:text-sm"
                        >
                            {deletingExamId === exam.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                    </AlertDialog>
                </TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
    );
  };

  if (authLoading || isLoadingExams || isLoadingSubjects || (displayMode === 'byClass' && isLoadingClasses)) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <Skeleton className="h-8 sm:h-9 w-36 sm:w-48 mb-2" />
                <Skeleton className="h-4 sm:h-5 w-48 sm:w-64" />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <Skeleton className="h-9 sm:h-10 flex-grow sm:w-40" />
                <Skeleton className="h-9 sm:h-10 flex-grow sm:w-36" />
            </div>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-6 sm:h-7 w-24 sm:w-32 mb-1" />
            <Skeleton className="h-4 w-64 sm:w-80" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-5 w-20 sm:w-24 mb-4" /> {/* Placeholder for Table Header */}
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-4">
        <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" />
        <h2 className="text-xl sm:text-2xl font-semibold mb-2">Oops! Something went wrong.</h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => { setIsLoadingExams(true); setError(null); /* Re-trigger fetches */ }} size="sm" className="text-xs sm:text-sm">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Your Exams</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage and review your created exams.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={displayMode} onValueChange={(value) => setDisplayMode(value as DisplayMode)}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Display mode" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all" className="text-xs sm:text-sm">All (Newest First)</SelectItem>
                    <SelectItem value="bySubject" className="text-xs sm:text-sm">Group by Subject</SelectItem>
                    <SelectItem value="byClass" className="text-xs sm:text-sm">Group by Class</SelectItem>
                </SelectContent>
            </Select>
            <Button asChild size="sm" className="text-xs sm:text-sm w-full sm:w-auto h-9">
                <Link href="/create-exam">Create New Exam</Link>
            </Button>
        </div>
      </div>

    {displayMode === 'all' && (
        <Card className="shadow-lg">
            <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Exam List</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
                A list of all exams you have created.
            </CardDescription>
            </CardHeader>
            <CardContent>
            {exams.length > 0 ? renderExamTable(exams, "system") : (
                <div className="text-center py-10">
                <p className="text-muted-foreground text-base sm:text-lg">No exams created yet.</p>
                <Button asChild className="mt-4 text-xs sm:text-sm" size="sm">
                    <Link href="/create-exam">Create Your First Exam</Link>
                </Button>
                </div>
            )}
            </CardContent>
            {exams.length > 0 && (
                <CardFooter className="text-xs sm:text-sm text-muted-foreground">
                    Showing {exams.length} exam{exams.length === 1 ? '' : 's'}.
                </CardFooter>
            )}
        </Card>
    )}

    {displayMode === 'bySubject' && (
        Object.keys(groupedExamsBySubject).length > 0 ? (
            Object.entries(groupedExamsBySubject).map(([subjectId, group]) => (
                <Card key={subjectId} className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg sm:text-xl flex items-center">
                            <BookOpen className="mr-2 h-5 w-5 text-primary"/> {group.groupTitle}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {renderExamTable(group.exams, "subject")}
                    </CardContent>
                    {group.exams.length > 0 && (
                        <CardFooter className="text-xs sm:text-sm text-muted-foreground">
                            Showing {group.exams.length} exam{group.exams.length === 1 ? '' : 's'} for this subject.
                        </CardFooter>
                    )}
                </Card>
            ))
        ) : (
            <Card className="shadow-lg">
                <CardContent className="text-center py-10">
                    <p className="text-muted-foreground text-base sm:text-lg">No subjects found or no exams assigned to subjects.</p>
                     <Button asChild className="mt-4 text-xs sm:text-sm" size="sm">
                         <Link href="/subjects">Manage Subjects</Link>
                    </Button>
                </CardContent>
            </Card>
        )
    )}
    
    {displayMode === 'byClass' && (
        groupedExamsByClass.length > 0 ? (
            groupedExamsByClass.map((group) => ( // Iterate over the sorted array
                <Card key={group.groupKey} className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg sm:text-xl flex items-center">
                            <Users2Icon className="mr-2 h-5 w-5 text-primary"/> {group.groupTitle}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {renderExamTable(group.exams, "class section/year")}
                    </CardContent>
                     {group.exams.length > 0 && (
                        <CardFooter className="text-xs sm:text-sm text-muted-foreground">
                            Showing {group.exams.length} exam{group.exams.length === 1 ? '' : 's'} for this section/year.
                        </CardFooter>
                    )}
                </Card>
            ))
        ) : (
             <Card className="shadow-lg">
                <CardContent className="text-center py-10">
                    <p className="text-muted-foreground text-base sm:text-lg">No classes found or no exams assigned to classes.</p>
                     <Button asChild className="mt-4 text-xs sm:text-sm" size="sm">
                         <Link href="/students">Manage Classes</Link>
                    </Button>
                </CardContent>
            </Card>
        )
    )}

    {/* Fallback for exams not fitting into current grouped views if needed */}
    {displayMode !== 'all' && 
        ( (displayMode === 'bySubject' && Object.keys(groupedExamsBySubject).length === 0 && !isLoadingSubjects && exams.length > 0) ||
          (displayMode === 'byClass' && groupedExamsByClass.length === 0 && !isLoadingClasses && !isLoadingSubjects && exams.length > 0)
        ) && (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-lg sm:text-xl flex items-center">
                    <Layers className="mr-2 h-5 w-5 text-primary"/> Other Exams
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Exams not matching the current grouping criteria or no groups defined.</CardDescription>
            </CardHeader>
            <CardContent>
                {renderExamTable(exams, "other criteria")}
            </CardContent>
        </Card>
    )}

    </div>
  );
}

