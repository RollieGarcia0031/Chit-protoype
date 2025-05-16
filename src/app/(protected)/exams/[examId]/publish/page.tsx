
// src/app/(protected)/exams/[examId]/publish/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, getDocs, query, where, orderBy, addDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { ExamSummaryData, ClassInfoForDropdown, ExamAssignment } from '@/types/exam-types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CalendarIcon, Send, AlertTriangle, Info, Save, Loader2, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, set } from 'date-fns';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ClassAssignmentState {
  classInfo: ClassInfoForDropdown;
  date?: Date;
  time?: string; // HH:mm
  existingAssignmentId?: string;
  assignmentStatus?: ExamAssignment['status'];
  initialAssignedDateTime?: Timestamp; // To detect changes
}

type AssignmentMode = 'all' | 'individual';

export default function PublishExamPage() {
  const params = useParams();
  const examId = params.examId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [examDetails, setExamDetails] = useState<ExamSummaryData | null>(null);
  const [classAssignments, setClassAssignments] = useState<ClassAssignmentState[]>([]);
  
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('individual');
  const [commonDate, setCommonDate] = useState<Date | undefined>(undefined);
  const [commonTime, setCommonTime] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !examId || authLoading) {
      if (!authLoading && !user) router.push('/login');
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const examDocRef = doc(db, EXAMS_COLLECTION_NAME, examId);
        const examSnap = await getDoc(examDocRef);

        if (!examSnap.exists() || examSnap.data()?.userId !== user.uid) {
          setError("Exam not found or you don't have permission.");
          toast({ title: "Error", description: "Exam not found or access denied.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        const currentExamDetails = { id: examSnap.id, ...examSnap.data() } as ExamSummaryData;
        setExamDetails(currentExamDetails);

        if (!currentExamDetails.classIds || currentExamDetails.classIds.length === 0) {
          setError("This exam is not assigned to any classes. Please assign classes in the 'Edit Exam' screen first.");
          setClassAssignments([]);
          setIsLoading(false);
          return;
        }

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

        const assignedClassDetails: ClassInfoForDropdown[] = currentExamDetails.classIds
          .map(id => allUserClassesMap.get(id))
          .filter(Boolean) as ClassInfoForDropdown[];

        if (assignedClassDetails.length === 0 && currentExamDetails.classIds.length > 0) {
            setError("Could not find details for one or more assigned classes. Please check class assignments.");
        }

        const assignmentsRef = collection(db, EXAMS_COLLECTION_NAME, examId, "assignments");
        const assignmentsSnap = await getDocs(assignmentsRef);
        const existingAssignmentsMap = new Map<string, ExamAssignment>();
        assignmentsSnap.forEach(assignDoc => {
          const data = assignDoc.data() as ExamAssignment;
          existingAssignmentsMap.set(data.classId, { ...data, id: assignDoc.id });
        });
        
        const initialAssignments = assignedClassDetails.map(classInfo => {
          const existingAssignment = existingAssignmentsMap.get(classInfo.id);
          let date: Date | undefined = undefined;
          let time: string = '';
          if (existingAssignment?.assignedDateTime) {
            const tsDate = existingAssignment.assignedDateTime.toDate();
            date = tsDate;
            time = format(tsDate, "HH:mm");
          }
          return {
            classInfo,
            date,
            time,
            existingAssignmentId: existingAssignment?.id,
            assignmentStatus: existingAssignment?.status,
            initialAssignedDateTime: existingAssignment?.assignedDateTime,
          };
        });
        setClassAssignments(initialAssignments);

      } catch (e) {
        console.error("Error fetching data for publish page: ", e);
        setError("Failed to load data. Please try again.");
        toast({ title: "Error", description: "Could not load necessary data.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [examId, user, authLoading, toast, router]);

  const handleIndividualDateChange = (classId: string, newDate?: Date) => {
    setClassAssignments(prev => 
      prev.map(ca => ca.classInfo.id === classId ? { ...ca, date: newDate } : ca)
    );
  };

  const handleIndividualTimeChange = (classId: string, newTime: string) => {
    setClassAssignments(prev =>
      prev.map(ca => ca.classInfo.id === classId ? { ...ca, time: newTime } : ca)
    );
  };

  const handleAssignmentModeChange = (mode: AssignmentMode) => {
    setAssignmentMode(mode);
    if (mode === 'individual' && commonDate && commonTime) {
      setClassAssignments(prev => prev.map(ca => ({
        ...ca,
        date: commonDate,
        time: commonTime,
      })));
    }
  };

  const handleSaveAssignments = async () => {
    if (!user || !examDetails) return;
    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;
    let changesMade = false;
    let examActuallyPublished = false;

    if (assignmentMode === 'all') {
      if (!commonDate || !commonTime) {
        toast({ title: "Missing Information", description: "Please set a common date and time for all classes.", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      const [commonHours, commonMinutes] = commonTime.split(':').map(Number);
      if (isNaN(commonHours) || isNaN(commonMinutes) || commonHours < 0 || commonHours > 23 || commonMinutes < 0 || commonMinutes > 59) {
        toast({ title: "Invalid Time", description: "Invalid common time. Please use HH:mm format.", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      const commonCombinedDateTime = set(commonDate, { hours: commonHours, minutes: commonMinutes, seconds: 0, milliseconds: 0 });
      const commonAssignedTimestamp = Timestamp.fromDate(commonCombinedDateTime);

      for (const ca of classAssignments) {
        let needsUpdate = true;
        if (ca.existingAssignmentId && ca.initialAssignedDateTime) {
          if (ca.initialAssignedDateTime.isEqual(commonAssignedTimestamp)) {
            needsUpdate = false;
          }
        }
        if (!needsUpdate && ca.existingAssignmentId) {
           successCount++; continue;
        }
        changesMade = true;
        examActuallyPublished = true;
        const assignmentData: Omit<ExamAssignment, 'id' | 'createdAt'> = {
          examId: examDetails.id,
          classId: ca.classInfo.id,
          assignedDateTime: commonAssignedTimestamp,
          status: 'Scheduled',
        };
        try {
          const assignmentsCollectionRef = collection(db, EXAMS_COLLECTION_NAME, examDetails.id, "assignments");
          if (ca.existingAssignmentId) {
            await updateDoc(doc(assignmentsCollectionRef, ca.existingAssignmentId), { ...assignmentData, updatedAt: serverTimestamp() });
          } else {
            await addDoc(assignmentsCollectionRef, { ...assignmentData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
          }
          successCount++;
        } catch (e) { console.error(`Error saving common assignment for class ${ca.classInfo.id}: `, e); errorCount++; }
      }
    } else { 
      for (const ca of classAssignments) {
        if (!ca.date || !ca.time) continue; 

        const [hours, minutes] = ca.time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          toast({ title: "Invalid Time", description: `Invalid time for ${ca.classInfo.sectionName}. Please use HH:mm format.`, variant: "destructive" });
          errorCount++; continue;
        }
        const combinedDateTime = set(ca.date, { hours, minutes, seconds: 0, milliseconds: 0 });
        const assignedTimestamp = Timestamp.fromDate(combinedDateTime);

        let needsUpdate = true;
        if (ca.existingAssignmentId && ca.initialAssignedDateTime) {
          if (ca.initialAssignedDateTime.isEqual(assignedTimestamp)) {
            needsUpdate = false;
          }
        }
         if (!needsUpdate && ca.existingAssignmentId) {
           successCount++; continue;
        }
        changesMade = true;
        examActuallyPublished = true;
        const assignmentData: Omit<ExamAssignment, 'id' | 'createdAt'> = {
          examId: examDetails.id,
          classId: ca.classInfo.id,
          assignedDateTime: assignedTimestamp,
          status: 'Scheduled',
        };
        try {
          const assignmentsCollectionRef = collection(db, EXAMS_COLLECTION_NAME, examDetails.id, "assignments");
          if (ca.existingAssignmentId) {
            await updateDoc(doc(assignmentsCollectionRef, ca.existingAssignmentId), { ...assignmentData, updatedAt: serverTimestamp() });
          } else {
            await addDoc(assignmentsCollectionRef, { ...assignmentData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
          }
          successCount++;
        } catch (e) { console.error(`Error saving individual assignment for class ${ca.classInfo.id}: `, e); errorCount++; }
      }
    }

    if (examActuallyPublished && errorCount === 0) {
        try {
            const examDocRef = doc(db, EXAMS_COLLECTION_NAME, examDetails.id);
            await updateDoc(examDocRef, { status: "Published", updatedAt: serverTimestamp() });
        } catch (e) {
            console.error("Error updating exam status to Published: ", e);
            toast({ title: "Status Update Failed", description: "Could not update exam status to Published.", variant: "destructive" });
        }
    }


    setIsSaving(false);

    if (successCount > 0 && errorCount === 0) {
      if (changesMade) {
        toast({ title: "Assignments Saved", description: `Successfully saved ${successCount} class assignment(s). Exam status updated to Published.` });
      } else {
        toast({ title: "No Changes", description: "No changes detected in assignments." });
      }
      router.push('/exams');
    } else if (successCount > 0 && errorCount > 0) {
      toast({ title: "Partial Success", description: `Saved ${successCount} assignment(s), but ${errorCount} failed. Please review.`, variant: "default" });
    } else if (errorCount > 0) {
      toast({ title: "Saving Failed", description: `Could not save assignments for ${errorCount} class(es). Please try again.`, variant: "destructive" });
    } else if (successCount === 0 && errorCount === 0 && (assignmentMode === 'all' ? (commonDate && commonTime) : classAssignments.some(ca => ca.date && ca.time))) {
      if (changesMade) { 
        toast({ title: "Assignments Saved", description: "All assignments were up to date or successfully saved." });
      } else {
        toast({title: "No Changes", description: "No changes detected in assignments."});
      }
       router.push('/exams');
    }
  };

  const handleShareLink = () => {
    if (examDetails && typeof window !== 'undefined') {
        const link = `${window.location.origin}/take-exam/${examDetails.id}`;
        navigator.clipboard.writeText(link)
            .then(() => {
                toast({ title: "Link Copied", description: "Exam link copied to clipboard." });
            })
            .catch(err => {
                console.error("Failed to copy link: ", err);
                toast({ title: "Error", description: "Could not copy link to clipboard.", variant: "destructive" });
            });
    }
  };

  if (isLoading || authLoading) {
    return ( 
      <div className="space-y-6 p-4"> 
        <Skeleton className="h-10 w-1/3" /> 
        <Skeleton className="h-8 w-1/2" /> 
        <Card className="shadow-lg"> 
          <CardHeader><Skeleton className="h-7 w-3/4" /></CardHeader> 
          <CardContent className="space-y-4"> 
            <Skeleton className="h-10 w-full" /> 
            {[1, 2].map(i => ( 
              <div key={i} className="p-3 border rounded-md space-y-3"> 
                <Skeleton className="h-6 w-1/2" /> 
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"> 
                  <Skeleton className="h-10 w-full" /> 
                  <Skeleton className="h-10 w-full" /> 
                </div> 
              </div> 
            ))} 
          </CardContent> 
          <CardFooter><Skeleton className="h-10 w-32" /></CardFooter> 
        </Card> 
      </div> 
    );
  }
  if (error) {
    return ( 
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-4"> 
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" /> 
        <h2 className="text-xl font-semibold mb-2">Error Loading Page</h2> 
        <p className="text-muted-foreground mb-4">{error}</p> 
        <Button onClick={() => router.back()} size="sm"> 
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back 
        </Button> 
      </div> 
    );
  }
  if (!examDetails) {
    return ( 
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-4"> 
        <Info className="h-12 w-12 text-muted-foreground mb-4" /> 
        <p className="text-muted-foreground">Exam details could not be loaded.</p> 
        <Button onClick={() => router.back()} size="sm" className="mt-4"> 
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back 
        </Button> 
      </div> 
    );
  }

  return (
    <div className="space-y-6 p-1 sm:p-4">
      <div className="flex items-center justify-between">
        <div className="flex-grow">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
            Publish Exam: {examDetails.title}
          </h1>
          <CardDescription className="text-xs sm:text-sm mt-1">
            Assign a date and time for each class this exam is linked to, or set a common schedule.
          </CardDescription>
        </div>
         <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" onClick={handleShareLink} size="sm" className="text-xs sm:text-sm">
                <Link2 className="mr-2 h-4 w-4" /> Share Link
            </Button>
            <Button variant="outline" onClick={() => router.back()} size="sm" className="text-xs sm:text-sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Options
            </Button>
        </div>
      </div>

      {classAssignments.length === 0 && !isLoading && (
        <Card className="shadow-md">
            <CardContent className="p-6 text-center">
                <Info className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">This exam is not currently assigned to any classes.</p>
                <p className="text-xs text-muted-foreground mt-1">Please go to "Edit Exam" to assign classes first.</p>
            </CardContent>
        </Card>
      )}

      {classAssignments.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Set Assignment Schedule</CardTitle>
             <RadioGroup value={assignmentMode} onValueChange={(value) => handleAssignmentModeChange(value as AssignmentMode)} className="flex space-x-4 pt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="mode-individual" />
                <Label htmlFor="mode-individual" className="text-xs sm:text-sm">Individual Schedules</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="mode-all" />
                <Label htmlFor="mode-all" className="text-xs sm:text-sm">Same Schedule for All</Label>
              </div>
            </RadioGroup>
          </CardHeader>

          <CardContent className="space-y-4 sm:space-y-5">
            {assignmentMode === 'all' && (
              <div className="p-3 sm:p-4 border rounded-md shadow-sm bg-muted/30 space-y-3">
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">Common Schedule for All Classes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="commonExamDate" className="text-xs sm:text-sm">Exam Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn("w-full justify-start text-left font-normal h-9 text-xs sm:text-sm", !commonDate && "text-muted-foreground")}
                          disabled={isSaving}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {commonDate ? format(commonDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={commonDate} onSelect={setCommonDate} initialFocus disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1)) || isSaving} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="commonExamTime" className="text-xs sm:text-sm">Exam Time (HH:mm)</Label>
                    <Input id="commonExamTime" type="time" value={commonTime} onChange={(e) => setCommonTime(e.target.value)} className="h-9 text-xs sm:text-sm" disabled={isSaving} />
                  </div>
                </div>
                <p className="text-2xs sm:text-xs text-muted-foreground pt-2">This schedule will be applied to the following classes:</p>
                <ul className="list-disc list-inside text-2xs sm:text-xs text-muted-foreground">
                  {classAssignments.map(ca => <li key={ca.classInfo.id}>{ca.classInfo.sectionName} ({ca.classInfo.yearGrade}) - {ca.classInfo.subjectName}</li>)}
                </ul>
              </div>
            )}

            {assignmentMode === 'individual' && classAssignments.map((ca) => (
              <div key={ca.classInfo.id} className="p-3 sm:p-4 border rounded-md shadow-sm bg-muted/30">
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-0.5">
                  {ca.classInfo.sectionName} ({ca.classInfo.yearGrade})
                </h3>
                <p className="text-2xs sm:text-xs text-muted-foreground mb-2">
                  Subject: {ca.classInfo.subjectName} ({ca.classInfo.subjectCode}) - Class Code: {ca.classInfo.code}
                </p>
                {ca.assignmentStatus && ca.initialAssignedDateTime && (
                     <p className="text-2xs sm:text-xs text-primary mb-1.5">
                        Currently: {ca.assignmentStatus} on {format(ca.initialAssignedDateTime.toDate(), "PPP 'at' p")}
                     </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <Label htmlFor={`examDate-${ca.classInfo.id}`} className="text-xs sm:text-sm">Exam Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn("w-full justify-start text-left font-normal h-9 text-xs sm:text-sm", !ca.date && "text-muted-foreground")}
                          disabled={isSaving}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {ca.date ? format(ca.date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={ca.date} onSelect={(newDate) => handleIndividualDateChange(ca.classInfo.id, newDate)} initialFocus disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1)) || isSaving} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`examTime-${ca.classInfo.id}`} className="text-xs sm:text-sm">Exam Time (HH:mm)</Label>
                    <Input id={`examTime-${ca.classInfo.id}`} type="time" value={ca.time || ''} onChange={(e) => handleIndividualTimeChange(ca.classInfo.id, e.target.value)} className="h-9 text-xs sm:text-sm" disabled={isSaving} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveAssignments} disabled={isSaving || classAssignments.length === 0} size="sm" className="text-xs sm:text-sm">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Assignments</>}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
