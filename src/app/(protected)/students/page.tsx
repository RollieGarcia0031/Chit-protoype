// src/app/(protected)/students/page.tsx
'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, PlusCircle, Edit3, Trash2, List, Loader2, AlertTriangle } from "lucide-react";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/config';
import { SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { Timestamp } from "firebase/firestore";
import { collection, query, where, getDocs, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from "firebase/firestore";
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

interface FetchedSubjectInfo {
  id: string;
  name: string;
  code: string;
}

// Updated ClassInfo for local state and display
interface ClassInfo {
  id: string; // classId from Firestore
  subjectId: string; // Firestore ID of the parent subject
  subjectName: string; // Name of the parent subject for display
  subjectCode: string; // Code of the parent subject for display
  sectionName: string;
  yearGrade: string;
  code: string; // class code
  userId?: string;
  createdAt?: Timestamp; // Optional, as it's mainly for Firestore
  updatedAt?: Timestamp; // Optional
}


export default function StudentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [classesError, setClassesError] = useState<string | null>(null);
  
  const [isAddClassDialogOpen, setIsAddClassDialogOpen] = useState(false);
  
  // State for the dialog form
  const [selectedSubjectId, setSelectedSubjectId] = useState(''); // Stores the ID of the selected subject
  const [newSectionName, setNewSectionName] = useState('');
  const [newYearGrade, setNewYearGrade] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);

  const [userSubjects, setUserSubjects] = useState<FetchedSubjectInfo[]>([]);
  const [isLoadingUserSubjects, setIsLoadingUserSubjects] = useState(false);
  const [userSubjectsError, setUserSubjectsError] = useState<string | null>(null);

  // Fetch user's subjects (for the dropdown)
  useEffect(() => {
    const fetchUserSubjects = async () => {
      if (!user) {
        setUserSubjects([]);
        setIsLoadingUserSubjects(false);
        return;
      }
      setIsLoadingUserSubjects(true);
      setUserSubjectsError(null);
      try {
        const subjectsCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME);
        const q = query(subjectsCollectionRef, where("userId", "==", user.uid), orderBy("name", "asc"));
        const querySnapshot = await getDocs(q);
        const fetchedSubjects: FetchedSubjectInfo[] = [];
        querySnapshot.forEach((doc) => {
          fetchedSubjects.push({ id: doc.id, ...doc.data() } as FetchedSubjectInfo);
        });
        setUserSubjects(fetchedSubjects);
      } catch (e) {
        console.error("Error fetching user subjects: ", e);
        setUserSubjectsError("Failed to load subjects.");
        toast({
          title: "Error",
          description: "Could not fetch your subjects.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingUserSubjects(false);
      }
    };

    if (!authLoading && user) {
      fetchUserSubjects();
    } else if (!authLoading && !user) {
      setIsLoadingUserSubjects(false);
      setUserSubjects([]);
    }
  }, [user, authLoading, toast]);

  // Fetch classes once subjects are loaded
  const fetchClasses = async () => {
    if (!user || userSubjects.length === 0) {
      setClasses([]);
      setIsLoadingClasses(false);
      if (user && userSubjects.length === 0 && !isLoadingUserSubjects) {
        // No subjects, so no classes to fetch this way.
      }
      return;
    }
    setIsLoadingClasses(true);
    setClassesError(null);
    const allClasses: ClassInfo[] = [];
    try {
      for (const subject of userSubjects) {
        const classesSubCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME, subject.id, "classes");
        const q = query(classesSubCollectionRef, where("userId", "==", user.uid), orderBy("sectionName", "asc"));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((classDoc) => {
          const classData = classDoc.data();
          allClasses.push({
            id: classDoc.id,
            subjectId: subject.id,
            subjectName: subject.name,
            subjectCode: subject.code,
            sectionName: classData.sectionName,
            yearGrade: classData.yearGrade,
            code: classData.code,
            userId: classData.userId,
            createdAt: classData.createdAt,
            updatedAt: classData.updatedAt,
          });
        });
      }
      setClasses(allClasses);
    } catch (e) {
      console.error("Error fetching classes: ", e);
      setClassesError("Failed to load classes.");
      toast({
        title: "Error Loading Classes",
        description: "Could not fetch class list.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingClasses(false);
    }
  };

  useEffect(() => {
    if (user && !isLoadingUserSubjects && userSubjects.length > 0) {
      fetchClasses();
    } else if (user && !isLoadingUserSubjects && userSubjects.length === 0) {
      // If user has no subjects, no classes can be fetched this way
      setClasses([]);
      setIsLoadingClasses(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userSubjects, isLoadingUserSubjects]);


  const generateClassCode = (subjectCodePart: string, section: string, year: string) => {
    const subjectPart = subjectCodePart.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase();
    const sectionPart = section.replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase();
    const yearPart = year.replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${subjectPart}${sectionPart}${yearPart}-${randomPart}`;
  };

  useEffect(() => {
    if (!editingClass) { 
      let subjectCodeForGeneration = "";
      if (selectedSubjectId && userSubjects.length > 0) {
        const selectedSubject = userSubjects.find(sub => sub.id === selectedSubjectId);
        if (selectedSubject) {
          subjectCodeForGeneration = selectedSubject.code;
        }
      }
      setNewClassCode(generateClassCode(subjectCodeForGeneration, newSectionName, newYearGrade));
    }
  }, [selectedSubjectId, newSectionName, newYearGrade, editingClass, userSubjects]);


  const handleAddOrUpdateClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!selectedSubjectId.trim() || !newSectionName.trim() || !newYearGrade.trim() || !newClassCode.trim()) {
      toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" });
      return;
    }

    setIsSavingClass(true);
    const classDataToSave = {
      sectionName: newSectionName,
      yearGrade: newYearGrade,
      code: newClassCode,
      userId: user.uid,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingClass) {
        // Editing existing class
        const classDocRef = doc(db, SUBJECTS_COLLECTION_NAME, editingClass.subjectId, "classes", editingClass.id);
        await updateDoc(classDocRef, classDataToSave);
        toast({ title: "Class Updated", description: `Class "${editingClass.subjectName} - ${newSectionName}" updated.` });
      } else {
        // Adding new class
        const subjectForNewClass = userSubjects.find(sub => sub.id === selectedSubjectId);
        if (!subjectForNewClass) {
            toast({ title: "Error", description: "Selected subject not found.", variant: "destructive"});
            setIsSavingClass(false);
            return;
        }
        const classesSubCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME, selectedSubjectId, "classes");
        await addDoc(classesSubCollectionRef, {
          ...classDataToSave,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Class Added", description: `Class "${subjectForNewClass.name} - ${newSectionName}" added.` });
      }
      closeDialog();
      await fetchClasses(); // Refetch classes
    } catch (e) {
        console.error("Error saving class: ", e);
        toast({ title: "Error Saving Class", description: "There was an issue. Please try again.", variant: "destructive"});
    } finally {
        setIsSavingClass(false);
    }
  };

  const openEditDialog = (classInfo: ClassInfo) => {
    setEditingClass(classInfo);
    setSelectedSubjectId(classInfo.subjectId); // Subject is not editable for existing class
    setNewSectionName(classInfo.sectionName);
    setNewYearGrade(classInfo.yearGrade);
    setNewClassCode(classInfo.code);
    setIsAddClassDialogOpen(true);
  };

  const handleDeleteClass = async (classToDelete: ClassInfo) => {
    if (!user) return;
    setDeletingClassId(classToDelete.id);
    try {
      const classDocRef = doc(db, SUBJECTS_COLLECTION_NAME, classToDelete.subjectId, "classes", classToDelete.id);
      // Add deletion of students subcollection if needed in future
      await deleteDoc(classDocRef);
      toast({ title: "Class Deleted", description: `Class "${classToDelete.subjectName} - ${classToDelete.sectionName}" has been removed.` });
      setClasses(prevClasses => prevClasses.filter(c => c.id !== classToDelete.id));
    } catch (e) {
      console.error("Error deleting class: ", e);
      toast({ title: "Error Deleting Class", description: "Could not delete class.", variant: "destructive" });
    } finally {
      setDeletingClassId(null);
    }
  };
  
  const closeDialog = () => {
    setIsAddClassDialogOpen(false);
    setSelectedSubjectId('');
    setNewSectionName('');
    setNewYearGrade('');
    setNewClassCode('');
    setEditingClass(null);
  };

  if (authLoading || isLoadingUserSubjects) {
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
            <div className="text-center py-8 sm:py-10">
                <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 rounded-full" />
                <Skeleton className="h-5 w-48 mx-auto mb-2" />
                <Skeleton className="h-4 w-64 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (classesError) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-4">
        <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" />
        <h2 className="text-xl sm:text-2xl font-semibold mb-2">Oops! Something went wrong.</h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-4">{classesError}</p>
        <Button onClick={fetchClasses} size="sm" className="text-xs sm:text-sm">Try Again</Button>
      </div>
    );
  }


  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight flex items-center">
              <Users className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              Your Classes
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Manage your classes and student rosters here. Classes are organized under subjects.
            </CardDescription>
          </div>
          <Dialog open={isAddClassDialogOpen} onOpenChange={(isOpen) => {
            if (!isOpen) closeDialog();
            else setIsAddClassDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs sm:text-sm w-full sm:w-auto" disabled={isLoadingUserSubjects || isSavingClass}>
                <PlusCircle className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Add New Class
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">{editingClass ? "Edit Class" : "Add New Class"}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {editingClass ? `Editing class: ${editingClass.subjectName} - ${editingClass.sectionName}` : "Enter the details for your new class below."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddOrUpdateClass} className="grid gap-3 sm:gap-4 py-2 sm:py-4">
                <div className="grid grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="subjectId" className="text-right text-xs sm:text-sm col-span-1">
                    Subject
                  </Label>
                  <Select
                    value={selectedSubjectId} 
                    onValueChange={(value) => setSelectedSubjectId(value)}
                    required
                    disabled={isLoadingUserSubjects || isSavingClass || !!editingClass} // Disable if editing class
                  >
                    <SelectTrigger id="subjectId" className="col-span-3 h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue placeholder={isLoadingUserSubjects ? "Loading..." : userSubjectsError ? "Error" : "Select subject"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingUserSubjects ? (
                        <SelectItem value="loading" disabled className="text-xs sm:text-sm">Loading subjects...</SelectItem>
                      ) : userSubjectsError ? (
                        <SelectItem value="error" disabled className="text-xs sm:text-sm text-destructive">{userSubjectsError}</SelectItem>
                      ) : userSubjects.length === 0 ? (
                        <SelectItem value="no-subjects" disabled className="text-xs sm:text-sm">No subjects. Create one first.</SelectItem>
                      ) : (
                        userSubjects.map(subject => (
                          <SelectItem key={subject.id} value={subject.id} className="text-xs sm:text-sm">
                            {subject.name} ({subject.code})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="sectionName" className="text-right text-xs sm:text-sm col-span-1">
                    Section
                  </Label>
                  <Input
                    id="sectionName"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="e.g., Section A, P3"
                    className="col-span-3 h-8 sm:h-9 text-xs sm:text-sm"
                    required
                    disabled={isSavingClass}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="yearGrade" className="text-right text-xs sm:text-sm col-span-1">
                    Year/Grade
                  </Label>
                  <Input
                    id="yearGrade"
                    value={newYearGrade}
                    onChange={(e) => setNewYearGrade(e.target.value)}
                    placeholder="e.g., Grade 10, Year 2"
                    className="col-span-3 h-8 sm:h-9 text-xs sm:text-sm"
                    required
                    disabled={isSavingClass}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="classCode" className="text-right text-xs sm:text-sm col-span-1">
                    Code
                  </Label>
                  <Input
                    id="classCode"
                    value={newClassCode}
                    onChange={(e) => setNewClassCode(e.target.value.toUpperCase())}
                    placeholder="Auto-generated or custom"
                    className="col-span-3 h-8 sm:h-9 text-xs sm:text-sm"
                    required
                    disabled={isSavingClass || (!editingClass && (!selectedSubjectId || !newSectionName || !newYearGrade))} 
                  />
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-2">
                  <DialogClose asChild>
                     <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm" disabled={isSavingClass}>Cancel</Button>
                  </DialogClose>
                  <Button type="submit" size="sm" className="text-xs sm:text-sm" disabled={isSavingClass || isLoadingUserSubjects || (userSubjects.length === 0 && !editingClass)}>
                    {isSavingClass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingClass ? "Save Changes" : "Add Class"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoadingClasses ? (
             <div className="text-center py-8 sm:py-10">
                <Loader2 className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-primary animate-spin mb-3 sm:mb-4" />
                <p className="text-md sm:text-lg font-medium text-muted-foreground">Loading classes...</p>
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-8 sm:py-10">
              <List className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-md sm:text-lg font-medium text-muted-foreground">
                No classes created yet.
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Ensure you have subjects created, then click &quot;Add New Class&quot;.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-300px)] sm:h-[calc(100vh-320px)] pr-3">
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {classes.map((cls) => (
                  <Card key={cls.id} className="shadow-md">
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="text-md sm:text-lg font-semibold">{cls.subjectName} <span className="text-sm font-normal text-muted-foreground">({cls.subjectCode})</span></CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Section: {cls.sectionName} | Year/Grade: {cls.yearGrade}
                      </CardDescription>
                      <CardDescription className="text-xs sm:text-sm pt-1">
                        Class Code: <span className="font-mono text-primary">{cls.code}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-3 sm:pb-4">
                      <p className="text-xs sm:text-sm text-muted-foreground italic">Student management for this class coming soon.</p>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 pt-0 pb-3 sm:pb-4">
                        <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => openEditDialog(cls)} disabled={deletingClassId === cls.id || isSavingClass}>
                            <Edit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="sr-only">Edit Class</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" disabled={deletingClassId === cls.id || isSavingClass}>
                                {deletingClassId === cls.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                <span className="sr-only">Delete Class</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base sm:text-lg">Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription className="text-xs sm:text-sm">
                                This action cannot be undone. This will permanently delete the class 
                                &quot;{cls.subjectName} - {cls.sectionName}&quot; and all its student data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                              <AlertDialogCancel disabled={deletingClassId === cls.id} className="text-xs sm:text-sm">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteClass(cls)}
                                disabled={deletingClassId === cls.id}
                                className="bg-destructive hover:bg-destructive/90 text-xs sm:text-sm"
                              >
                                {deletingClassId === cls.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Delete Class
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
         {classes.length > 0 && !isLoadingClasses && (
            <CardFooter className="text-xs sm:text-sm text-muted-foreground pt-3 sm:pt-4 border-t">
                Showing {classes.length} class{classes.length === 1 ? '' : 'es'}.
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
    

    
