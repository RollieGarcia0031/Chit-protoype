
// src/app/(protected)/students/page.tsx
'use client';

import { useState, type FormEvent, useEffect, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, PlusCircle, Edit3, Trash2, List, Loader2, AlertTriangle, BookOpen, LayoutGrid, UserPlus, Users2, ArrowLeft, UploadCloud } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/config';
import { SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { Timestamp } from "firebase/firestore";
import { collection, query, where, getDocs, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, getCountFromServer, writeBatch } from "firebase/firestore";
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
  AlertDialogTrigger as RadixAlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Student, ClassInfoForDropdown as OriginalClassInfoForDropdown } from '@/types/exam-types';
import { cn, generateId } from '@/lib/utils';

interface FetchedSubjectInfo {
  id: string;
  name: string;
  code: string;
}

interface ClassInfo extends OriginalClassInfoForDropdown {
  userId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  studentCount?: number;
}

type DisplayMode = 'bySubject' | 'bySectionYear';

interface GroupedBySectionYear {
  groupTitle: string;
  parsedYear: number;
  sectionNamePart: string;
  classes: ClassInfo[];
}


export default function StudentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  
  const [isAddClassDialogOpen, setIsAddClassDialogOpen] = useState(false);
  
  const [selectedSubjectIdForm, setSelectedSubjectIdForm] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [newYearGrade, setNewYearGrade] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [userSubjects, setUserSubjects] = useState<FetchedSubjectInfo[]>([]);
  const [isLoadingUserSubjects, setIsLoadingUserSubjects] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('bySubject');

  const [managingStudentsForClass, setManagingStudentsForClass] = useState<ClassInfo | null>(null);
  const [studentsForSelectedClass, setStudentsForSelectedClass] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

  const [newStudentFirstName, setNewStudentFirstName] = useState('');
  const [newStudentLastName, setNewStudentLastName] = useState('');
  const [newStudentMiddleName, setNewStudentMiddleName] = useState('');

  // State for Import Students Dialog
  const [isImportStudentsDialogOpen, setIsImportStudentsDialogOpen] = useState(false);
  const [potentialSourceClassesForImport, setPotentialSourceClassesForImport] = useState<ClassInfo[]>([]);
  const [selectedSourceClassIdForImport, setSelectedSourceClassIdForImport] = useState<string | null>(null);
  const [isImportingStudents, setIsImportingStudents] = useState(false);


  const fetchPageData = async () => {
    if (!user) {
      setUserSubjects([]);
      setClasses([]);
      setIsLoadingData(false);
      return;
    }
    setIsLoadingData(true);
    setDataError(null);
    
    const fetchedSubjects: FetchedSubjectInfo[] = [];
    const allClasses: ClassInfo[] = [];

    try {
      const subjectsCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME);
      const subjectsQuery = query(subjectsCollectionRef, where("userId", "==", user.uid), orderBy("name", "asc"));
      const subjectsSnapshot = await getDocs(subjectsQuery);
      subjectsSnapshot.forEach((docSnap) => {
        fetchedSubjects.push({ id: docSnap.id, ...docSnap.data() } as FetchedSubjectInfo);
      });
      setUserSubjects(fetchedSubjects);
      setIsLoadingUserSubjects(false);

      if (fetchedSubjects.length > 0) {
        for (const subject of fetchedSubjects) {
          const classesSubCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME, subject.id, "classes");
          const classesQuerySnapshot = await getDocs(query(classesSubCollectionRef, where("userId", "==", user.uid), orderBy("sectionName", "asc")));
          
          for (const classDoc of classesQuerySnapshot.docs) {
            const classData = classDoc.data();
            let studentCount = 0;
            try {
                const studentsRef = collection(db, SUBJECTS_COLLECTION_NAME, subject.id, "classes", classDoc.id, "students");
                const studentCountSnapshot = await getCountFromServer(studentsRef);
                studentCount = studentCountSnapshot.data().count;
            } catch (countError) {
                console.warn(`Could not fetch student count for class ${classDoc.id}:`, countError);
            }

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
              studentCount: studentCount,
            });
          }
        }
      }
      setClasses(allClasses);
    } catch (e) {
      console.error("Error fetching page data: ", e);
      setDataError("Failed to load subjects or classes.");
      toast({ title: "Error Loading Data", description: "Could not fetch subjects or class list.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchPageData();
    } else if (!authLoading && !user) {
      setIsLoadingData(false);
      setIsLoadingUserSubjects(false);
      setUserSubjects([]);
      setClasses([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

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
      if (selectedSubjectIdForm && userSubjects.length > 0) {
        const selectedSubject = userSubjects.find(sub => sub.id === selectedSubjectIdForm);
        if (selectedSubject) subjectCodeForGeneration = selectedSubject.code;
      }
      setNewClassCode(generateClassCode(subjectCodeForGeneration, newSectionName, newYearGrade));
    }
  }, [selectedSubjectIdForm, newSectionName, newYearGrade, editingClass, userSubjects]);

  const handleAddOrUpdateClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!selectedSubjectIdForm.trim() || !newSectionName.trim() || !newYearGrade.trim() || !newClassCode.trim()) {
      toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" });
      return;
    }
    setIsSavingClass(true);
    const classDataToSave: any = {
      sectionName: newSectionName,
      yearGrade: newYearGrade,
      code: newClassCode,
      userId: user.uid,
      updatedAt: serverTimestamp(),
    };
    try {
      if (editingClass) {
        const classDocRef = doc(db, SUBJECTS_COLLECTION_NAME, editingClass.subjectId, "classes", editingClass.id);
        await updateDoc(classDocRef, classDataToSave);
        toast({ title: "Class Updated", description: `Class "${editingClass.subjectName} - ${newSectionName}" updated.` });
      } else {
        const subjectForNewClass = userSubjects.find(sub => sub.id === selectedSubjectIdForm);
        if (!subjectForNewClass) {
          toast({ title: "Error", description: "Selected subject not found.", variant: "destructive" });
          setIsSavingClass(false); return;
        }
        classDataToSave.createdAt = serverTimestamp();
        const classesSubCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME, selectedSubjectIdForm, "classes");
        await addDoc(classesSubCollectionRef, classDataToSave);
        toast({ title: "Class Added", description: `Class "${subjectForNewClass.name} - ${newSectionName}" added.` });
      }
      closeClassDialog();
      await fetchPageData();
    } catch (e) {
      console.error("Error saving class: ", e);
      toast({ title: "Error Saving Class", description: "There was an issue. Please try again.", variant: "destructive" });
    } finally {
      setIsSavingClass(false);
    }
  };

  const openEditDialog = (classInfo: ClassInfo) => {
    setEditingClass(classInfo);
    setSelectedSubjectIdForm(classInfo.subjectId);
    setNewSectionName(classInfo.sectionName);
    setNewYearGrade(classInfo.yearGrade);
    setNewClassCode(classInfo.code);
    setIsAddClassDialogOpen(true);
  };

  const handleDeleteClass = async (classToDelete: ClassInfo) => {
    if (!user) return;
    setDeletingClassId(classToDelete.id);
    try {
      // Delete all students in the class first
      const studentsRef = collection(db, SUBJECTS_COLLECTION_NAME, classToDelete.subjectId, "classes", classToDelete.id, "students");
      const studentsSnap = await getDocs(studentsRef);
      const batch = writeBatch(db);
      studentsSnap.forEach(studentDoc => {
          batch.delete(studentDoc.ref);
      });
      await batch.commit();

      // Then delete the class itself
      const classDocRef = doc(db, SUBJECTS_COLLECTION_NAME, classToDelete.subjectId, "classes", classToDelete.id);
      await deleteDoc(classDocRef);
      toast({ title: "Class Deleted", description: `Class "${classToDelete.subjectName} - ${classToDelete.sectionName}" and its students have been removed.` });
      setClasses(prevClasses => prevClasses.filter(c => c.id !== classToDelete.id));
      if(managingStudentsForClass?.id === classToDelete.id) {
        setManagingStudentsForClass(null); 
      }
    } catch (e) {
      console.error("Error deleting class: ", e);
      toast({ title: "Error Deleting Class", description: "Could not delete class.", variant: "destructive" });
    } finally {
      setDeletingClassId(null);
    }
  };
  
  const closeClassDialog = () => {
    setIsAddClassDialogOpen(false);
    setSelectedSubjectIdForm('');
    setNewSectionName('');
    setNewYearGrade('');
    setNewClassCode('');
    setEditingClass(null);
  };

  const extractNumericYear = (yearGradeStr: string): number => {
    if (!yearGradeStr) return Infinity;
    const numericMatch = yearGradeStr.match(/\d+/);
    if (numericMatch) return parseInt(numericMatch[0], 10);
    const lowerYearGrade = yearGradeStr.toLowerCase();
    if (lowerYearGrade.includes('k') || lowerYearGrade.includes('kinder')) return -1;
    if (lowerYearGrade.includes('pre-k') || lowerYearGrade.includes('pre k')) return -2;
    return Infinity;
  };

  const groupedClassesBySectionYear = useMemo(() => {
    if (displayMode !== 'bySectionYear') return [];
    const groupMap: Map<string, { groupTitle: string; parsedYear: number; sectionNamePart: string; classes: ClassInfo[] }> = new Map();
    classes.forEach(cls => {
      const groupKey = `${cls.sectionName}-${cls.yearGrade}`;
      const groupTitle = `${cls.sectionName} (${cls.yearGrade})`;
      const parsedYear = extractNumericYear(cls.yearGrade);
      const sectionNamePart = cls.sectionName;
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, { groupTitle, parsedYear, sectionNamePart, classes: [] });
      groupMap.get(groupKey)!.classes.push(cls);
    });
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.parsedYear !== b.parsedYear) return a.parsedYear - b.parsedYear;
      return a.sectionNamePart.localeCompare(b.sectionNamePart);
    });
  }, [classes, displayMode]);

  const openStudentManagementView = async (classInfo: ClassInfo) => {
    setManagingStudentsForClass(classInfo);
    await fetchStudentsForClass(classInfo);
  };

  const closeStudentManagementView = () => {
    setManagingStudentsForClass(null);
    setStudentsForSelectedClass([]);
    setNewStudentFirstName('');
    setNewStudentLastName('');
    setNewStudentMiddleName('');
    setIsImportStudentsDialogOpen(false);
    setPotentialSourceClassesForImport([]);
    setSelectedSourceClassIdForImport(null);
  };

  const fetchStudentsForClass = async (classInfo: ClassInfo) => {
    if (!user || !classInfo) {
      setStudentsForSelectedClass([]);
      return;
    }
    setIsLoadingStudents(true);
    try {
      const studentsRef = collection(db, SUBJECTS_COLLECTION_NAME, classInfo.subjectId, "classes", classInfo.id, "students");
      const q = query(studentsRef, orderBy("lastName", "asc"), orderBy("firstName", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedStudents: Student[] = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Student));
      setStudentsForSelectedClass(fetchedStudents);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast({ title: "Error", description: "Could not fetch students for this class.", variant: "destructive" });
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleAddStudent = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !managingStudentsForClass || !newStudentFirstName.trim() || !newStudentLastName.trim()) {
      toast({ title: "Validation Error", description: "First Name and Last Name are required.", variant: "destructive" });
      return;
    }

    const tempId = generateId('student-optimistic');
    const optimisticStudent: Student = {
      id: tempId, 
      tempId: tempId,
      firstName: newStudentFirstName.trim(),
      lastName: newStudentLastName.trim(),
      middleName: newStudentMiddleName.trim() || "",
      userId: user.uid,
      classId: managingStudentsForClass.id,
      subjectId: managingStudentsForClass.subjectId,
      isOptimistic: true,
      isSaving: true,
    };

    setStudentsForSelectedClass(prevStudents => [...prevStudents, optimisticStudent]);

    const currentFirstNameForToast = newStudentFirstName;
    const currentLastNameForToast = newStudentLastName;
    setNewStudentFirstName('');
    setNewStudentLastName('');
    setNewStudentMiddleName('');

    try {
      const studentsRef = collection(db, SUBJECTS_COLLECTION_NAME, managingStudentsForClass.subjectId, "classes", managingStudentsForClass.id, "students");
      const studentDataForFirestore = {
        firstName: optimisticStudent.firstName,
        lastName: optimisticStudent.lastName,
        middleName: optimisticStudent.middleName,
        userId: user.uid,
        classId: managingStudentsForClass.id,
        subjectId: managingStudentsForClass.subjectId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const docRef = await addDoc(studentsRef, studentDataForFirestore);

      setStudentsForSelectedClass(prevStudents =>
        prevStudents.map(student =>
          student.tempId === tempId
            ? { ...student, id: docRef.id, isOptimistic: false, isSaving: false, tempId: undefined }
            : student
        )
      );

      toast({ title: "Student Added", description: `${currentFirstNameForToast} ${currentLastNameForToast} added.` });

      if (managingStudentsForClass) {
        const updatedClassInfo = { ...managingStudentsForClass, studentCount: (managingStudentsForClass.studentCount || 0) + 1 };
        setManagingStudentsForClass(updatedClassInfo);
        setClasses(prev => prev.map(c => c.id === updatedClassInfo.id ? updatedClassInfo : c));
      }

    } catch (error) {
      console.error("Error adding student:", error);
      toast({ title: "Error Adding Student", description: "Could not add student.", variant: "destructive" });
      setStudentsForSelectedClass(prevStudents => prevStudents.filter(student => student.tempId !== tempId));
    }
  };


  const handleDeleteStudent = async (studentToDelete: Student) => {
    if (!user || !managingStudentsForClass || !studentToDelete) return;
    setDeletingStudentId(studentToDelete.id);
    try {
      const studentDocRef = doc(db, SUBJECTS_COLLECTION_NAME, managingStudentsForClass.subjectId, "classes", managingStudentsForClass.id, "students", studentToDelete.id);
      await deleteDoc(studentDocRef);
      toast({ title: "Student Removed", description: `${studentToDelete.firstName} ${studentToDelete.lastName} removed.` });
      
      setStudentsForSelectedClass(prev => prev.filter(s => s.id !== studentToDelete.id));
      
      if (managingStudentsForClass) {
        const updatedClassInfo = {...managingStudentsForClass, studentCount: Math.max(0, (managingStudentsForClass.studentCount || 0) - 1)};
        setManagingStudentsForClass(updatedClassInfo);
         setClasses(prev => prev.map(c => c.id === updatedClassInfo.id ? updatedClassInfo : c));
      }
    } catch (error) {
      console.error("Error deleting student:", error);
      toast({ title: "Error Deleting Student", description: "Could not remove student.", variant: "destructive" });
    } finally {
      setDeletingStudentId(null);
    }
  };

  const openImportStudentsDialog = () => {
    if (!managingStudentsForClass || !user) return;
    const sources = classes.filter(cls =>
        cls.sectionName === managingStudentsForClass.sectionName &&
        cls.yearGrade === managingStudentsForClass.yearGrade &&
        cls.subjectId !== managingStudentsForClass.subjectId &&
        cls.id !== managingStudentsForClass.id &&
        cls.userId === user?.uid
    );
    setPotentialSourceClassesForImport(sources);
    setSelectedSourceClassIdForImport(null);
    setIsImportStudentsDialogOpen(true);
  };

  const handleImportStudents = async () => {
    if (!user || !managingStudentsForClass || !selectedSourceClassIdForImport) {
      toast({ title: "Import Error", description: "Target class or source class not selected.", variant: "destructive" });
      return;
    }
    setIsImportingStudents(true);
    let importedCount = 0;
    let skippedCount = 0;

    try {
      const sourceClass = potentialSourceClassesForImport.find(c => c.id === selectedSourceClassIdForImport);
      if (!sourceClass) {
        toast({ title: "Import Error", description: "Source class details not found.", variant: "destructive" });
        setIsImportingStudents(false);
        return;
      }

      const sourceStudentsRef = collection(db, SUBJECTS_COLLECTION_NAME, sourceClass.subjectId, "classes", sourceClass.id, "students");
      const sourceStudentsSnap = await getDocs(sourceStudentsRef);

      const targetStudentsRef = collection(db, SUBJECTS_COLLECTION_NAME, managingStudentsForClass.subjectId, "classes", managingStudentsForClass.id, "students");
      const batch = writeBatch(db);

      for (const studentDoc of sourceStudentsSnap.docs) {
        const studentData = studentDoc.data();
        const alreadyExists = studentsForSelectedClass.some(
          s => s.firstName.toLowerCase() === studentData.firstName.toLowerCase() && 
               s.lastName.toLowerCase() === studentData.lastName.toLowerCase() &&
               (s.middleName || "").toLowerCase() === (studentData.middleName || "").toLowerCase()
        );

        if (alreadyExists) {
          skippedCount++;
          continue;
        }

        const newStudentDocRef = doc(targetStudentsRef); // Generate new ID for target
        batch.set(newStudentDocRef, {
          firstName: studentData.firstName,
          lastName: studentData.lastName,
          middleName: studentData.middleName || "",
          userId: user.uid,
          classId: managingStudentsForClass.id,
          subjectId: managingStudentsForClass.subjectId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        importedCount++;
      }

      await batch.commit();

      toast({
        title: "Import Complete",
        description: `${importedCount} student(s) imported. ${skippedCount} duplicate(s) skipped.`,
      });

      await fetchStudentsForClass(managingStudentsForClass); // Refresh target student list
      if (managingStudentsForClass) { // Update target class student count
         const updatedCount = (managingStudentsForClass.studentCount || 0) + importedCount;
         const updatedTargetClass = { ...managingStudentsForClass, studentCount: updatedCount };
         setManagingStudentsForClass(updatedTargetClass);
         setClasses(prev => prev.map(c => c.id === updatedTargetClass.id ? updatedTargetClass : c));
      }

    } catch (error) {
      console.error("Error importing students:", error);
      toast({ title: "Import Failed", description: "An error occurred during student import.", variant: "destructive" });
    } finally {
      setIsImportingStudents(false);
      setIsImportStudentsDialogOpen(false);
    }
  };


  const renderClassItem = (cls: ClassInfo) => (
    <Card key={cls.id} className="shadow-md w-full">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-sm sm:text-base font-semibold">
          {displayMode === 'bySubject' ? `${cls.sectionName} (${cls.yearGrade})` : `${cls.subjectName} (${cls.subjectCode})`}
        </CardTitle>
        <CardDescription className="text-2xs sm:text-xs pt-0.5">
          Class Code: <span className="font-mono text-primary">{cls.code}</span>
        </CardDescription>
        <CardDescription className="text-2xs sm:text-xs pt-0.5">
          Students: {typeof cls.studentCount === 'number' ? cls.studentCount : '...'}
        </CardDescription>
        {displayMode === 'bySectionYear' && (
          <CardDescription className="text-2xs sm:text-xs pt-0.5">Section: {cls.sectionName} | Year/Grade: {cls.yearGrade}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 sm:pb-4 pt-1">
         <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm" onClick={() => openStudentManagementView(cls)}>
            <Users2 className="mr-2 h-3.5 w-3.5" /> Manage Students
        </Button>
      </CardContent>
      <CardFooter className="flex justify-end gap-1.5 sm:gap-2 pt-0 pb-2 sm:pb-3 px-2 sm:px-4">
        <Button variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => openEditDialog(cls)} disabled={deletingClassId === cls.id || isSavingClass}>
          <Edit3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /><span className="sr-only">Edit Class</span>
        </Button>
        <AlertDialog>
          <RadixAlertDialogTrigger asChild>
            <Button variant="destructive" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" disabled={deletingClassId === cls.id || isSavingClass}>
              {deletingClassId === cls.id ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin"/> : <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
              <span className="sr-only">Delete Class</span>
            </Button>
          </RadixAlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base sm:text-lg">Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs sm:text-sm">This action cannot be undone. This will permanently delete the class &quot;{cls.subjectName} - {cls.sectionName}&quot; and all its student data.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <AlertDialogCancel disabled={deletingClassId === cls.id} className="text-xs sm:text-sm">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDeleteClass(cls)} disabled={deletingClassId === cls.id} className="bg-destructive hover:bg-destructive/90 text-xs sm:text-sm">
                {deletingClassId === cls.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Delete Class
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );

  if (authLoading || isLoadingData || isLoadingUserSubjects) {
    return ( <div className="space-y-4 sm:space-y-6"> <Card className="shadow-lg"> <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"> <div> <Skeleton className="h-7 w-40 mb-1 sm:h-8 sm:w-48" /> <Skeleton className="h-4 w-64 sm:h-5 sm:w-80" /> </div> <div className="flex gap-2 w-full sm:w-auto"> <Skeleton className="h-9 sm:h-10 flex-grow sm:w-40" /> <Skeleton className="h-9 sm:h-10 flex-grow sm:w-36" /> </div> </CardHeader> <CardContent> <Skeleton className="h-6 w-1/3 mb-4" /> <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3"> {[...Array(3)].map((_, i) => ( <Card key={i} className="shadow-md"> <CardHeader className="pb-2 sm:pb-3"> <Skeleton className="h-5 w-3/4 mb-1" /> <Skeleton className="h-3 w-1/2 mb-1" /> <Skeleton className="h-3 w-2/3" /> </CardHeader> <CardContent className="pb-3 sm:pb-4 pt-1"> <Skeleton className="h-8 w-full" /> </CardContent> <CardFooter className="flex justify-end gap-2 pt-0 pb-2 sm:pb-3 px-2 sm:px-4"> <Skeleton className="h-6 w-6 sm:h-7 sm:w-7 rounded-md" /> <Skeleton className="h-6 w-6 sm:h-7 sm:w-7 rounded-md" /> </CardFooter> </Card> ))} </div> </CardContent> </Card> </div> );
  }
  if (dataError) {
    return ( <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-4"> <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" /> <h2 className="text-xl sm:text-2xl font-semibold mb-2">Oops! Something went wrong.</h2> <p className="text-sm sm:text-base text-muted-foreground mb-4">{dataError}</p> <Button onClick={fetchPageData} size="sm" className="text-xs sm:text-sm">Try Again</Button> </div> );
  }

  if (managingStudentsForClass) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight flex items-center">
                <Users2 className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                Manage Students: {managingStudentsForClass.subjectName} - {managingStudentsForClass.sectionName} ({managingStudentsForClass.yearGrade})
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Class Code: {managingStudentsForClass.code}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={closeStudentManagementView} className="text-xs sm:text-sm">
              <ArrowLeft className="mr-1 sm:mr-2 h-3.5 w-3.5" /> Back to Class List
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="md:col-span-1 space-y-4">
            <div>
                <h3 className="text-md sm:text-lg font-semibold mb-3 sm:mb-4 border-b pb-2">Add New Student</h3>
                <form onSubmit={handleAddStudent} className="space-y-3 sm:space-y-4">
                <div>
                    <Label htmlFor="studentFirstName" className="text-xs sm:text-sm">First Name</Label>
                    <Input id="studentFirstName" value={newStudentFirstName} onChange={(e) => setNewStudentFirstName(e.target.value)} required className="h-8 sm:h-9 text-xs sm:text-sm"/>
                </div>
                <div>
                    <Label htmlFor="studentLastName" className="text-xs sm:text-sm">Last Name</Label>
                    <Input id="studentLastName" value={newStudentLastName} onChange={(e) => setNewStudentLastName(e.target.value)} required className="h-8 sm:h-9 text-xs sm:text-sm"/>
                </div>
                <div>
                    <Label htmlFor="studentMiddleName" className="text-xs sm:text-sm">Middle Name (Optional)</Label>
                    <Input id="studentMiddleName" value={newStudentMiddleName} onChange={(e) => setNewStudentMiddleName(e.target.value)} className="h-8 sm:h-9 text-xs sm:text-sm"/>
                </div>
                <Button type="submit" disabled={isLoadingStudents || studentsForSelectedClass.some(s => !!s.isSaving)} size="sm" className="w-full text-xs sm:text-sm">
                    {studentsForSelectedClass.some(s => !!s.isSaving) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} 
                    Add Student
                </Button>
                </form>
            </div>
            <div>
                <h3 className="text-md sm:text-lg font-semibold mb-3 sm:mb-4 border-b pb-2">Import Students</h3>
                 <Dialog open={isImportStudentsDialogOpen} onOpenChange={setIsImportStudentsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-auto text-xs sm:text-sm px-3"
                            onClick={openImportStudentsDialog}
                            disabled={isImportingStudents}
                        >
                            <UploadCloud className="mr-1.5 h-3.5 w-3.5" />Import
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-base sm:text-lg">Import Students</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm">
                                Select a class with the same section and year/grade from a different subject to import students.
                                Duplicates (based on full name) will be skipped.
                            </DialogDescription>
                        </DialogHeader>
                        {potentialSourceClassesForImport.length > 0 ? (
                            <div className="space-y-3 py-2">
                                <Label htmlFor="sourceClassImport" className="text-xs sm:text-sm">Source Class</Label>
                                <Select
                                    value={selectedSourceClassIdForImport || ""}
                                    onValueChange={setSelectedSourceClassIdForImport}
                                    disabled={isImportingStudents}
                                >
                                    <SelectTrigger id="sourceClassImport" className="h-9 text-xs sm:text-sm">
                                        <SelectValue placeholder="Select source class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {potentialSourceClassesForImport.map(cls => (
                                            <SelectItem key={cls.id} value={cls.id} className="text-xs sm:text-sm">
                                                {cls.subjectName} ({cls.subjectCode}) - {cls.sectionName} ({cls.yearGrade})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                No other classes found with the same section/year ({managingStudentsForClass?.sectionName} - {managingStudentsForClass?.yearGrade}) in a different subject.
                            </p>
                        )}
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm" disabled={isImportingStudents}>Cancel</Button>
                            </DialogClose>
                            <Button 
                                type="button" 
                                onClick={handleImportStudents} 
                                size="sm" 
                                className="text-xs sm:text-sm" 
                                disabled={isImportingStudents || !selectedSourceClassIdForImport || potentialSourceClassesForImport.length === 0}
                            >
                                {isImportingStudents && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Import
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
          </div>
          <div className="md:col-span-2 flex flex-col">
            <h3 className="text-md sm:text-lg font-semibold mb-3 sm:mb-4 border-b pb-2 shrink-0">
              Enrolled Students ({studentsForSelectedClass.filter(s => !s.isOptimistic || (s.isOptimistic && !s.isSaving)).length})
            </h3>
            {isLoadingStudents && studentsForSelectedClass.length === 0 ? ( 
              <div className="flex-grow flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : studentsForSelectedClass.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 flex-grow flex items-center justify-center">
                No students enrolled in this class yet.
              </p>
            ) : (
              <ul className="space-y-2 overflow-y-auto pr-2 flex-grow">
                {studentsForSelectedClass.map(student => (
                  <li 
                    key={student.id} 
                    className={cn(
                        "flex items-center justify-between p-2.5 sm:p-3 bg-background border rounded-md shadow-sm",
                        student.isSaving && "opacity-60 bg-muted pointer-events-none",
                        student.isOptimistic && !student.isSaving && "border-dashed border-primary/50"
                    )}
                  >
                    <span className="text-xs sm:text-sm flex items-center">
                      {student.isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      {student.lastName}, {student.firstName} {student.middleName && ` ${student.middleName.charAt(0)}.`}
                    </span>
                    <AlertDialog>
                      <RadixAlertDialogTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-muted-foreground hover:text-destructive" 
                            disabled={deletingStudentId === student.id || !!student.isSaving}
                        >
                          {deletingStudentId === student.id && !student.isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </RadixAlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-base sm:text-lg">Remove Student?</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs sm:text-sm">
                            Are you sure you want to remove {student.firstName} {student.lastName} from this class?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                          <AlertDialogCancel className="text-xs sm:text-sm" disabled={deletingStudentId === student.id}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteStudent(student)}
                            disabled={deletingStudentId === student.id}
                            className="bg-destructive hover:bg-destructive/90 text-xs sm:text-sm"
                          >
                            {deletingStudentId === student.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div> <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight flex items-center"> <Users className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Your Classes </CardTitle> <CardDescription className="text-xs sm:text-sm"> Manage your classes and student lists here. </CardDescription> </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={displayMode} onValueChange={(value) => setDisplayMode(value as DisplayMode)}> <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs sm:text-sm"> <SelectValue placeholder="Display mode" /> </SelectTrigger> <SelectContent> <SelectItem value="bySubject" className="text-xs sm:text-sm">Group by Subject</SelectItem> <SelectItem value="bySectionYear" className="text-xs sm:text-sm">Group by Section/Year</SelectItem> </SelectContent> </Select>
            <Dialog open={isAddClassDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) closeClassDialog(); else setIsAddClassDialogOpen(true); }}> 
               <DialogTrigger asChild>
                <button
                  type="button"
                  className={cn(buttonVariants({ size: "sm" }), "text-xs sm:text-sm w-full sm:w-auto h-9")}
                  disabled={isSavingClass || userSubjects.length === 0}
                >
                  <PlusCircle className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 inline-block" /> Add New Class
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]"> 
                <DialogHeader> <DialogTitle className="text-base sm:text-lg">{editingClass ? "Edit Class" : "Add New Class"}</DialogTitle> <DialogDescription className="text-xs sm:text-sm"> {editingClass ? `Editing class: ${editingClass.subjectName} - ${editingClass.sectionName}` : "Enter the details for your new class below."} {userSubjects.length === 0 && !editingClass && " You must create a subject first before adding a class."} </DialogDescription> </DialogHeader> <form onSubmit={handleAddOrUpdateClass} className="grid gap-3 sm:gap-4 py-2 sm:py-4"> <div className="grid grid-cols-4 items-center gap-2 sm:gap-4"> <Label htmlFor="subjectId" className="text-right text-xs sm:text-sm col-span-1"> Subject </Label> <Select value={selectedSubjectIdForm} onValueChange={(value) => setSelectedSubjectIdForm(value)} required disabled={isSavingClass || !!editingClass || userSubjects.length === 0}> <SelectTrigger id="subjectId" className="col-span-3 h-8 sm:h-9 text-xs sm:text-sm"> <SelectValue placeholder={userSubjects.length === 0 ? "No subjects available" : "Select subject"} /> </SelectTrigger> <SelectContent> {userSubjects.map(subject => ( <SelectItem key={subject.id} value={subject.id} className="text-xs sm:text-sm"> {subject.name} ({subject.code}) </SelectItem> ))} </SelectContent> </Select> </div> <div className="grid grid-cols-4 items-center gap-2 sm:gap-4"> <Label htmlFor="sectionName" className="text-right text-xs sm:text-sm col-span-1"> Section </Label> <Input id="sectionName" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="e.g., Section A, P3" className="col-span-3 h-8 sm:h-9 text-xs sm:text-sm" required disabled={isSavingClass} /> </div> <div className="grid grid-cols-4 items-center gap-2 sm:gap-4"> <Label htmlFor="yearGrade" className="text-right text-xs sm:text-sm col-span-1"> Year/Grade </Label> <Input id="yearGrade" value={newYearGrade} onChange={(e) => setNewYearGrade(e.target.value)} placeholder="e.g., Grade 10, Year 2" className="col-span-3 h-8 sm:h-9 text-xs sm:text-sm" required disabled={isSavingClass} /> </div> <div className="grid grid-cols-4 items-center gap-2 sm:gap-4"> <Label htmlFor="classCode" className="text-right text-xs sm:text-sm col-span-1"> Code </Label> <Input id="classCode" value={newClassCode} onChange={(e) => setNewClassCode(e.target.value.toUpperCase())} placeholder="Auto-generated or custom" className="col-span-3 h-8 sm:h-9 text-xs sm:text-sm" required disabled={isSavingClass || (!editingClass && (!selectedSubjectIdForm || !newSectionName || !newYearGrade))} /> </div> <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-2"> <DialogClose asChild> <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm" disabled={isSavingClass}>Cancel</Button> </DialogClose> <Button type="submit" size="sm" className="text-xs sm:text-sm" disabled={isSavingClass || (userSubjects.length === 0 && !editingClass)}> {isSavingClass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editingClass ? "Save Changes" : "Add Class"} </Button> </DialogFooter> </form> </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {classes.length === 0 && !isLoadingData ? ( <div className="text-center py-8 sm:py-10"> <List className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" /> <h3 className="text-md sm:text-lg font-medium text-muted-foreground"> {userSubjects.length === 0 ? "No subjects created yet." : "No classes created yet."} </h3> <p className="text-xs sm:text-sm text-muted-foreground"> {userSubjects.length === 0 ? "Please add a subject first in the 'Subjects' tab." : "Click \"Add New Class\" to get started."} </p> </div> ) : ( <div className="space-y-4"> {displayMode === 'bySubject' && userSubjects.map(subject => { const subjectClasses = classes.filter(c => c.subjectId === subject.id); if (subjectClasses.length === 0 && userSubjects.length > 1 && classes.length > 0 && !classes.some(c=>c.subjectId === subject.id) ) return null; return ( <Card key={subject.id} className="shadow-md"> <CardHeader className="pt-3 pb-2 sm:pt-4 sm:pb-3"> <CardTitle className="text-base sm:text-lg font-semibold flex items-center"> <BookOpen className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground"/> {subject.name} <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">({subject.code})</span> </CardTitle> </CardHeader> <CardContent> {subjectClasses.length === 0 ? ( <p className="text-xs sm:text-sm text-muted-foreground py-2 text-center">No classes in this subject.</p> ) : ( <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3"> {subjectClasses.map(cls => renderClassItem(cls))} </div> )} </CardContent> </Card> ); })} {displayMode === 'bySectionYear' && groupedClassesBySectionYear.map(group => ( <Card key={group.groupTitle} className="shadow-md"> <CardHeader className="pt-3 pb-2 sm:pt-4 sm:pb-3"> <CardTitle className="text-base sm:text-lg font-semibold flex items-center"> <LayoutGrid className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground"/> {group.groupTitle} </CardTitle> </CardHeader> <CardContent> {group.classes.length === 0 ? ( <p className="text-xs sm:text-sm text-muted-foreground py-2 text-center">No classes in this section/year.</p> ) : ( <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3"> {group.classes.map(cls => renderClassItem(cls))} </div> )} </CardContent> </Card> ))} </div> )}
        </CardContent>
        {(classes.length > 0 || userSubjects.length > 0) && !isLoadingData && ( <CardFooter className="text-xs sm:text-sm text-muted-foreground pt-3 sm:pt-4 border-t"> {displayMode === 'bySubject' ? `Showing ${userSubjects.length} subject${userSubjects.length === 1 ? '' : 's'} with ${classes.length} class${classes.length === 1 ? '' : 'es'} in total.` : `Showing ${groupedClassesBySectionYear.length} section/year group${groupedClassesBySectionYear.length === 1 ? '' : 's'} with ${classes.length} class${classes.length === 1 ? '' : 'es'} in total.` } </CardFooter> )}
      </Card>
    </div>
  );
}

    
