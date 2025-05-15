
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
import { useState, type FormEvent, useEffect, useCallback, useMemo } from "react";
import type { ExamBlock, ExamQuestion, QuestionType, Option, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion, MatchingPair, PooledChoicesQuestion, PoolOption, ClassInfoForDropdown, FetchedSubjectInfo } from "@/types/exam-types";
import { generateId, debounce } from "@/lib/utils";
import { ExamQuestionGroupBlock } from "@/components/exam/ExamQuestionGroupBlock";
import { TotalPointsDisplay } from "@/components/exam/TotalPointsDisplay";
import { PlusCircle, Loader2, Sparkles, AlertTriangle, Info, Trash2, XIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from '@/lib/firebase/config';
import { collection, doc, writeBatch, serverTimestamp, getDoc, getDocs, query, orderBy, where } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from "@/config/firebase-constants";
import { analyzeExamFlow, type AnalyzeExamInput, type AnalyzeExamOutput } from "@/ai/flows/analyze-exam-flow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const LOCAL_STORAGE_KEY = 'pendingExamData';

type AISuggestion = AnalyzeExamOutput['suggestions'][0];

const createDefaultQuestion = (type: QuestionType, idPrefix: string = 'question'): ExamQuestion => {
  const baseQuestionProps = {
    id: generateId(idPrefix),
    questionText: "",
    points: 1,
  };

  switch (type) {
    case 'multiple-choice':
      return {
        ...baseQuestionProps,
        type: 'multiple-choice',
        options: [
          { id: generateId('option'), text: "", isCorrect: true },
          { id: generateId('option'), text: "", isCorrect: false },
        ],
      };
    case 'true-false':
      return {
        ...baseQuestionProps,
        type: 'true-false',
        correctAnswer: null,
      };
    case 'matching':
      return {
        ...baseQuestionProps,
        type: 'matching',
        pairs: [{ id: generateId('pair'), premise: "", response: "", responseLetter: "" }],
      };
    case 'pooled-choices':
      return {
        ...baseQuestionProps,
        type: 'pooled-choices',
        correctAnswersFromPool: [],
      };
    default:
      console.warn(`createDefaultQuestion received an unknown type: ${type}. Defaulting to multiple-choice.`);
      return {
        ...baseQuestionProps,
        type: 'multiple-choice',
        options: [
            { id: generateId('option'), text: "", isCorrect: true },
            { id: generateId('option'), text: "", isCorrect: false },
        ],
      };
  }
};

export default function CreateExamPage() {
  const [examTitle, setExamTitle] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [examBlocks, setExamBlocks] = useState<ExamBlock[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [isLoadingExamData, setIsLoadingExamData] = useState(false);

  // AI Feature States
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiFeedbackList, setAiFeedbackList] = useState<AISuggestion[]>([]);
  const [isAnalyzingWithAI, setIsAnalyzingWithAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Class and Subject association state
  const [userSubjectsForDropdown, setUserSubjectsForDropdown] = useState<FetchedSubjectInfo[]>([]);
  const [isLoadingUserSubjectsForDropdown, setIsLoadingUserSubjectsForDropdown] = useState(true);
  const [selectedSubjectIdForFilter, setSelectedSubjectIdForFilter] = useState<string | null>(null);
  
  const [currentClassSelectionInDropdown, setCurrentClassSelectionInDropdown] = useState<string | null>(null);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [allUserClasses, setAllUserClasses] = useState<ClassInfoForDropdown[]>([]);
  const [isLoadingUserClasses, setIsLoadingUserClasses] = useState(true);


  const totalPoints = useMemo(() => {
    return examBlocks.reduce((acc, block) => {
      return acc + block.questions.reduce((qAcc, q) => qAcc + q.points, 0);
    }, 0);
  }, [examBlocks]);

  // Fetch user's subjects for the "Select Subject" dropdown
  useEffect(() => {
    const fetchSubjectsForDropdown = async () => {
      if (!user) {
        setUserSubjectsForDropdown([]);
        setIsLoadingUserSubjectsForDropdown(false);
        return;
      }
      setIsLoadingUserSubjectsForDropdown(true);
      try {
        const subjectsCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME);
        const q = query(subjectsCollectionRef, where("userId", "==", user.uid), orderBy("name", "asc"));
        const querySnapshot = await getDocs(q);
        const fetchedSubjects: FetchedSubjectInfo[] = [];
        querySnapshot.forEach((doc) => {
          fetchedSubjects.push({ id: doc.id, ...doc.data() } as FetchedSubjectInfo);
        });
        setUserSubjectsForDropdown(fetchedSubjects);
      } catch (error) {
        console.error("Error fetching subjects for dropdown:", error);
        toast({ title: "Error", description: "Could not fetch your subjects.", variant: "destructive" });
      } finally {
        setIsLoadingUserSubjectsForDropdown(false);
      }
    };
    if (user) fetchSubjectsForDropdown();
  }, [user, toast]);

  // Fetch all user's classes for the "Select Class" dropdown source
  useEffect(() => {
    const fetchAllUserClasses = async () => {
      if (!user) {
        setAllUserClasses([]);
        setIsLoadingUserClasses(false);
        return;
      }
      setIsLoadingUserClasses(true);
      const fetchedClasses: ClassInfoForDropdown[] = [];
      try {
        const subjectsCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME);
        const subjectsQuery = query(subjectsCollectionRef, where("userId", "==", user.uid));
        const subjectsSnapshot = await getDocs(subjectsQuery);

        for (const subjectDoc of subjectsSnapshot.docs) {
          const subjectData = subjectDoc.data();
          const classesSubCollectionRef = collection(db, SUBJECTS_COLLECTION_NAME, subjectDoc.id, "classes");
          const classesQuery = query(classesSubCollectionRef, where("userId", "==", user.uid), orderBy("sectionName", "asc"));
          const classesSnapshot = await getDocs(classesQuery);
          
          classesSnapshot.forEach((classDoc) => {
            const classData = classDoc.data();
            fetchedClasses.push({
              id: classDoc.id,
              subjectId: subjectDoc.id,
              subjectName: subjectData.name,
              subjectCode: subjectData.code,
              sectionName: classData.sectionName,
              yearGrade: classData.yearGrade,
              code: classData.code,
            });
          });
        }
        setAllUserClasses(fetchedClasses);
      } catch (error) {
        console.error("Error fetching all user classes:", error);
        toast({ title: "Error", description: "Could not fetch your classes list.", variant: "destructive" });
      } finally {
        setIsLoadingUserClasses(false);
      }
    };

    if (user) {
      fetchAllUserClasses();
    }
  }, [user, toast]);

  const filteredClassesForDropdown = useMemo(() => {
    if (!selectedSubjectIdForFilter) {
      return [];
    }
    return allUserClasses.filter(cls => cls.subjectId === selectedSubjectIdForFilter);
  }, [selectedSubjectIdForFilter, allUserClasses]);

  const handleSubjectFilterChange = (subjectIdValue: string) => {
    const newSubjectId = subjectIdValue === "none" ? null : subjectIdValue;
    setSelectedSubjectIdForFilter(newSubjectId);
    setCurrentClassSelectionInDropdown(null); // Reset current class selection
    setAssignedClassIds([]); // Also reset assigned classes when subject changes, or decide if they should persist
  };
  
  const handleAddClassToExam = () => {
    if (currentClassSelectionInDropdown && !assignedClassIds.includes(currentClassSelectionInDropdown)) {
      setAssignedClassIds([...assignedClassIds, currentClassSelectionInDropdown]);
    }
    setCurrentClassSelectionInDropdown(null); // Clear dropdown selection
  };

  const handleRemoveClassFromExam = (classIdToRemove: string) => {
    setAssignedClassIds(assignedClassIds.filter(id => id !== classIdToRemove));
  };


  const performAIAnalysis = useCallback(async () => {
    if (!aiSuggestionsEnabled || !user || isSaving || isLoadingExamData) {
      setAiFeedbackList([]); 
      return;
    }

    let isContentSufficientForAnalysis = true;
    let missingInfoMessage = "";

    if (examBlocks.length === 0) {
        isContentSufficientForAnalysis = false;
        missingInfoMessage = "Add at least one question block to get AI suggestions.";
    } else {
        for (const block of examBlocks) {
            if (block.questions.length === 0) {
                isContentSufficientForAnalysis = false;
                missingInfoMessage = "Some question blocks are empty. Add questions to all blocks for analysis.";
                break;
            }
            for (const q of block.questions) {
                if (!q.questionText.trim()) {
                    isContentSufficientForAnalysis = false;
                    missingInfoMessage = "Some questions are missing text. Please fill them in.";
                    break;
                }
                if (q.type === 'multiple-choice') {
                    const mcq = q as MultipleChoiceQuestion;
                    if (!mcq.options || mcq.options.length < 2) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Multiple-choice questions need at least two options.";
                        break;
                    }
                    if (!mcq.options.some(opt => opt.isCorrect)) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Mark a correct answer for all multiple-choice questions.";
                        break;
                    }
                    if (mcq.options.some(opt => !opt.text.trim())) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Fill in all option texts for multiple-choice questions.";
                        break;
                    }
                } else if (q.type === 'true-false') {
                    if ((q as TrueFalseQuestion).correctAnswer === null) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Select True or False for all true/false questions.";
                        break;
                    }
                } else if (q.type === 'matching') {
                    const matq = q as MatchingTypeQuestion;
                    if (!matq.pairs || matq.pairs.length < 1) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Matching questions need at least one pair.";
                        break;
                    }
                    if (matq.pairs.some(p => !p.premise.trim() || !p.response.trim())) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Fill in all premise and response texts for matching pairs.";
                        break;
                    }
                     if (matq.pairs.some(p => !p.responseLetter)) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Assign a letter ID to all answers in matching questions.";
                        break;
                    }
                } else if (q.type === 'pooled-choices') {
                    if (!block.choicePool || block.choicePool.length < 1) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Pooled-choices blocks need at least one option in their choice pool.";
                        break;
                    }
                    if (block.choicePool.some(pOpt => !pOpt.text.trim())) {
                         isContentSufficientForAnalysis = false;
                         missingInfoMessage = "Fill in all option texts for the choice pool.";
                         break;
                    }
                    if ((q as PooledChoicesQuestion).correctAnswersFromPool.length === 0) {
                        isContentSufficientForAnalysis = false;
                        missingInfoMessage = "Select a correct answer from the pool for all pooled-choices questions.";
                        break;
                    }
                }
            }
            if (!isContentSufficientForAnalysis) break;
        }
    }
    
    if (!isContentSufficientForAnalysis) {
        setAiFeedbackList([{ 
            suggestionText: missingInfoMessage || "AI analysis requires more complete exam content (e.g., all questions filled, answers selected, options defined).", 
            severity: "info" 
        }]);
        setIsAnalyzingWithAI(false); 
        setAiError(null);
        return;
    }

    setIsAnalyzingWithAI(true);
    setAiError(null);

    const examDataForAI: AnalyzeExamInput = {
      examTitle,
      examDescription,
      examBlocks: examBlocks.map(block => ({
        id: block.id,
        blockType: block.blockType,
        blockTitle: block.blockTitle,
        choicePool: block.blockType === 'pooled-choices' ? block.choicePool : undefined,
        questions: block.questions.map(q => {
          const questionPayload: any = {
            id: q.id,
            questionText: q.questionText,
            points: q.points,
            type: q.type,
          };
          if (q.type === 'multiple-choice') {
            questionPayload.options = (q as MultipleChoiceQuestion).options;
          } else if (q.type === 'true-false') {
            questionPayload.correctAnswer = (q as TrueFalseQuestion).correctAnswer;
          } else if (q.type === 'matching') {
            questionPayload.pairs = (q as MatchingTypeQuestion).pairs;
          } else if (q.type === 'pooled-choices') {
            questionPayload.correctAnswersFromPool = (q as PooledChoicesQuestion).correctAnswersFromPool;
          }
          return questionPayload;
        })
      })),
    };

    try {
      const result = await analyzeExamFlow(examDataForAI);
      setAiFeedbackList(result.suggestions || []);
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAiError("Failed to get AI suggestions. Please try again.");
      setAiFeedbackList([]);
    } finally {
      setIsAnalyzingWithAI(false);
    }
  }, [aiSuggestionsEnabled, examTitle, examDescription, examBlocks, user, isSaving, isLoadingExamData]);

  const debouncedAIAnalysis = useMemo(() => debounce(performAIAnalysis, 10000), [performAIAnalysis]);

  useEffect(() => {
    if (aiSuggestionsEnabled && isInitialLoadComplete && !isLoadingExamData && !isSaving) {
      debouncedAIAnalysis();
    }
  }, [aiSuggestionsEnabled, examTitle, examDescription, examBlocks, assignedClassIds, isInitialLoadComplete, isLoadingExamData, isSaving, debouncedAIAnalysis]);


  useEffect(() => {
    const examIdFromUrl = searchParams.get('examId');

    if (examIdFromUrl) {
      setEditingExamId(examIdFromUrl);
      setIsLoadingExamData(true); 
    } else {
      if (typeof window !== 'undefined' && !isInitialLoadComplete) {
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedData) {
          try {
            const parsedData = JSON.parse(savedData);
            if (parsedData.title) setExamTitle(parsedData.title);
            if (parsedData.description) setExamDescription(parsedData.description);
            if (parsedData.selectedSubjectIdForFilter) setSelectedSubjectIdForFilter(parsedData.selectedSubjectIdForFilter);
            if (parsedData.assignedClassIds && Array.isArray(parsedData.assignedClassIds)) setAssignedClassIds(parsedData.assignedClassIds);
            if (parsedData.currentClassSelectionInDropdown) setCurrentClassSelectionInDropdown(parsedData.currentClassSelectionInDropdown);

            if (parsedData.blocks && Array.isArray(parsedData.blocks)) {
              const validatedBlocks = parsedData.blocks.map((block: ExamBlock) => ({
                ...block,
                id: block.id || generateId('block'),
                ...(block.blockType === 'pooled-choices' && {
                    choicePool: (block.choicePool || []).map((pOpt: PoolOption) => ({
                        ...pOpt,
                        id: pOpt.id || generateId('pool-opt'),
                    }))
                }),
                questions: block.questions.map((q: ExamQuestion) => ({
                  ...q,
                  id: q.id || generateId('question'),
                  ...(q.type === 'multiple-choice' && {
                    options: (q as MultipleChoiceQuestion).options?.map((opt: Option) => ({
                      ...opt,
                      id: opt.id || generateId('option'),
                    })) || [],
                  }),
                  ...(q.type === 'matching' && {
                    pairs: (q as MatchingTypeQuestion).pairs?.map((p: MatchingPair) => ({
                      ...p,
                      id: p.id || generateId('pair'),
                      responseLetter: p.responseLetter || "",
                    })) || [],
                  }),
                  ...(q.type === 'pooled-choices' && {
                    correctAnswersFromPool: (q as PooledChoicesQuestion).correctAnswersFromPool || [],
                  }),
                })),
              }));
              setExamBlocks(validatedBlocks);
            }
          } catch (error) {
            console.error("Error parsing exam data from localStorage:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        }
      }
      setIsLoadingExamData(false); 
    }
     if (!isInitialLoadComplete) {
        setIsInitialLoadComplete(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); 


  useEffect(() => {
    if (!editingExamId || !user || !isInitialLoadComplete || !isLoadingExamData || isLoadingUserClasses || isLoadingUserSubjectsForDropdown) { 
      if (editingExamId && !isLoadingExamData && isInitialLoadComplete && examBlocks.length === 0 && examTitle === "") {
          // This case might mean fetch failed or exam was empty
      }
      return;
    }
    
    const fetchExamForEditing = async () => {
      setExamTitle("");
      setExamDescription("");
      setSelectedSubjectIdForFilter(null);
      setAssignedClassIds([]);
      setCurrentClassSelectionInDropdown(null);
      setExamBlocks([]);
      setAiFeedbackList([]);
      
      try {
        const examDocRef = doc(db, EXAMS_COLLECTION_NAME, editingExamId);
        const examSnap = await getDoc(examDocRef);

        if (!examSnap.exists() || examSnap.data().userId !== user.uid) {
          toast({ title: "Error", description: "Exam not found or you don't have permission to edit it.", variant: "destructive" });
          router.push('/exams');
          return;
        }

        const examData = examSnap.data();
        setExamTitle(examData.title);
        setExamDescription(examData.description || "");

        if (examData.classIds && Array.isArray(examData.classIds) && examData.classIds.length > 0 && allUserClasses.length > 0) {
            setAssignedClassIds(examData.classIds);
            // Try to set the subject filter based on the first assigned class
            const firstClassId = examData.classIds[0];
            const associatedClass = allUserClasses.find(c => c.id === firstClassId);
            if (associatedClass) {
                setSelectedSubjectIdForFilter(associatedClass.subjectId);
            } else {
                 setSelectedSubjectIdForFilter(null); // Class not found, reset subject
            }
        } else {
            setSelectedSubjectIdForFilter(null);
            setAssignedClassIds([]);
        }


        const loadedBlocks: ExamBlock[] = [];
        const blocksCollectionRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks");
        const blocksQuery = query(blocksCollectionRef, orderBy("orderIndex"));
        const blocksSnapshot = await getDocs(blocksQuery);

        for (const blockDoc of blocksSnapshot.docs) {
          const blockData = blockDoc.data();
          const loadedQuestions: ExamQuestion[] = [];
          const questionsCollectionRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks", blockDoc.id, "questions");
          const questionsQuery = query(questionsCollectionRef, orderBy("orderIndex"));
          const questionsSnapshot = await getDocs(questionsQuery);

          questionsSnapshot.forEach(questionDocSnap => {
            const qData = questionDocSnap.data();
            let question: ExamQuestion;
            switch (qData.type as QuestionType) {
              case 'multiple-choice':
                question = {
                  id: questionDocSnap.id,
                  questionText: qData.questionText,
                  points: qData.points,
                  type: 'multiple-choice',
                  options: (qData.options || []).map((opt: any) => ({ ...opt, id: opt.id || generateId('option')})),
                } as MultipleChoiceQuestion;
                break;
              case 'true-false':
                question = {
                  id: questionDocSnap.id,
                  questionText: qData.questionText,
                  points: qData.points,
                  type: 'true-false',
                  correctAnswer: qData.correctAnswer === undefined ? null : qData.correctAnswer,
                } as TrueFalseQuestion;
                break;
              case 'matching':
                question = {
                  id: questionDocSnap.id,
                  questionText: qData.questionText,
                  points: qData.points,
                  type: 'matching',
                  pairs: (qData.pairs || []).map((p: any) => ({ ...p, id: p.id || generateId('pair'), responseLetter: p.responseLetter || "" })),
                } as MatchingTypeQuestion;
                break;
              case 'pooled-choices':
                question = {
                  id: questionDocSnap.id,
                  questionText: qData.questionText,
                  points: qData.points,
                  type: 'pooled-choices',
                  correctAnswersFromPool: qData.correctAnswersFromPool || [],
                } as PooledChoicesQuestion;
                break;
              default:
                console.warn("Unknown question type from Firestore:", qData.type);
                question = createDefaultQuestion('multiple-choice', questionDocSnap.id) as MultipleChoiceQuestion;
            }
            loadedQuestions.push(question);
          });

          loadedBlocks.push({
            id: blockDoc.id, 
            blockType: blockData.blockType,
            blockTitle: blockData.blockTitle || "",
            questions: loadedQuestions,
            choicePool: blockData.blockType === 'pooled-choices' ? (blockData.choicePool || []).map((pOpt: PoolOption) => ({...pOpt, id: pOpt.id || generateId('pool-opt-load')})) : undefined,
          });
        }
        setExamBlocks(loadedBlocks);
        localStorage.removeItem(LOCAL_STORAGE_KEY); 
        toast({ title: "Exam Loaded", description: `Editing "${examData.title}". Your changes will be saved to the database.` });

      } catch (error) {
        console.error("Error fetching exam for editing:", error);
        toast({ title: "Error Loading Exam", description: "Could not load the exam data for editing.", variant: "destructive" });
        router.push('/exams');
      } finally {
        setIsLoadingExamData(false); 
      }
    };

    if (isLoadingExamData && !isLoadingUserClasses && !isLoadingUserSubjectsForDropdown) { 
        fetchExamForEditing();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExamId, user, router, toast, isInitialLoadComplete, isLoadingExamData, allUserClasses, userSubjectsForDropdown]); 


  useEffect(() => {
    if (editingExamId || !isInitialLoadComplete || typeof window === 'undefined' || isLoadingExamData) return;

    const examDataToSave = {
      title: examTitle,
      description: examDescription,
      selectedSubjectIdForFilter,
      assignedClassIds,
      currentClassSelectionInDropdown,
      blocks: examBlocks,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(examDataToSave));
  }, [examTitle, examDescription, selectedSubjectIdForFilter, assignedClassIds, currentClassSelectionInDropdown, examBlocks, editingExamId, isInitialLoadComplete, isLoadingExamData]);


  const handleAddExamBlock = () => {
    let newBlockType: QuestionType = 'multiple-choice';
    if (examBlocks.length > 0) {
      newBlockType = examBlocks[examBlocks.length - 1].blockType;
    }
    const initialQuestion = createDefaultQuestion(newBlockType);
    const newBlock: ExamBlock = {
      id: generateId('block'),
      blockType: newBlockType,
      questions: [initialQuestion],
      blockTitle: "",
      ...(newBlockType === 'pooled-choices' && { choicePool: [{id: generateId('pool-opt'), text: ""}, {id: generateId('pool-opt'), text: ""}] }),
    };
    setExamBlocks([...examBlocks, newBlock]);
  };

  const handleRemoveExamBlock = (blockIndex: number) => {
    setExamBlocks(examBlocks.filter((_, i) => i !== blockIndex));
  };

  const handleChangeBlockType = (blockIndex: number, newType: QuestionType) => {
    const newBlocks = [...examBlocks];
    const currentBlock = newBlocks[blockIndex];
    const initialQuestion = createDefaultQuestion(newType);

    newBlocks[blockIndex] = {
      ...currentBlock,
      blockType: newType,
      questions: [initialQuestion],
      choicePool: newType === 'pooled-choices' ? (currentBlock.choicePool && currentBlock.blockType === newType ? currentBlock.choicePool : [{id: generateId('pool-opt'), text: ""}, {id: generateId('pool-opt'), text: ""}]) : undefined,
    };
    setExamBlocks(newBlocks);
    toast({ title: "Block Type Changed", description: `Questions in block ${blockIndex + 1} reset for new type.`});
  };

  const handleBlockTitleChange = (blockIndex: number, title: string) => {
    const newBlocks = [...examBlocks];
    newBlocks[blockIndex].blockTitle = title;
    setExamBlocks(newBlocks);
  };

  const handleUpdateBlock = (blockIndex: number, updatedBlock: ExamBlock) => {
    const newBlocks = [...examBlocks];
    newBlocks[blockIndex] = updatedBlock;
    setExamBlocks(newBlocks);
  };

  const handleAddQuestionToBlock = (blockIndex: number) => {
    const newBlocks = [...examBlocks];
    const block = newBlocks[blockIndex];
    const lastQuestion = block.questions[block.questions.length - 1];
    const inheritedPoints = lastQuestion.points;
    let newOptionsForMC: Option[] = [
      { id: generateId('option'), text: "", isCorrect: true },
      { id: generateId('option'), text: "", isCorrect: false },
    ];

    if (block.blockType === 'multiple-choice' && lastQuestion.type === 'multiple-choice') {
      const numOptions = (lastQuestion as MultipleChoiceQuestion).options?.length > 0 ? (lastQuestion as MultipleChoiceQuestion).options.length : 2;
      newOptionsForMC = Array.from({ length: numOptions }, (_, i) => ({
        id: generateId('option'),
        text: "",
        isCorrect: i === 0 && numOptions > 0, 
      }));
    }

    const baseNewQuestionProps = { id: generateId('question'), questionText: "", points: inheritedPoints };
    let newQuestion: ExamQuestion;

    switch (block.blockType) {
      case 'multiple-choice':
        newQuestion = { ...baseNewQuestionProps, type: 'multiple-choice', options: newOptionsForMC };
        break;
      case 'true-false':
        newQuestion = { ...baseNewQuestionProps, type: 'true-false', correctAnswer: null };
        break;
      case 'matching':
        newQuestion = { ...baseNewQuestionProps, type: 'matching', pairs: [{ id: generateId('pair'), premise: "", response: "", responseLetter: "" }] };
        break;
      case 'pooled-choices':
        newQuestion = { ...baseNewQuestionProps, type: 'pooled-choices', correctAnswersFromPool: [] };
        break;
      default: 
        newQuestion = { ...baseNewQuestionProps, type: 'multiple-choice', options: newOptionsForMC };
        break;
    }
    block.questions.push(newQuestion);
    setExamBlocks(newBlocks);
  };

  const handleUpdateQuestionInBlock = (blockIndex: number, questionIndex: number, updatedQuestion: ExamQuestion) => {
    const newBlocks = [...examBlocks];
    newBlocks[blockIndex].questions[questionIndex] = updatedQuestion;
    setExamBlocks(newBlocks);
  };

  const handleRemoveQuestionFromBlock = (blockIndex: number, questionIndex: number) => {
    const newBlocks = [...examBlocks];
    if (newBlocks[blockIndex].questions.length > 1) {
      newBlocks[blockIndex].questions.splice(questionIndex, 1);
      setExamBlocks(newBlocks);
    } else {
      toast({ title: "Action Denied", description: "A block must have at least one question.", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setExamTitle("");
    setExamDescription("");
    setSelectedSubjectIdForFilter(null);
    setAssignedClassIds([]);
    setCurrentClassSelectionInDropdown(null);
    setExamBlocks([]);
    setAiSuggestionsEnabled(false);
    setAiFeedbackList([]);
    setAiError(null);
    if (!editingExamId && typeof window !== 'undefined') { 
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    setEditingExamId(null); 
    setIsLoadingExamData(false); 
    if (searchParams.get('examId')) router.push('/create-exam'); 
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!examTitle.trim()) {
      toast({ title: "Validation Error", description: "Exam title is required.", variant: "destructive" });
      return;
    }
    if (!selectedSubjectIdForFilter) {
      toast({ title: "Validation Error", description: "Please assign a subject to this exam.", variant: "destructive" });
      return;
    }
    if (assignedClassIds.length === 0) {
      toast({ title: "Validation Error", description: "Please assign at least one class to this exam.", variant: "destructive" });
      return;
    }
    if (examBlocks.length === 0 || examBlocks.some(b => b.questions.length === 0)) {
      toast({ title: "Validation Error", description: "At least one question in each block is required.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    let calculatedTotalQuestions = 0;
    let calculatedTotalPoints = 0;
    examBlocks.forEach(block => {
      calculatedTotalQuestions += block.questions.length;
      block.questions.forEach(question => { calculatedTotalPoints += question.points; });
    });

    const batch = writeBatch(db);

    try {
        const examDocId = editingExamId || doc(collection(db, EXAMS_COLLECTION_NAME)).id;
        const examDocRef = doc(db, EXAMS_COLLECTION_NAME, examDocId);

        const examCoreData: any = {
            title: examTitle,
            description: examDescription,
            updatedAt: serverTimestamp(),
            totalQuestions: calculatedTotalQuestions,
            totalPoints: calculatedTotalPoints,
            classIds: assignedClassIds, // Save array of class IDs
            subjectId: selectedSubjectIdForFilter, // Save the subject ID for easier querying if needed
        };


        if (editingExamId) {
            batch.update(examDocRef, examCoreData);

            const existingBlocksRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks");
            const existingBlocksSnap = await getDocs(existingBlocksRef);
            for (const blockDocSnap of existingBlocksSnap.docs) {
                const existingQuestionsRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks", blockDocSnap.id, "questions");
                const existingQuestionsSnap = await getDocs(existingQuestionsRef);
                for (const qDocSnap of existingQuestionsSnap.docs) {
                    batch.delete(qDocSnap.ref);
                }
                batch.delete(blockDocSnap.ref);
            }
        } else {
            batch.set(examDocRef, {
                ...examCoreData,
                userId: user.uid,
                createdAt: serverTimestamp(),
                status: "Draft",
            });
        }

        examBlocks.forEach((block, blockIndex) => {
            const blockDocRef = doc(collection(db, EXAMS_COLLECTION_NAME, examDocId, "questionBlocks"));
            const blockDataToSave: any = {
                clientSideBlockId: block.id, 
                blockType: block.blockType,
                blockTitle: block.blockTitle || "",
                orderIndex: blockIndex,
                examId: examDocId,
            };
            if (block.blockType === 'pooled-choices') {
                blockDataToSave.choicePool = (block.choicePool || []).map(pOpt => ({...pOpt, id: pOpt.id || generateId('pool-opt-save')}));
            }
            batch.set(blockDocRef, blockDataToSave);

            block.questions.forEach((question, questionIndex) => {
                const questionDocRef = doc(collection(db, EXAMS_COLLECTION_NAME, examDocId, "questionBlocks", blockDocRef.id, "questions")); 
                const questionData: any = {
                    clientSideQuestionId: question.id, 
                    questionText: question.questionText,
                    points: question.points,
                    type: question.type,
                    orderIndex: questionIndex,
                    blockCollectionId: blockDocRef.id, 
                    examId: examDocId,
                };
                if (question.type === 'multiple-choice') questionData.options = (question as MultipleChoiceQuestion).options.map(opt => ({ ...opt, id: opt.id || generateId('option-save') }));
                else if (question.type === 'true-false') questionData.correctAnswer = (question as TrueFalseQuestion).correctAnswer;
                else if (question.type === 'matching') questionData.pairs = (question as MatchingTypeQuestion).pairs.map(pair => ({ ...pair, id: pair.id || generateId('pair-save'), responseLetter: pair.responseLetter || "" }));
                else if (question.type === 'pooled-choices') questionData.correctAnswersFromPool = (question as PooledChoicesQuestion).correctAnswersFromPool;
                batch.set(questionDocRef, questionData);
            });
        });
        
        await batch.commit();
        
        if (editingExamId) {
            toast({ title: "Exam Updated", description: `Exam "${examTitle}" updated successfully.` });
            router.push('/exams'); 
        } else {
            toast({ title: "Exam Saved", description: `Exam "${examTitle}" saved. Local draft cleared.` });
            resetForm(); 
        }
    } catch (e) {
        console.error("Error saving exam: ", e);
        toast({ title: "Error Saving Exam", description: "There was an issue. Please try again.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };


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
                    <Skeleton className="h-10 w-full" /> {/* Placeholder for subject dropdown */}
                    <Skeleton className="h-10 w-full" /> {/* Placeholder for class dropdown */}
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
                       {feedback.suggestionText.split('\n').map((line, lineIndex) => {
                          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                            return <li key={lineIndex}>{line.trim().substring(2)}</li>;
                          }
                          return line.trim() ? <li key={lineIndex}>{line.trim()}</li> : null;
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
                    {/* <SelectItem value="none" className="text-xs sm:text-sm">No Subject Assigned</SelectItem> */}
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

              <div className="space-y-1 sm:space-y-2">
                 <Label htmlFor="assignClasses" className="text-sm sm:text-base">Assign to Classes</Label>
                 <div className="flex items-center gap-2">
                   <Select
                     value={currentClassSelectionInDropdown || ""}
                     onValueChange={(value) => setCurrentClassSelectionInDropdown(value === "none" ? null : value)}
                     disabled={isLoadingUserClasses || isSaving || isLoadingExamData || !selectedSubjectIdForFilter || filteredClassesForDropdown.length === 0}
                   >
                     <SelectTrigger id="assignClasses" className="flex-grow text-xs sm:text-sm h-9 sm:h-10">
                       <SelectValue placeholder={
                         !selectedSubjectIdForFilter ? "Select a subject first" :
                         isLoadingUserClasses ? "Loading classes..." :
                         filteredClassesForDropdown.length === 0 ? "No classes for subject" :
                         "Select a class to add"
                       } />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="none" disabled className="text-xs sm:text-sm">Select a class</SelectItem>
                       {filteredClassesForDropdown.map((cls) => (
                         <SelectItem key={cls.id} value={cls.id} className="text-xs sm:text-sm" disabled={assignedClassIds.includes(cls.id)}>
                           {cls.sectionName} ({cls.yearGrade}) - Code: {cls.code} {assignedClassIds.includes(cls.id) ? "(Assigned)" : ""}
                         </SelectItem>
                       ))}
                       {selectedSubjectIdForFilter && !isLoadingUserClasses && filteredClassesForDropdown.length === 0 && (
                          <SelectItem value="no-classes-for-subject" disabled className="text-xs sm:text-sm">
                            No classes found for selected subject.
                          </SelectItem>
                       )}
                     </SelectContent>
                   </Select>
                   <Button 
                     type="button" 
                     variant="outline" 
                     size="sm" 
                     onClick={handleAddClassToExam}
                     disabled={!currentClassSelectionInDropdown || isSaving || isLoadingExamData}
                     className="h-9 sm:h-10 text-xs sm:text-sm"
                   >
                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> Add
                   </Button>
                 </div>
                 {assignedClassIds.length > 0 && (
                   <div className="mt-2 space-y-1.5">
                     <Label className="text-2xs sm:text-xs text-muted-foreground">Assigned Classes:</Label>
                     <div className="flex flex-wrap gap-1.5">
                       {assignedClassIds.map(classId => {
                         const cls = allUserClasses.find(c => c.id === classId);
                         return cls ? (
                           <Badge key={classId} variant="secondary" className="py-0.5 px-1.5 text-2xs sm:text-xs">
                             {cls.subjectCode} - {cls.sectionName} ({cls.yearGrade})
                             <button 
                               type="button" 
                               onClick={() => handleRemoveClassFromExam(classId)} 
                               className="ml-1.5 p-0.5 rounded-full hover:bg-destructive/20"
                               aria-label={`Remove class ${cls.sectionName}`}
                               disabled={isSaving || isLoadingExamData}
                             >
                               <XIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                             </button>
                           </Badge>
                         ) : null;
                       })}
                     </div>
                   </div>
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
              Add Question Block
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
                assignedClassIds.length === 0 || 
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

