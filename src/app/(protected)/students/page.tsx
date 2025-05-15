
// src/app/(protected)/students/page.tsx
'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, PlusCircle, Edit3, Trash2, List } from "lucide-react";
import { generateId } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ClassInfo {
  id: string;
  subjectName: string;
  sectionName: string;
  yearGrade: string;
  code: string;
}

// Placeholder subjects. Ideally, this would come from a shared state or database.
const placeholderSubjects = [
  { id: 'subj-math', name: 'Mathematics' },
  { id: 'subj-sci', name: 'Science' },
  { id: 'subj-eng', name: 'English' },
  { id: 'subj-hist', name: 'History' },
  { id: 'subj-cs', name: 'Computer Science' },
  { id: 'subj-art', name: 'Arts' },
  { id: 'subj-pe', name: 'Physical Education' },
];

export default function StudentsPage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [isAddClassDialogOpen, setIsAddClassDialogOpen] = useState(false);
  
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [newYearGrade, setNewYearGrade] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);

  const generateClassCode = (subject: string, section: string, year: string) => {
    const subjectPart = subject.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
    const sectionPart = section.replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase();
    const yearPart = year.replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${subjectPart}${sectionPart}${yearPart}-${randomPart}`;
  };

  // Effect to auto-generate class code when relevant fields change for a new class
  useEffect(() => {
    if (!editingClass) { // Only for new classes
      setNewClassCode(generateClassCode(newSubjectName, newSectionName, newYearGrade));
    }
  }, [newSubjectName, newSectionName, newYearGrade, editingClass]);


  const handleAddOrUpdateClass = (event: FormEvent) => {
    event.preventDefault();
    if (!newSubjectName.trim() || !newSectionName.trim() || !newYearGrade.trim() || !newClassCode.trim()) {
      // Basic validation, consider using a toast for user feedback
      alert("All fields (Subject, Section Name, Year/Grade, and Code) are required.");
      return;
    }

    if (editingClass) {
      setClasses(classes.map(c => c.id === editingClass.id ? { 
        ...c, 
        subjectName: newSubjectName, 
        sectionName: newSectionName,
        yearGrade: newYearGrade,
        code: newClassCode 
      } : c));
    } else {
      const newClass: ClassInfo = {
        id: generateId('class'),
        subjectName: newSubjectName,
        sectionName: newSectionName,
        yearGrade: newYearGrade,
        code: newClassCode,
      };
      setClasses([...classes, newClass]);
    }
    
    closeDialog();
  };

  const openEditDialog = (classInfo: ClassInfo) => {
    setEditingClass(classInfo);
    setNewSubjectName(classInfo.subjectName);
    setNewSectionName(classInfo.sectionName);
    setNewYearGrade(classInfo.yearGrade);
    setNewClassCode(classInfo.code);
    setIsAddClassDialogOpen(true);
  };

  const handleDeleteClass = (classId: string) => {
    // TODO: Add confirmation dialog before deleting
    setClasses(classes.filter(c => c.id !== classId));
  };
  
  const closeDialog = () => {
    setIsAddClassDialogOpen(false);
    setNewSubjectName('');
    setNewSectionName('');
    setNewYearGrade('');
    setNewClassCode('');
    setEditingClass(null);
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
              Manage your classes and student rosters here.
            </CardDescription>
          </div>
          <Dialog open={isAddClassDialogOpen} onOpenChange={(isOpen) => {
            if (!isOpen) closeDialog();
            else setIsAddClassDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs sm:text-sm w-full sm:w-auto">
                <PlusCircle className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Add New Class
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">{editingClass ? "Edit Class" : "Add New Class"}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {editingClass ? "Update the details for this class." : "Enter the details for your new class below."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddOrUpdateClass} className="grid gap-3 sm:gap-4 py-2 sm:py-4">
                <div className="grid grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="subjectName" className="text-right text-xs sm:text-sm col-span-1">
                    Subject
                  </Label>
                  <Select
                    value={newSubjectName}
                    onValueChange={(value) => setNewSubjectName(value)}
                    required
                  >
                    <SelectTrigger id="subjectName" className="col-span-3 h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {placeholderSubjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.name} className="text-xs sm:text-sm">
                          {subject.name}
                        </SelectItem>
                      ))}
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
                    disabled={!editingClass && (!newSubjectName || !newSectionName || !newYearGrade)} // Disable if auto-generating and fields are empty
                  />
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-2">
                  <DialogClose asChild>
                     <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" size="sm" className="text-xs sm:text-sm">{editingClass ? "Save Changes" : "Add Class"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <div className="text-center py-8 sm:py-10">
              <List className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-md sm:text-lg font-medium text-muted-foreground">
                No classes created yet.
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Click the &quot;Add New Class&quot; button to get started.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-300px)] sm:h-[calc(100vh-320px)] pr-3">
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {classes.map((cls) => (
                  <Card key={cls.id} className="shadow-md">
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="text-md sm:text-lg font-semibold">{cls.subjectName}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Section: {cls.sectionName} | Year/Grade: {cls.yearGrade}
                      </CardDescription>
                      <CardDescription className="text-xs sm:text-sm pt-1">
                        Code: <span className="font-mono text-primary">{cls.code}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-3 sm:pb-4">
                      <p className="text-xs sm:text-sm text-muted-foreground italic">Student management coming soon.</p>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 pt-0 pb-3 sm:pb-4">
                        <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => openEditDialog(cls)}>
                            <Edit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="sr-only">Edit Class</span>
                        </Button>
                        <Button variant="destructive" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => handleDeleteClass(cls.id)}>
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="sr-only">Delete Class</span>
                        </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
         {classes.length > 0 && (
            <CardFooter className="text-xs sm:text-sm text-muted-foreground pt-3 sm:pt-4 border-t">
                Showing {classes.length} class{classes.length === 1 ? '' : 'es'}.
            </CardFooter>
        )}
      </Card>
    </div>
  );
}

    