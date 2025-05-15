
// src/app/(protected)/subjects/page.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, PlusCircle, Edit3, Trash2, List } from "lucide-react";
import { generateId } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SubjectInfo {
  id: string;
  name: string;
  code: string; // Added subject code
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [isAddSubjectDialogOpen, setIsAddSubjectDialogOpen] = useState(false);
  
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState(''); // State for subject code
  
  const [editingSubject, setEditingSubject] = useState<SubjectInfo | null>(null);

  const handleAddOrUpdateSubject = (event: FormEvent) => {
    event.preventDefault();
    if (!newSubjectName.trim() || !newSubjectCode.trim()) {
      alert("Subject Name and Subject Code are required.");
      return;
    }

    if (editingSubject) {
      setSubjects(subjects.map(s => s.id === editingSubject.id ? { 
        ...s, 
        name: newSubjectName,
        code: newSubjectCode.toUpperCase(), // Store code in uppercase
      } : s));
    } else {
      const newSubject: SubjectInfo = {
        id: generateId('subject'),
        name: newSubjectName,
        code: newSubjectCode.toUpperCase(), // Store code in uppercase
      };
      setSubjects([...subjects, newSubject]);
    }
    
    closeDialog();
  };

  const openEditDialog = (subjectInfo: SubjectInfo) => {
    setEditingSubject(subjectInfo);
    setNewSubjectName(subjectInfo.name);
    setNewSubjectCode(subjectInfo.code);
    setIsAddSubjectDialogOpen(true);
  };

  const handleDeleteSubject = (subjectId: string) => {
    setSubjects(subjects.filter(s => s.id !== subjectId));
  };
  
  const closeDialog = () => {
    setIsAddSubjectDialogOpen(false);
    setNewSubjectName('');
    setNewSubjectCode(''); // Reset subject code state
    setEditingSubject(null);
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
              <Button size="sm" className="text-xs sm:text-sm w-full sm:w-auto">
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
                    maxLength={10} // Optional: limit code length
                    required
                  />
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-2">
                  <DialogClose asChild>
                     <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" size="sm" className="text-xs sm:text-sm">{editingSubject ? "Save Changes" : "Add Subject"}</Button>
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
                        <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => openEditDialog(sub)}>
                            <Edit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="sr-only">Edit Subject</span>
                        </Button>
                        <Button variant="destructive" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => handleDeleteSubject(sub.id)}>
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="sr-only">Delete Subject</span>
                        </Button>
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

