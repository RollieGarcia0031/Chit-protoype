
// src/app/(protected)/exams/[examId]/publish/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, getDocs, query, where, orderBy, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { ExamSummaryData, ClassInfoForDropdown, ExamAssignment } from '@/types/exam-types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CalendarIcon, Clock, Send, AlertTriangle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parse as parseDate, set } from 'date-fns';
import { cn } from '@/lib/utils';

export default function PublishExamPage() {
  const params = useParams();
  const examId = params.examId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [examDetails, setExamDetails] = useState<ExamSummaryData | null>(null);
  const [allUserClasses, setAllUserClasses] = useState<ClassInfoForDropdown[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [examDate, setExamDate] = useState<Date | undefined>(undefined);
  const [examTime, setExamTime] = useState<string>(''); // HH:mm format

  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Exam Details and User Classes
  useEffect(() => {
    if (!user || !examId || authLoading) {
      if (!authLoading && !user) router.push('/login');
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        // Fetch exam details
        const examDocRef = doc(db, EXAMS_COLLECTION_NAME, examId);
        const examSnap = await getDoc(examDocRef);
        if (!examSnap.exists() || examSnap.data()?.userId !== user.uid) {
          setError("Exam not found or you don't have permission.");
          toast({ title: "Error", description: "Exam not found or access denied.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        setExamDetails({ id: examSnap.id, ...examSnap.data() } as ExamSummaryData);

        // Fetch all user classes
        const fetchedClasses: ClassInfoForDropdown[] = [];
        const subjectsCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME);
        const subjectsQuery = query(subjectsCollectionRef, where("userId", "==", user.uid));
        const subjectsSnapshot = await getDocs(subjectsQuery);

        for (const subjectDoc of subjectsSnapshot.docs) {
          const subjectData = subjectDoc.data();
          const classesSubCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME, subjectDoc.id, "classes");
          const classesQuerySnapshot = await getDocs(query(classesSubCollectionRef, where("userId", "==", user.uid)));
          classesQuerySnapshot.forEach((classDoc) => {
            const classData = classDoc.data();
            fetchedClasses.push({
              id: classDoc.id, subjectId: subjectDoc.id, subjectName: subjectData.name,
              subjectCode: subjectData.code, sectionName: classData.sectionName,
              yearGrade: classData.yearGrade, code: classData.code,
            });
          });
        }
        setAllUserClasses(fetchedClasses);

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

  const handlePublishExam = async () => {
    if (!user || !examDetails || !selectedClassId || !examDate || !examTime) {
      toast({ title: "Missing Information", description: "Please select a class, date, and time.", variant: "destructive" });
      return;
    }

    setIsPublishing(true);
    try {
      const [hours, minutes] = examTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        toast({ title: "Invalid Time", description: "Please enter a valid time in HH:mm format.", variant: "destructive" });
        setIsPublishing(false);
        return;
      }

      const combinedDateTime = set(examDate, { hours, minutes, seconds: 0, milliseconds: 0 });
      const assignedDateTime = Timestamp.fromDate(combinedDateTime);

      const assignmentData: Omit<ExamAssignment, 'id'> = {
        examId: examDetails.id,
        classId: selectedClassId,
        assignedDateTime: assignedDateTime,
        status: 'Scheduled',
        // className and subjectName can be added here if needed, fetched from allUserClasses
      };
      
      const assignmentsCollectionRef = collection(db, EXAMS_COLLECTION_NAME, examDetails.id, "assignments");
      await addDoc(assignmentsCollectionRef, assignmentData);

      toast({ title: "Exam Published", description: `Successfully scheduled "${examDetails.title}" for the selected class.` });
      // Optionally, update the exam document's status to 'Published' if that's part of your model
      // const examDocRef = doc(db, EXAMS_COLLECTION_NAME, examDetails.id);
      // await updateDoc(examDocRef, { status: 'Published', updatedAt: serverTimestamp() });
      router.push('/exams'); // Navigate back to exams list or a confirmation page
    } catch (e) {
      console.error("Error publishing exam: ", e);
      toast({ title: "Publishing Failed", description: "Could not publish the exam. Please try again.", variant: "destructive" });
    } finally {
      setIsPublishing(false);
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
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
          <CardFooter><Skeleton className="h-10 w-24" /></CardFooter>
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

  const selectedClassDetails = allUserClasses.find(c => c.id === selectedClassId);

  return (
    <div className="space-y-6 p-1 sm:p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
          Publish Exam: {examDetails.title}
        </h1>
        <Button variant="outline" onClick={() => router.back()} size="sm" className="text-xs sm:text-sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Options
        </Button>
      </div>
      <CardDescription className="text-sm sm:text-base">
        Assign this exam to a class for a specific date and time.
      </CardDescription>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Assignment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="space-y-1">
            <Label htmlFor="assignClass" className="text-sm">Assign to Class</Label>
            <Select
              value={selectedClassId || ""}
              onValueChange={setSelectedClassId}
              disabled={isPublishing || allUserClasses.length === 0}
            >
              <SelectTrigger id="assignClass" className="h-9 text-xs sm:text-sm">
                <SelectValue placeholder={allUserClasses.length === 0 ? "No classes available" : "Select a class"} />
              </SelectTrigger>
              <SelectContent>
                {allUserClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id} className="text-xs sm:text-sm">
                    {cls.subjectName} - {cls.sectionName} ({cls.yearGrade}) - Code: {cls.code}
                  </SelectItem>
                ))}
                {allUserClasses.length === 0 && (
                  <SelectItem value="no-classes" disabled className="text-xs sm:text-sm">
                    No classes found. Create one in 'Students' tab.
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {selectedClassDetails && (
                <p className="text-xs text-muted-foreground mt-1">
                    Selected: {selectedClassDetails.subjectName} - {selectedClassDetails.sectionName} ({selectedClassDetails.yearGrade})
                </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="examDate" className="text-sm">Exam Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-9 text-xs sm:text-sm",
                      !examDate && "text-muted-foreground"
                    )}
                    disabled={isPublishing}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {examDate ? format(examDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={examDate}
                    onSelect={setExamDate}
                    initialFocus
                    disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1)) || isPublishing} // Disable past dates
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label htmlFor="examTime" className="text-sm">Exam Time (HH:mm)</Label>
              <Input
                id="examTime"
                type="time"
                value={examTime}
                onChange={(e) => setExamTime(e.target.value)}
                placeholder="HH:mm"
                className="h-9 text-xs sm:text-sm"
                disabled={isPublishing}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handlePublishExam} disabled={isPublishing || !selectedClassId || !examDate || !examTime} size="sm" className="text-xs sm:text-sm">
            {isPublishing ? (
              <><Send className="mr-2 h-4 w-4 animate-pulse" /> Publishing...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Publish Exam</>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
