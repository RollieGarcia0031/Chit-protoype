
// src/app/(protected)/exams/page.tsx
'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Edit3, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { EXAMS_COLLECTION_NAME } from "@/config/firebase-constants";

interface ExamData {
  id: string;
  title: string;
  description?: string;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  totalQuestions: number;
  totalPoints: number;
  status: "Draft" | "Published" | "Archived"; // Define possible statuses
}

export default function ViewExamsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [exams, setExams] = useState<ExamData[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  const fetchExams = async () => {
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
      const fetchedExams: ExamData[] = [];
      querySnapshot.forEach((doc) => {
        fetchedExams.push({ id: doc.id, ...doc.data() } as ExamData);
      });
      setExams(fetchedExams);
    } catch (e) {
      console.error("Error fetching exams: ", e);
      setError("Failed to load exams. Please try again.");
      toast({
        title: "Error",
        description: "Could not fetch exams.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingExams(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchExams();
    } else if (!authLoading && !user) {
      setIsLoadingExams(false); // Not logged in, no exams to load
      setExams([]); // Clear exams if user logs out
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const handleDeleteExam = async (examId: string) => {
    setDeletingExamId(examId);
    try {
        // 1. Delete questions within each question block
        const questionBlocksRef = collection(db, EXAMS_COLLECTION_NAME, examId, "questionBlocks");
        const questionBlocksSnapshot = await getDocsFromServer(questionBlocksRef);

        for (const blockDoc of questionBlocksSnapshot.docs) {
            const questionsRef = collection(db, EXAMS_COLLECTION_NAME, examId, "questionBlocks", blockDoc.id, "questions");
            const questionsSnapshot = await getDocsFromServer(questionsRef);
            for (const questionDoc of questionsSnapshot.docs) {
                await deleteDoc(doc(db, EXAMS_COLLECTION_NAME, examId, "questionBlocks", blockDoc.id, "questions", questionDoc.id));
            }
            // 2. Delete the question block itself
            await deleteDoc(doc(db, EXAMS_COLLECTION_NAME, examId, "questionBlocks", blockDoc.id));
        }
        
        // 3. Delete the main exam document
        await deleteDoc(doc(db, EXAMS_COLLECTION_NAME, examId));

        toast({
            title: "Exam Deleted",
            description: "The exam and its associated data have been successfully deleted.",
        });
        setExams(prevExams => prevExams.filter(exam => exam.id !== examId));
    } catch (e) {
        console.error("Error deleting exam: ", e);
        toast({
            title: "Error Deleting Exam",
            description: "Could not delete the exam. Please try again.",
            variant: "destructive",
        });
    } finally {
        setDeletingExamId(null);
    }
  };


  if (authLoading || isLoadingExams) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 sm:h-9 w-36 sm:w-48 mb-2" />
            <Skeleton className="h-4 sm:h-5 w-48 sm:w-64" />
          </div>
          <Skeleton className="h-9 sm:h-10 w-28 sm:w-36" />
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-6 sm:h-7 w-24 sm:w-32 mb-1" />
            <Skeleton className="h-4 w-64 sm:w-80" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]"><Skeleton className="h-5 w-20 sm:w-24" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-20 sm:w-24" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-16 sm:w-20" /></TableHead>
                  <TableHead className="text-center"><Skeleton className="h-5 w-12 sm:w-16" /></TableHead>
                  <TableHead className="text-center"><Skeleton className="h-5 w-12 sm:w-16" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-5 w-20 sm:w-28" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 sm:w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 sm:w-20 rounded-full" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-6 sm:w-8 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-6 sm:w-8 mx-auto" /></TableCell>
                    <TableCell className="text-right space-x-1 sm:space-x-2">
                      <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 inline-block" />
                      <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 inline-block" />
                      <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 inline-block" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        <Button onClick={fetchExams} size="sm" className="text-xs sm:text-sm">Try Again</Button>
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
        <Button asChild size="sm" className="text-xs sm:text-sm w-full sm:w-auto">
            <Link href="/create-exam">Create New Exam</Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Exam List</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            A list of all exams you have created. You can edit, view results, or delete them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exams.length > 0 ? (
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
                {exams.map((exam) => (
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
          ) : (
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
    </div>
  );
}
