
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

const EXAMS_COLLECTION_NAME = 'chit1'; // Updated collection name

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
      const examsCollectionRef = collection(db, EXAMS_COLLECTION_NAME); // Use updated collection name
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
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-7 w-32 mb-1" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]"><Skeleton className="h-5 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-20" /></TableHead>
                  <TableHead className="text-center"><Skeleton className="h-5 w-16" /></TableHead>
                  <TableHead className="text-center"><Skeleton className="h-5 w-16" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-5 w-28" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Skeleton className="h-8 w-8 inline-block" />
                      <Skeleton className="h-8 w-8 inline-block" />
                      <Skeleton className="h-8 w-8 inline-block" />
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
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Oops! Something went wrong.</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchExams}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Exams</h1>
            <p className="text-muted-foreground">Manage and review your created exams.</p>
        </div>
        <Button asChild>
            <Link href="/create-exam">Create New Exam</Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Exam List</CardTitle>
          <CardDescription>
            A list of all exams you have created. You can edit, view results, or delete them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Title</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead className="text-center">Points</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell>{exam.createdAt.toDate().toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={exam.status === 'Published' ? 'default' : exam.status === 'Draft' ? 'secondary' : 'outline'}
                        className={exam.status === 'Archived' ? 'bg-muted text-muted-foreground' : ''}
                      >
                        {exam.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{exam.totalQuestions}</TableCell>
                    <TableCell className="text-center">{exam.totalPoints}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" aria-label="Edit Exam" asChild>
                        {/* TODO: Link to an edit page /exams/[examId]/edit */}
                        <Link href={`/create-exam?examId=${exam.id}`}><Edit3 className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="outline" size="icon" aria-label="View Exam Results" className="text-primary hover:text-primary" asChild>
                         {/* TODO: Link to a results page /exams/[examId]/results */}
                        <Link href={`/exams/${exam.id}/results`}><ArrowRight className="h-4 w-4" /></Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" aria-label="Delete Exam" disabled={deletingExamId === exam.id}>
                            {deletingExamId === exam.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the exam
                              &quot;{exam.title}&quot; and all its associated questions and data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={deletingExamId === exam.id}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteExam(exam.id)}
                              disabled={deletingExamId === exam.id}
                              className="bg-destructive hover:bg-destructive/90"
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
              <p className="text-muted-foreground text-lg">No exams created yet.</p>
              <Button asChild className="mt-4">
                <Link href="/create-exam">Create Your First Exam</Link>
              </Button>
            </div>
          )}
        </CardContent>
        {exams.length > 0 && (
            <CardFooter className="text-sm text-muted-foreground">
                Showing {exams.length} exam{exams.length === 1 ? '' : 's'}.
            </CardFooter>
        )}
      </Card>
    </div>
  );
}

