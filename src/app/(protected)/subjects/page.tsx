// src/app/(protected)/subjects/page.tsx
'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, PlusCircle, Edit3, Trash2, List, Loader2, AlertTriangle } from "lucide-react";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/config';
import { SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
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

interface SubjectInfo {
  id: string;
  name: string;
  code: string;
  userId?: string; // For Firestore query
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export default function SubjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isSavingSubject, setIsSavingSubject] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);
  
  const [isAddSubjectDialogOpen, setIsAddSubjectDialogOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [editingSubject, setEditingSubject] = useState<SubjectInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchSubjects = async () => {
    if (!user) {
      setSubjects([]);
      setIsLoadingSubjects(false);
      return;
    }
    setIsLoadingSubjects(true);
    setFetchError(null);
    try {
      const subjectsCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME);
      const q = query(subjectsCollectionRef, where("userId", "==", user.uid), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedSubjects: SubjectInfo[] = [];
      querySnapshot.forEach((doc) => {
        fetchedSubjects.push({ id: doc.id, ...doc.data() } as SubjectInfo);
      });
      setSubjects(fetchedSubjects);
    } catch (e) {
      console.error("Error fetching subjects: ", e);
      setFetchError("Failed to load subjects. Please try again.");
      toast({
        title: "Error",
        description: "Could not fetch subjects.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSubjects(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchSubjects();
    } else if (!authLoading && !user) {
      setIsLoadingSubjects(false);
      setSubjects([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const handleAddOrUpdateSubject = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!newSubjectName.trim() || !newSubjectCode.trim()) {
      toast({ title: "Validation Error", description: "Subject Name and Code are required.", variant: "destructive" });
      return;
    }

    setIsSavingSubject(true);
    const subjectData = {
      name: newSubjectName,
      code: newSubjectCode.toUpperCase(),
      userId: user.uid,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingSubject) {
        const subjectDocRef = doc(db, SUBJECTS_COLLECTION_NAME, editingSubject.id);
        await updateDoc(subjectDocRef, subjectData);
        toast({ title: "Subject Updated", description: `"${newSubjectName}" updated successfully.` });
      } else {
        await addDoc(collection(db, SUBJECTS_COLLECTION_NAME), {
          ...subjectData,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Subject Added", description: `"${newSubjectName}" added successfully.` });
      }
      closeDialog();
      await fetchSubjects(); // Refetch to update list
    } catch (e) {
      console.error("Error saving subject: ", e);
      toast({ title: "Error Saving Subject", description: "There was an issue. Please try again.", variant: "destructive" });
    } finally {
      setIsSavingSubject(false);
    }
  };

  const openEditDialog = (subjectInfo: SubjectInfo) => {
    setEditingSubject(subjectInfo);
    setNewSubjectName(subjectInfo.name);
    setNewSubjectCode(subjectInfo.code);
    setIsAddSubjectDialogOpen(true);
  };

  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (!user) return;
    setDeletingSubjectId(subjectId);
    try {
      // Add deletion of subcollections (classes and students) here if needed in future
      await deleteDoc(doc(db, SUBJECTS_COLLECTION_NAME, subjectId));
      toast({ title: "Subject Deleted", description: `Subject "${subjectName}" deleted.` });
      setSubjects(prevSubjects => prevSubjects.filter(s => s.id !== subjectId));
    } catch (e) {
      console.error("Error deleting subject: ", e);
      toast({ title: "Error Deleting Subject", description: "Could not delete subject. It might have associated classes.", variant: "destructive" });
    } finally {
      setDeletingSubjectId(null);
    }
  };
  
  const closeDialog = () => {
    setIsAddSubjectDialogOpen(false);
    setNewSubjectName('');
    setNewSubjectCode('');
    setEditingSubject(null);
  };

  if (authLoading || isLoadingSubjects) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <Skeleton className="h-7 w-40 mb-1 sm:h-8 sm:w-48" />
              <Skeleton className="h-4 w-64 sm:h-5 sm:w-80" />
            </div>
            <Skeleton className="h-9 w-36 sm:h-10 sm:w-40" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="shadow-md">
                  <CardHeader className="pb-2 sm:pb-3">
                    <Skeleton className="h-6 w-3/4 mb-1" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardFooter className="flex justify-end gap-2 pt-0 pb-3 sm:pb-4">
                    <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 rounded-md" />
                    <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 rounded-md" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-4">
        <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" />
        <h2 className="text-xl sm:text-2xl font-semibold mb-2">Oops! Something went wrong.</h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-4">{fetchError}</p>
        <Button onClick={fetchSubjects} size="sm" className="text-xs sm:text-sm">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight flex items-center">
              <BookOpen className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              Your Subjects
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Manage your subjects here. Each subject has a name and a unique code.
            </CardDescription>
          </div>
          <Dialog open={isAddSubjectDialogOpen} onOpenChange={(isOpen) => {
            if (!isOpen) closeDialog();
            else setIsAddSubjectDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs sm:text-sm w-full sm:w-auto" disabled={isSavingSubject}>
                <PlusCircle className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Add New Subject
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">{editingSubject ? "Edit Subject" : "Add New Subject"}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {editingSubject ? "Update the details for this subject." : "Enter the details for your new subject below."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddOrUpdateSubject} className="grid gap-3 sm:gap-4 py-2 sm:py-4">
                <div className="grid grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="subjectName" className="text-right text-xs sm:text-sm col-span-1">
                    Name
                  </Label>
                  <Input
                    id="subjectName"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="e.g., Mathematics 101"
                    className="col-span-3 h-8 sm:h-9 text-xs sm:text-sm"
                    required
                    disabled={isSavingSubject}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="subjectCode" className="text-right text-xs sm:text-sm col-span-1">
                    Code
                  </Label>
                  <Input
                    id="subjectCode"
                    value={newSubjectCode}
                    onChange={(e) => setNewSubjectCode(e.target.value.toUpperCase())}
                    placeholder="e.g., MATH101"
                    className="col-span-3 h-8 sm:h-9 text-xs sm:text-sm"
                    maxLength={10}
                    required
                    disabled={isSavingSubject}
                  />
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-2">
                  <DialogClose asChild>
                     <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm" disabled={isSavingSubject}>Cancel</Button>
                  </DialogClose>
                  <Button type="submit" size="sm" className="text-xs sm:text-sm" disabled={isSavingSubject}>
                    {isSavingSubject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingSubject ? "Save Changes" : "Add Subject"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <div className="text-center py-8 sm:py-10">
              <List className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-md sm:text-lg font-medium text-muted-foreground">
                No subjects created yet.
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Click the &quot;Add New Subject&quot; button to get started.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-300px)] sm:h-[calc(100vh-320px)] pr-3">
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {subjects.map((sub) => (
                  <Card key={sub.id} className="shadow-md">
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="text-md sm:text-lg font-semibold">{sub.name}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm pt-1">
                        Code: <span className="font-mono text-primary">{sub.code}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-end gap-2 pt-0 pb-3 sm:pb-4">
                        <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => openEditDialog(sub)} disabled={deletingSubjectId === sub.id || isSavingSubject}>
                            <Edit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="sr-only">Edit Subject</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" disabled={deletingSubjectId === sub.id || isSavingSubject}>
                                {deletingSubjectId === sub.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                <span className="sr-only">Delete Subject</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base sm:text-lg">Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription className="text-xs sm:text-sm">
                                This action cannot be undone. This will permanently delete the subject 
                                &quot;{sub.name}&quot; and all associated classes and student data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                              <AlertDialogCancel disabled={deletingSubjectId === sub.id} className="text-xs sm:text-sm">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSubject(sub.id, sub.name)}
                                disabled={deletingSubjectId === sub.id}
                                className="bg-destructive hover:bg-destructive/90 text-xs sm:text-sm"
                              >
                                {deletingSubjectId === sub.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Delete Subject
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
         {subjects.length > 0 && (
            <CardFooter className="text-xs sm:text-sm text-muted-foreground pt-3 sm:pt-4 border-t">
                Showing {subjects.length} subject{subjects.length === 1 ? '' : 's'}.
            </CardFooter>
        )}
      </Card>
    </div>
  );
}

