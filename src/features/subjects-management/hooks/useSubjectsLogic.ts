
// src/features/subjects-management/hooks/useSubjectsLogic.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase/config';
import { SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc, Timestamp, writeBatch, collectionGroup } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export interface SubjectInfo {
  id: string;
  name: string;
  code: string;
  userId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface UseSubjectsLogicProps {
  user: User | null;
}

export function useSubjectsLogic({ user }: UseSubjectsLogicProps) {
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

  const fetchSubjects = useCallback(async () => {
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
      querySnapshot.forEach((docSnap) => {
        fetchedSubjects.push({ id: docSnap.id, ...docSnap.data() } as SubjectInfo);
      });
      setSubjects(fetchedSubjects);
    } catch (e) {
      console.error("Error fetching subjects: ", e);
      setFetchError("Failed to load subjects. Please try again.");
      toast({ title: "Error", description: "Could not fetch subjects.", variant: "destructive" });
    } finally {
      setIsLoadingSubjects(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleAddOrUpdateSubject = useCallback(async (event: React.FormEvent) => {
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
        await addDoc(collection(db, SUBJECTS_COLLECTION_NAME), { ...subjectData, createdAt: serverTimestamp() });
        toast({ title: "Subject Added", description: `"${newSubjectName}" added successfully.` });
      }
      setIsAddSubjectDialogOpen(false);
      setNewSubjectName(''); setNewSubjectCode(''); setEditingSubject(null);
      await fetchSubjects();
    } catch (e) {
      console.error("Error saving subject: ", e);
      toast({ title: "Error Saving Subject", description: "There was an issue. Please try again.", variant: "destructive" });
    } finally {
      setIsSavingSubject(false);
    }
  }, [user, newSubjectName, newSubjectCode, editingSubject, toast, fetchSubjects]);

  const openEditDialog = useCallback((subjectInfo: SubjectInfo) => {
    setEditingSubject(subjectInfo);
    setNewSubjectName(subjectInfo.name);
    setNewSubjectCode(subjectInfo.code);
    setIsAddSubjectDialogOpen(true);
  }, []);

  const handleDeleteSubject = useCallback(async (subjectId: string, subjectName: string) => {
    if (!user) return;
    setDeletingSubjectId(subjectId);
    const batch = writeBatch(db);
    try {
        // 1. Delete all classes within the subject
        const classesRef = collection(db, SUBJECTS_COLLECTION_NAME, subjectId, "classes");
        const classesSnap = await getDocs(classesRef);
        for (const classDoc of classesSnap.docs) {
            // 2. For each class, delete all students
            const studentsRef = collection(db, SUBJECTS_COLLECTION_NAME, subjectId, "classes", classDoc.id, "students");
            const studentsSnap = await getDocs(studentsRef);
            studentsSnap.forEach(studentDoc => batch.delete(studentDoc.ref));
            // 3. For each class, delete all scores (assuming scores are linked to exams within classes)
            // This part is tricky because scores are under SUBJECTS_COLLECTION_NAME/{subjectId}/classes/{classId}/scores/{studentId}
            // We need to query for exams related to this subject, then query scores for those exams under this class.
            // Simpler approach: If scores are primarily linked via examId, we might rely on exam deletion to clean scores.
            // For direct subject/class deletion, we'll delete students. Scores tied to exams of *this subject* would also need finding.
            // A more robust cleanup of scores might happen when an *exam* is deleted.
            // For now, we delete students in this class.
            batch.delete(classDoc.ref);
        }
        // 4. Delete exams that belong ONLY to this subject
        const examsRef = collection(db, "chit1"); // Assuming EXAMS_COLLECTION_NAME is "chit1"
        const examsQuery = query(examsRef, where("userId", "==", user.uid), where("subjectId", "==", subjectId));
        const examsSnap = await getDocs(examsQuery);

        for (const examDoc of examsSnap.docs) {
            // Delete questionBlocks and their nested questions
            const questionBlocksRef = collection(db, "chit1", examDoc.id, "questionBlocks");
            const questionBlocksSnapshot = await getDocs(questionBlocksRef);
            for (const blockDoc of questionBlocksSnapshot.docs) {
                const questionsRef = collection(db, "chit1", examDoc.id, "questionBlocks", blockDoc.id, "questions");
                const questionsSnapshot = await getDocs(questionsRef);
                questionsSnapshot.forEach(questionDoc => batch.delete(questionDoc.ref));
                batch.delete(blockDoc.ref);
            }
            // Delete assignments subcollection for this exam
            const assignmentsRef = collection(db, "chit1", examDoc.id, "assignments");
            const assignmentsSnapshot = await getDocs(assignmentsRef);
            assignmentsSnapshot.forEach(assignmentDoc => batch.delete(assignmentDoc.ref));

            // Delete student scores associated with this exam (collection group query)
            const scoresQuery = query(collectionGroup(db, 'scores'), where("examId", "==", examDoc.id), where("userId", "==", user.uid));
            const scoresSnapshot = await getDocs(scoresQuery);
            scoresSnapshot.forEach(scoreDoc => batch.delete(scoreDoc.ref));
            
            batch.delete(examDoc.ref); // Delete the exam itself
        }
        
        // 5. Delete the subject document
        batch.delete(doc(db, SUBJECTS_COLLECTION_NAME, subjectId));
        await batch.commit();
        toast({ title: "Subject Deleted", description: `Subject "${subjectName}" and all associated data (classes, students, exams for this subject) deleted.` });
        await fetchSubjects();
    } catch (e) {
        console.error("Error deleting subject and associated data: ", e);
        toast({ title: "Error Deleting Subject", description: "Could not delete subject and its data. Please try again.", variant: "destructive" });
    } finally {
        setDeletingSubjectId(null);
    }
  }, [user, toast, fetchSubjects]);

  const closeDialog = useCallback(() => {
    setIsAddSubjectDialogOpen(false);
    setNewSubjectName('');
    setNewSubjectCode('');
    setEditingSubject(null);
  }, []);

  return {
    subjects,
    isLoadingSubjects,
    isSavingSubject,
    deletingSubjectId,
    isAddSubjectDialogOpen, setIsAddSubjectDialogOpen,
    newSubjectName, setNewSubjectName,
    newSubjectCode, setNewSubjectCode,
    editingSubject,
    fetchError,
    fetchSubjects, // Expose if manual refresh is needed
    handleAddOrUpdateSubject,
    openEditDialog,
    handleDeleteSubject,
    closeDialog,
  };
}
