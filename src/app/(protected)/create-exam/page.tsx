
// src/app/(protected)/create-exam/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { FormEvent } from "react";
import { ExamQuestionGroupBlock } from "@/components/exam/ExamQuestionGroupBlock";
import { TotalPointsDisplay } from "@/components/exam/TotalPointsDisplay";
import { PlusCircle, Loader2, Sparkles, AlertTriangle, Info, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateExamFormLogic } from '@/features/exam-creation/hooks/useCreateExamFormLogic'; // IMPORT THE HOOK

export default function CreateExamPage() {
  const { user } = useAuth();
  const {
    examTitle, setExamTitle,
    examDescription, setExamDescription,
    examBlocks,
    isInitialLoadComplete, // Used for initial loading state check
    isSaving,
    editingExamId,
    isLoadingExamData,
    aiSuggestionsEnabled, setAiSuggestionsEnabled,
    isAiDialogOpen, setIsAiDialogOpen,
    aiFeedbackList,
    isAnalyzingWithAI,
    aiError,
    userSubjectsForDropdown,
    isLoadingUserSubjectsForDropdown,
    selectedSubjectIdForFilter,
    assignedClassSlots,
    allUserClasses, // Not directly used in JSX but hook might need it
    isLoadingUserClasses,
    totalPoints,
    filteredClassesForDropdown,
    handleSubjectFilterChange,
    handleAddClassAssignmentSlot,
    handleRemoveClassAssignmentSlot,
    handleAssignedClassChange,
    performAIAnalysis,
    handleAddExamBlock,
    handleChangeBlockType,
    handleBlockTitleChange,
    handleUpdateBlock,
    handleAddQuestionToBlock,
    handleUpdateQuestionInBlock,
    handleRemoveQuestionFromBlock,
    resetForm,
    handleSubmit,
  } = useCreateExamFormLogic({ user });


  if (isLoadingExamData && editingExamId && (!isInitialLoadComplete || isLoadingUserClasses || isLoadingUserSubjectsForDropdown) && examBlocks.length === 0) {
    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <Skeleton className="h-9 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
             <Card className="shadow-lg">
                <CardHeader>
                    <Skeleton className="h-8 w-1/3 mb-2" />
                     <Skeleton className="h-5 w-full" />
                </CardHeader>
                <CardContent>
                   <Skeleton className="h-10 w-1/4 mb-4" />
                   <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
            <Card className="shadow-lg">
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
            <div className="flex justify-end pt-4">
                <Skeleton className="h-12 w-28" />
            </div>
        </div>
    );
  }

  const isClassAddButtonDisabled = !selectedSubjectIdForFilter ||
                                 isLoadingUserClasses ||
                                 (filteredClassesForDropdown.length === 0) ||
                                 (assignedClassSlots.filter(slot => slot.selectedClassId !== null).length >= filteredClassesForDropdown.length && filteredClassesForDropdown.length > 0);

  return (
    <div className="space-y-6">
      <TotalPointsDisplay totalPoints={totalPoints} />
      {aiSuggestionsEnabled && (
        <Button
          variant="outline"
          size="icon"
          className="fixed left-2 bottom-2 sm:left-4 sm:bottom-4 z-50 rounded-full h-12 w-12 sm:h-14 sm:w-14 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setIsAiDialogOpen(true)}
          aria-label="Open AI Suggestions"
          disabled={isAnalyzingWithAI}
        >
          {isAnalyzingWithAI ? <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" /> : <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />}
          {aiFeedbackList.length > 0 && !isAnalyzingWithAI && (
             aiFeedbackList.some(f => f.suggestionText !== "AI analysis requires more complete exam content (e.g., all questions filled, answers selected, options defined)." &&
                                     f.suggestionText !== "Add at least one question block to get AI suggestions." &&
                                     f.suggestionText !== "Some question blocks are empty. Add questions to all blocks for analysis." &&
                                     f.suggestionText !== "Some questions are missing text. Please fill them in." &&
                                     f.suggestionText !== "Multiple-choice questions need at least two options." &&
                                     f.suggestionText !== "Mark a correct answer for all multiple-choice questions." &&
                                     f.suggestionText !== "Fill in all option texts for multiple-choice questions." &&
                                     f.suggestionText !== "Select True or False for all true/false questions." &&
                                     f.suggestionText !== "Matching questions need at least one pair." &&
                                     f.suggestionText !== "Fill in all premise and response texts for matching pairs." &&
                                     f.suggestionText !== "Assign a letter ID to all answers in matching questions." &&
                                     f.suggestionText !== "Pooled-choices blocks need at least one option in their choice pool." &&
                                     f.suggestionText !== "Fill in all option texts for the choice pool." &&
                                     f.suggestionText !== "Select a correct answer from the pool for all pooled-choices questions." &&
                                     f.suggestionText !== "AI analysis failed to produce output. Please try again." &&
                                     f.suggestionText !== "Exam content is empty. Please add a title or some questions to analyze." &&
                                     f.suggestionText !== "All question blocks are empty. Add questions to get feedback."
                                    )
            ) && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {aiFeedbackList.filter(f => f.suggestionText !== "AI analysis requires more complete exam content (e.g., all questions filled, answers selected, options defined)." &&
                                            f.suggestionText !== "Add at least one question block to get AI suggestions." &&
                                            f.suggestionText !== "Some question blocks are empty. Add questions to all blocks for analysis." &&
                                            f.suggestionText !== "Some questions are missing text. Please fill them in." &&
                                            f.suggestionText !== "Multiple-choice questions need at least two options." &&
                                            f.suggestionText !== "Mark a correct answer for all multiple-choice questions." &&
                                            f.suggestionText !== "Fill in all option texts for multiple-choice questions." &&
                                            f.suggestionText !== "Select True or False for all true/false questions." &&
                                            f.suggestionText !== "Matching questions need at least one pair." &&
                                            f.suggestionText !== "Fill in all premise and response texts for matching pairs." &&
                                            f.suggestionText !== "Assign a letter ID to all answers in matching questions." &&
                                            f.suggestionText !== "Pooled-choices blocks need at least one option in their choice pool." &&
                                            f.suggestionText !== "Fill in all option texts for the choice pool." &&
                                            f.suggestionText !== "Select a correct answer from the pool for all pooled-choices questions." &&
                                            f.suggestionText !== "AI analysis failed to produce output. Please try again." &&
                                            f.suggestionText !== "Exam content is empty. Please add a title or some questions to analyze." &&
                                            f.suggestionText !== "All question blocks are empty. Add questions to get feedback."
                                        ).length}
            </Badge>
          )}
        </Button>
      )}

      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl flex items-center">
              <Sparkles className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              AI Exam Analysis & Suggestions
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Review AI-generated feedback to improve your exam. Analysis is based on current exam content.
              Content is analyzed approximately every 10 seconds if changes are made.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto space-y-3 pr-2">
            {isAnalyzingWithAI && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="mr-2 h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                <p className="text-muted-foreground text-sm sm:text-base">Analyzing exam content...</p>
              </div>
            )}
            {aiError && !isAnalyzingWithAI && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm sm:text-base">Analysis Error</AlertTitle>
                <AlertDescription className="text-xs sm:text-sm">{aiError}</AlertDescription>
              </Alert>
            )}
            {!isAnalyzingWithAI && !aiError && aiFeedbackList.length === 0 && (
              <div className="text-center py-10">
                <Info className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm sm:text-base">No AI suggestions available at the moment.</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Ensure AI suggestions are enabled and you have some exam content that is sufficiently complete.</p>
              </div>
            )}
            {!isAnalyzingWithAI && !aiError && aiFeedbackList.length > 0 && (
               <ul className="space-y-2">
                {aiFeedbackList.map((feedback, index) => (
                  <li key={index} className="text-xs sm:text-sm text-foreground p-2 sm:p-3 bg-muted/50 rounded-md shadow-sm">
                    <p className="font-medium">Suggestion:</p>
                    <ul className="list-disc pl-4 sm:pl-5 mt-1 text-muted-foreground">
                       {feedback.suggestionText.split('\\n').map((line, lineIndex) => {
                          const cleanLine = line.replace(/^-\s*/, '').trim();
                          return cleanLine ? <li key={lineIndex}>{cleanLine}</li> : null;
                       }).filter(Boolean)}
                    </ul>
                    {feedback.elementPath && (
                       <p className="text-2xs sm:text-xs text-primary/80 mt-1">Related to: <code>{feedback.elementPath}</code></p>
                    )}
                    {feedback.severity && (
                       <Badge variant={feedback.severity === 'error' ? 'destructive' : feedback.severity === 'warning' ? 'secondary' : 'outline'} className="mt-1.5 text-2xs sm:text-xs">
                         {feedback.severity.charAt(0).toUpperCase() + feedback.severity.slice(1)}
                       </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsAiDialogOpen(false)} size="sm">Close</Button>
            <Button onClick={performAIAnalysis} disabled={isAnalyzingWithAI || !aiSuggestionsEnabled} size="sm">
              {isAnalyzingWithAI && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Re-analyze Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
              {editingExamId ? "Edit Exam" : "Create New Exam"}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {editingExamId
                ? `Editing exam: "${examTitle || 'Loading...'}"`
                : "Fill in the details below to create a new exam. Your progress is saved locally for new exams."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="examTitle" className="text-sm sm:text-base">Exam Title</Label>
                <Input
                  id="examTitle"
                  placeholder="e.g., Midterm Mathematics"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  required
                  disabled={isSaving || isLoadingExamData}
                  className="text-sm sm:text-base"
                />
              </div>

              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="assignSubject" className="text-sm sm:text-base">Assign to Subject</Label>
                <Select
                  value={selectedSubjectIdForFilter || ""}
                  onValueChange={handleSubjectFilterChange}
                  disabled={isLoadingUserSubjectsForDropdown || isSaving || isLoadingExamData}
                  required
                >
                  <SelectTrigger id="assignSubject" className="flex-grow text-xs sm:text-sm h-9 sm:h-10">
                    <SelectValue placeholder={isLoadingUserSubjectsForDropdown ? "Loading subjects..." : "Select a subject"} />
                  </SelectTrigger>
                  <SelectContent>
                    {userSubjectsForDropdown.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id} className="text-xs sm:text-sm">
                        {subject.name} ({subject.code})
                      </SelectItem>
                    ))}
                    {!isLoadingUserSubjectsForDropdown && userSubjectsForDropdown.length === 0 && (
                      <SelectItem value="no-subjects" disabled className="text-xs sm:text-sm">
                        No subjects found. Create one in 'Subjects' tab.
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:space-y-3">
                 <Label className="text-sm sm:text-base">Assign to Classes</Label>
                 {assignedClassSlots.map((slot, index) => (
                    <div key={slot.key} className="flex items-center gap-2">
                        <Select
                            value={slot.selectedClassId || ""}
                            onValueChange={(value) => handleAssignedClassChange(slot.key, value)}
                            disabled={isLoadingUserClasses || isSaving || isLoadingExamData || !selectedSubjectIdForFilter || filteredClassesForDropdown.length === 0}
                        >
                            <SelectTrigger className="flex-grow text-xs sm:text-sm h-9 sm:h-10">
                            <SelectValue placeholder={
                                !selectedSubjectIdForFilter ? "Select a subject first" :
                                isLoadingUserClasses ? "Loading classes..." :
                                filteredClassesForDropdown.length === 0 ? "No classes for subject" :
                                "Select a class"
                            } />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none" className="text-xs sm:text-sm">-- Select a class --</SelectItem>
                                {filteredClassesForDropdown.map((cls) => (
                                    <SelectItem
                                        key={cls.id}
                                        value={cls.id}
                                        className="text-xs sm:text-sm"
                                        disabled={assignedClassSlots.some(s => s.selectedClassId === cls.id && s.key !== slot.key)}
                                    >
                                        {cls.sectionName} ({cls.yearGrade}) - Code: {cls.code}
                                        {assignedClassSlots.some(s => s.selectedClassId === cls.id && s.key !== slot.key) ? " (Assigned)" : ""}
                                    </SelectItem>
                                ))}
                                {selectedSubjectIdForFilter && !isLoadingUserClasses && filteredClassesForDropdown.length === 0 && (
                                    <SelectItem value="no-classes-for-subject" disabled className="text-xs sm:text-sm">
                                        No classes found for selected subject.
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        {assignedClassSlots.length > 1 && (
                             <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveClassAssignmentSlot(slot.key)}
                                disabled={isSaving || isLoadingExamData}
                                className="h-9 sm:h-10 w-9 sm:w-10 flex-shrink-0"
                                aria-label="Remove this class assignment"
                            >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        )}
                    </div>
                 ))}
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddClassAssignmentSlot}
                    disabled={isClassAddButtonDisabled || isSaving || isLoadingExamData}
                    className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
                >
                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> Add Another Class Assignment
                </Button>
                 {assignedClassSlots.length === 0 && selectedSubjectIdForFilter && !isLoadingUserClasses && filteredClassesForDropdown.length > 0 && (
                     <p className="text-xs text-muted-foreground">Click "Add Another Class Assignment" to assign this exam to a class.</p>
                 )}
                 {assignedClassSlots.length === 0 && (!selectedSubjectIdForFilter || (selectedSubjectIdForFilter && filteredClassesForDropdown.length === 0 && !isLoadingUserClasses)) && (
                     <p className="text-xs text-muted-foreground">
                         { !selectedSubjectIdForFilter ? "Select a subject above to see available classes." : "No classes available for the selected subject."}
                     </p>
                 )}
              </div>

              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="examDescription" className="text-sm sm:text-base">Description (Optional)</Label>
                <Textarea
                  id="examDescription"
                  placeholder="A brief description of the exam content or instructions."
                  className="min-h-[80px] sm:min-h-[100px] text-sm sm:text-base"
                  value={examDescription}
                  onChange={(e) => setExamDescription(e.target.value)}
                  disabled={isSaving || isLoadingExamData}
                />
              </div>

              <div className="flex items-center space-x-2 pt-1 sm:pt-2">
                <Switch
                    id="ai-suggestions-toggle"
                    checked={aiSuggestionsEnabled}
                    onCheckedChange={(checked) => {
                        setAiSuggestionsEnabled(checked);
                        if (checked) {
                            if (isInitialLoadComplete && !isLoadingExamData && !isSaving && !isAnalyzingWithAI) {
                                performAIAnalysis();
                            }
                        } else {
                            setAiFeedbackList([]);
                            setAiError(null);
                        }
                    }}
                    disabled={isSaving || isLoadingExamData}
                />
                <Label htmlFor="ai-suggestions-toggle" className="text-xs sm:text-sm">
                    Enable AI Suggestions
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl md:text-2xl font-semibold">Question Blocks</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Add blocks of questions. Each block contains questions of the same type. New blocks inherit the type of the previous block. New questions inherit points and (for MCQs) option count from the previous question in the block.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            {examBlocks.map((block, blockIndex) => {
              return (
                <ExamQuestionGroupBlock
                  key={block.id}
                  block={block}
                  blockIndex={blockIndex}
                  onBlockTypeChange={handleChangeBlockType}
                  onBlockTitleChange={handleBlockTitleChange}
                  onAddQuestionToBlock={handleAddQuestionToBlock}
                  onUpdateQuestionInBlock={handleUpdateQuestionInBlock}
                  onRemoveQuestionFromBlock={handleRemoveQuestionFromBlock}
                  onRemoveBlock={handleRemoveExamBlock}
                  onUpdateBlock={handleUpdateBlock}
                  disabled={isSaving || isLoadingExamData}
                />
              );
            })}
            <Button type="button" variant="outline" onClick={handleAddExamBlock} className="w-full text-xs sm:text-sm" size="sm" disabled={isSaving || isLoadingExamData}>
              <PlusCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Add Block
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-2">
           <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving || isLoadingExamData} className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
            {editingExamId ? "Cancel Edit" : "Clear Form & Reset Draft"}
          </Button>
          <Button
            type="submit"
            size="sm"
            className="w-full sm:w-auto text-xs sm:text-sm sm:size-lg"
            disabled={
                isSaving ||
                isLoadingExamData ||
                !examTitle.trim() ||
                !selectedSubjectIdForFilter ||
                assignedClassSlots.filter(slot => slot.selectedClassId !== null).length === 0 ||
                examBlocks.length === 0 ||
                examBlocks.some(b => b.questions.length === 0)
            }
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : (editingExamId ? 'Update Exam' : 'Save Exam')}
          </Button>
        </div>
      </form>
    </div>
  );
}
