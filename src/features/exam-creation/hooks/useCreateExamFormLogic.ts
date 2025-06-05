
// src/features/exam-creation/hooks/useCreateExamFormLogic.ts
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase/config';
import { collection, doc, writeBatch, serverTimestamp, getDoc, getDocs, query, orderBy, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { generateId, debounce } from "@/lib/utils";
import type {
  ExamBlock,
  ExamQuestion,
  QuestionType,
  Option,
  MultipleChoiceQuestion,
  TrueFalseQuestion,
  MatchingTypeQuestion,
  MatchingPair,
  PooledChoicesQuestion,
  PoolOption,
  ClassInfoForDropdown,
  FetchedSubjectInfo,
  AssignedClassSlot as AssignedClassSlotType,
} from "@/types/exam-types";
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from "@/config/firebase-constants";
import { analyzeExamFlow, type AnalyzeExamInput, type AnalyzeExamOutput } from "@/ai/flows/analyze-exam-flow";
import { QUESTION_TYPES } from '@/types/exam-types';

const LOCAL_STORAGE_KEY = 'pendingExamData-v2'; // Added -v2 to potentially reset if old structure exists

type AISuggestion = AnalyzeExamOutput['suggestions'][0];

interface AssignedClassSlot extends AssignedClassSlotType {
  key: string;
  selectedClassId: string | null;
}

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
      const defaultTypeLabel = QUESTION_TYPES.find(qt => qt.value === type)?.label || type;
      console.warn(`createDefaultQuestion received an unknown type: ${defaultTypeLabel}. Defaulting to multiple-choice.`);
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

interface UseCreateExamFormLogicProps {
  user: User | null;
}

export function useCreateExamFormLogic({ user }: UseCreateExamFormLogicProps) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [examTitle, setExamTitle] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [examBlocks, setExamBlocks] = useState<ExamBlock[]>([]);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [isLoadingExamData, setIsLoadingExamData] = useState(false);

  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiFeedbackList, setAiFeedbackList] = useState<AISuggestion[]>([]);
  const [isAnalyzingWithAI, setIsAnalyzingWithAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [userSubjectsForDropdown, setUserSubjectsForDropdown] = useState<FetchedSubjectInfo[]>([]);
  const [isLoadingUserSubjectsForDropdown, setIsLoadingUserSubjectsForDropdown] = useState(true);
  const [selectedSubjectIdForFilter, setSelectedSubjectIdForFilter] = useState<string | null>(null);

  const [assignedClassSlots, setAssignedClassSlots] = useState<AssignedClassSlot[]>([{ key: generateId('class-slot'), selectedClassId: null }]);
  const [allUserClasses, setAllUserClasses] = useState<ClassInfoForDropdown[]>([]);
  const [isLoadingUserClasses, setIsLoadingUserClasses] = useState(true);

  const isInitialClientLoadRef = useRef(true);

  const totalPoints = useMemo(() => {
    return examBlocks.reduce((acc, block) => {
      return acc + block.questions.reduce((qAcc, q) => qAcc + q.points, 0);
    }, 0);
  }, [examBlocks]);

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
        querySnapshot.forEach((docSnap) => {
          fetchedSubjects.push({ id: docSnap.id, ...docSnap.data() } as FetchedSubjectInfo);
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

  const handleSubjectFilterChange = useCallback((subjectIdValue: string) => {
    const newSubjectId = subjectIdValue === "none" ? null : subjectIdValue;
    setSelectedSubjectIdForFilter(newSubjectId);
    setAssignedClassSlots([{ key: generateId('class-slot-subject-change'), selectedClassId: null }]);
  }, []);

  const handleAddClassAssignmentSlot = useCallback(() => {
    setAssignedClassSlots(prev => [...prev, { key: generateId('class-slot'), selectedClassId: null }]);
  }, []);

  const handleRemoveClassAssignmentSlot = useCallback((keyToRemove: string) => {
    setAssignedClassSlots(prev => {
        const newSlots = prev.filter(slot => slot.key !== keyToRemove);
        return newSlots.length > 0 ? newSlots : [{ key: generateId('class-slot-default'), selectedClassId: null }];
    });
  }, []);

  const handleAssignedClassChange = useCallback((keyToUpdate: string, newClassId: string | null) => {
    setAssignedClassSlots(prev =>
      prev.map(slot =>
        slot.key === keyToUpdate ? { ...slot, selectedClassId: newClassId === "none" ? null : newClassId } : slot
      )
    );
  }, []);

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
                    if (!mcq.options || mcq.options.length < 2) { isContentSufficientForAnalysis = false; missingInfoMessage = "Multiple-choice questions need at least two options."; break; }
                    if (!mcq.options.some(opt => opt.isCorrect)) { isContentSufficientForAnalysis = false; missingInfoMessage = "Mark a correct answer for all multiple-choice questions."; break; }
                    if (mcq.options.some(opt => !opt.text.trim())) { isContentSufficientForAnalysis = false; missingInfoMessage = "Fill in all option texts for multiple-choice questions."; break; }
                } else if (q.type === 'true-false') {
                    if ((q as TrueFalseQuestion).correctAnswer === null) { isContentSufficientForAnalysis = false; missingInfoMessage = "Select True or False for all true/false questions."; break; }
                } else if (q.type === 'matching') {
                    const matq = q as MatchingTypeQuestion;
                    if (!matq.pairs || matq.pairs.length < 1) { isContentSufficientForAnalysis = false; missingInfoMessage = "Matching questions need at least one pair."; break; }
                    if (matq.pairs.some(p => !p.premise.trim() || !p.response.trim())) { isContentSufficientForAnalysis = false; missingInfoMessage = "Fill in all premise and response texts for matching pairs."; break; }
                    if (matq.pairs.some(p => !p.responseLetter)) { isContentSufficientForAnalysis = false; missingInfoMessage = "Assign a letter ID to all answers in matching questions."; break; }
                } else if (q.type === 'pooled-choices') {
                    if (!block.choicePool || block.choicePool.length < 1) { isContentSufficientForAnalysis = false; missingInfoMessage = "Pooled-choices blocks need at least one option in their choice pool."; break; }
                    if (block.choicePool.some(pOpt => !pOpt.text.trim())) { isContentSufficientForAnalysis = false; missingInfoMessage = "Fill in all option texts for the choice pool."; break; }
                    if ((q as PooledChoicesQuestion).correctAnswersFromPool.length === 0) { isContentSufficientForAnalysis = false; missingInfoMessage = "Select a correct answer from the pool for all pooled-choices questions."; break; }
                }
            }
            if (!isContentSufficientForAnalysis) break;
        }
    }

    if (!isContentSufficientForAnalysis) {
        setAiFeedbackList([{ suggestionText: missingInfoMessage || "AI analysis requires more complete exam content.", severity: "info" }]);
        setIsAnalyzingWithAI(false); setAiError(null); return;
    }

    setIsAnalyzingWithAI(true); setAiError(null);
    const examDataForAI: AnalyzeExamInput = {
      examTitle, examDescription,
      examBlocks: examBlocks.map(block => ({
        id: block.id, blockType: block.blockType, blockTitle: block.blockTitle,
        choicePool: block.blockType === 'pooled-choices' ? block.choicePool : undefined,
        questions: block.questions.map(q => {
          const questionPayload: any = { id: q.id, questionText: q.questionText, points: q.points, type: q.type, };
          if (q.type === 'multiple-choice') questionPayload.options = (q as MultipleChoiceQuestion).options;
          else if (q.type === 'true-false') questionPayload.correctAnswer = (q as TrueFalseQuestion).correctAnswer;
          else if (q.type === 'matching') questionPayload.pairs = (q as MatchingTypeQuestion).pairs;
          else if (q.type === 'pooled-choices') questionPayload.correctAnswersFromPool = (q as PooledChoicesQuestion).correctAnswersFromPool;
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
  }, [aiSuggestionsEnabled, examTitle, examDescription, examBlocks, assignedClassSlots, isInitialLoadComplete, isLoadingExamData, isSaving, debouncedAIAnalysis]);

  useEffect(() => {
    const examIdFromUrl = searchParams.get('examId');
    if (examIdFromUrl) {
      setEditingExamId(examIdFromUrl);
    } else {
      if (typeof window !== 'undefined') {
        if (isInitialClientLoadRef.current) {
          const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (savedData) {
            try {
              const parsedData = JSON.parse(savedData);
              if (parsedData.title) setExamTitle(parsedData.title);
              if (parsedData.description) setExamDescription(parsedData.description);
              setSelectedSubjectIdForFilter(parsedData.hasOwnProperty('selectedSubjectIdForFilter') ? parsedData.selectedSubjectIdForFilter : null);
              if (parsedData.assignedClassSlots && Array.isArray(parsedData.assignedClassSlots) && parsedData.assignedClassSlots.length > 0) {
                  setAssignedClassSlots(parsedData.assignedClassSlots.map((slot: any) => ({ key: slot.key || generateId('loaded-class-slot'), selectedClassId: slot.selectedClassId || null, })));
              } else { setAssignedClassSlots([{ key: generateId('default-class-slot-no-saved'), selectedClassId: null }]); }
              if (parsedData.blocks && Array.isArray(parsedData.blocks)) {
                const validatedBlocks = parsedData.blocks.map((block: ExamBlock) => ({
                  ...block, id: block.id || generateId('block'),
                  ...(block.blockType === 'pooled-choices' && { choicePool: (block.choicePool || []).map((pOpt: PoolOption) => ({ ...pOpt, id: pOpt.id || generateId('pool-opt'),})) }),
                  questions: block.questions.map((q: ExamQuestion) => ({
                    ...q, id: q.id || generateId('question'),
                    ...(q.type === 'multiple-choice' && { options: (q as MultipleChoiceQuestion).options?.map((opt: Option) => ({ ...opt, id: opt.id || generateId('option'), })) || [], }),
                    ...(q.type === 'matching' && { pairs: (q as MatchingTypeQuestion).pairs?.map((p: MatchingPair) => ({ ...p, id: p.id || generateId('pair'), responseLetter: p.responseLetter || "",})) || [], }),
                    ...(q.type === 'pooled-choices' && { correctAnswersFromPool: (q as PooledChoicesQuestion).correctAnswersFromPool || [], }),
                  })),
                }));
                setExamBlocks(validatedBlocks);
              }
            } catch (error) {
              console.error("Error parsing exam data from localStorage:", error);
              localStorage.removeItem(LOCAL_STORAGE_KEY);
              setSelectedSubjectIdForFilter(null); setAssignedClassSlots([{ key: generateId('error-reset-class-slot'), selectedClassId: null }]);
            }
          } else { setSelectedSubjectIdForFilter(null); setAssignedClassSlots([{ key: generateId('init-class-slot-no-data'), selectedClassId: null }]); }
          isInitialClientLoadRef.current = false;
        }
        setIsInitialLoadComplete(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const fetchExamForEditing = async () => {
      if (!editingExamId || !user) return;
      setIsLoadingExamData(true);
      setExamTitle(""); setExamDescription(""); setSelectedSubjectIdForFilter(null); setAssignedClassSlots([]); setExamBlocks([]); setAiFeedbackList([]);
      try {
        const examDocRef = doc(db, EXAMS_COLLECTION_NAME, editingExamId);
        const examSnap = await getDoc(examDocRef);
        if (!examSnap.exists() || examSnap.data().userId !== user.uid) {
          toast({ title: "Error", description: "Exam not found or you don't have permission to edit it.", variant: "destructive" });
          router.push('/exams'); return;
        }
        const examData = examSnap.data();
        setExamTitle(examData.title); setExamDescription(examData.description || "");
        if (examData.classIds && Array.isArray(examData.classIds)) {
            if (examData.classIds.length > 0) { setAssignedClassSlots(examData.classIds.map((id: string) => ({ key: generateId('loaded-slot'), selectedClassId: id })));
            } else { setAssignedClassSlots([{ key: generateId('default-fetch-slot-empty-db'), selectedClassId: null }]); }
        } else { setAssignedClassSlots([{ key: generateId('default-fetch-slot-no-field'), selectedClassId: null }]); }
        if (examData.subjectId) { setSelectedSubjectIdForFilter(examData.subjectId); } else { setSelectedSubjectIdForFilter(null); }
        const loadedBlocks: ExamBlock[] = [];
        const blocksCollectionRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks");
        const blocksQuery = query(blocksCollectionRef, orderBy("orderIndex"));
        const blocksSnapshot = await getDocs(blocksQuery);
        for (const blockDoc of blocksSnapshot.docs) {
          const blockData = blockDoc.data(); const loadedQuestions: ExamQuestion[] = [];
          const questionsCollectionRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks", blockDoc.id, "questions");
          const questionsQuery = query(questionsCollectionRef, orderBy("orderIndex"));
          const questionsSnapshot = await getDocs(questionsQuery);
          questionsSnapshot.forEach(questionDocSnap => {
            const qData = questionDocSnap.data(); let question: ExamQuestion;
            switch (qData.type as QuestionType) {
              case 'multiple-choice': question = { id: questionDocSnap.id, questionText: qData.questionText, points: qData.points, type: 'multiple-choice', options: (qData.options || []).map((opt: any) => ({ ...opt, id: opt.id || generateId('option')})), } as MultipleChoiceQuestion; break;
              case 'true-false': question = { id: questionDocSnap.id, questionText: qData.questionText, points: qData.points, type: 'true-false', correctAnswer: qData.correctAnswer === undefined ? null : qData.correctAnswer, } as TrueFalseQuestion; break;
              case 'matching': question = { id: questionDocSnap.id, questionText: qData.questionText, points: qData.points, type: 'matching', pairs: (qData.pairs || []).map((p: any) => ({ ...p, id: p.id || generateId('pair'), responseLetter: p.responseLetter || "" })), } as MatchingTypeQuestion; break;
              case 'pooled-choices': question = { id: questionDocSnap.id, questionText: qData.questionText, points: qData.points, type: 'pooled-choices', correctAnswersFromPool: qData.correctAnswersFromPool || [], } as PooledChoicesQuestion; break;
              default: console.warn("Unknown question type from Firestore:", qData.type); question = createDefaultQuestion('multiple-choice', questionDocSnap.id) as MultipleChoiceQuestion;
            }
            loadedQuestions.push(question);
          });
          loadedBlocks.push({ id: blockDoc.id, blockType: blockData.blockType, blockTitle: blockData.blockTitle || "", questions: loadedQuestions, choicePool: blockData.blockType === 'pooled-choices' ? (blockData.choicePool || []).map((pOpt: PoolOption) => ({...pOpt, id: pOpt.id || generateId('pool-opt-load')})) : undefined, });
        }
        setExamBlocks(loadedBlocks); localStorage.removeItem(LOCAL_STORAGE_KEY);
        toast({ title: "Exam Loaded", description: `Editing "${examData.title}". Your changes will be saved to the database.` });
      } catch (error) {
        console.error("Error fetching exam for editing:", error);
        toast({ title: "Error Loading Exam", description: "Could not load the exam data for editing.", variant: "destructive" });
        router.push('/exams');
      } finally {
        setIsLoadingExamData(false); setIsInitialLoadComplete(true);
      }
    };
    if (editingExamId && user && !isLoadingUserClasses && !isLoadingUserSubjectsForDropdown) {
      fetchExamForEditing();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExamId, user, router, toast, isLoadingUserClasses, isLoadingUserSubjectsForDropdown]); // Dependencies for fetching existing exam

  useEffect(() => {
    if (editingExamId || !isInitialLoadComplete || typeof window === 'undefined' || isLoadingExamData) {
      return;
    }
    const examDataToSave = { title: examTitle, description: examDescription, selectedSubjectIdForFilter, assignedClassSlots, blocks: examBlocks, };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(examDataToSave));
  }, [examTitle, examDescription, selectedSubjectIdForFilter, assignedClassSlots, examBlocks, editingExamId, isInitialLoadComplete, isLoadingExamData]);

  const handleAddExamBlock = useCallback(() => {
    let newBlockType: QuestionType = 'multiple-choice';
    if (examBlocks.length > 0) { newBlockType = examBlocks[examBlocks.length - 1].blockType; }
    const initialQuestion = createDefaultQuestion(newBlockType);
    const newBlock: ExamBlock = {
      id: generateId('block'), blockType: newBlockType, questions: [initialQuestion], blockTitle: "",
      ...(newBlockType === 'pooled-choices' && { choicePool: [{id: generateId('pool-opt'), text: ""}, {id: generateId('pool-opt'), text: ""}] }),
    };
    setExamBlocks(prev => [...prev, newBlock]);
  }, [examBlocks]);

  const handleRemoveExamBlock = useCallback((blockIndex: number) => {
    setExamBlocks(prev => prev.filter((_, i) => i !== blockIndex));
  }, []);

  const handleChangeBlockType = useCallback((blockIndex: number, newType: QuestionType) => {
    setExamBlocks(prevBlocks => {
      const newBlocks = [...prevBlocks];
      const currentBlock = newBlocks[blockIndex];
      const initialQuestion = createDefaultQuestion(newType);
      newBlocks[blockIndex] = {
        ...currentBlock, blockType: newType, questions: [initialQuestion],
        choicePool: newType === 'pooled-choices' ? (currentBlock.choicePool && currentBlock.blockType === newType ? currentBlock.choicePool : [{id: generateId('pool-opt'), text: ""}, {id: generateId('pool-opt'), text: ""}]) : undefined,
      };
      toast({ title: "Block Type Changed", description: `Questions in block ${blockIndex + 1} reset for new type.`});
      return newBlocks;
    });
  }, [toast]);

  const handleBlockTitleChange = useCallback((blockIndex: number, title: string) => {
    setExamBlocks(prev => { const newBlocks = [...prev]; newBlocks[blockIndex].blockTitle = title; return newBlocks; });
  }, []);

  const handleUpdateBlock = useCallback((blockIndex: number, updatedBlock: ExamBlock) => {
    setExamBlocks(prev => { const newBlocks = [...prev]; newBlocks[blockIndex] = updatedBlock; return newBlocks; });
  }, []);

  const handleAddQuestionToBlock = useCallback((blockIndex: number) => {
    setExamBlocks(prevBlocks => {
      const newBlocks = [...prevBlocks]; const block = newBlocks[blockIndex]; const lastQuestion = block.questions[block.questions.length - 1];
      const inheritedPoints = lastQuestion.points;
      let newOptionsForMC: Option[] = [{ id: generateId('option'), text: "", isCorrect: true }, { id: generateId('option'), text: "", isCorrect: false },];
      if (block.blockType === 'multiple-choice' && lastQuestion.type === 'multiple-choice') {
        const numOptions = (lastQuestion as MultipleChoiceQuestion).options?.length > 0 ? (lastQuestion as MultipleChoiceQuestion).options.length : 2;
        newOptionsForMC = Array.from({ length: numOptions }, (_, i) => ({ id: generateId('option'), text: "", isCorrect: i === 0 && numOptions > 0, }));
      }
      const baseNewQuestionProps = { id: generateId('question'), questionText: "", points: inheritedPoints };
      let newQuestion: ExamQuestion;
      switch (block.blockType) {
        case 'multiple-choice': newQuestion = { ...baseNewQuestionProps, type: 'multiple-choice', options: newOptionsForMC }; break;
        case 'true-false': newQuestion = { ...baseNewQuestionProps, type: 'true-false', correctAnswer: null }; break;
        case 'matching': newQuestion = { ...baseNewQuestionProps, type: 'matching', pairs: [{ id: generateId('pair'), premise: "", response: "", responseLetter: "" }] }; break;
        case 'pooled-choices': newQuestion = { ...baseNewQuestionProps, type: 'pooled-choices', correctAnswersFromPool: [] }; break;
        default: newQuestion = { ...baseNewQuestionProps, type: 'multiple-choice', options: newOptionsForMC }; break;
      }
      block.questions.push(newQuestion);
      return newBlocks;
    });
  }, []);

  const handleUpdateQuestionInBlock = useCallback((blockIndex: number, questionIndex: number, updatedQuestion: ExamQuestion) => {
    setExamBlocks(prev => { const newBlocks = [...prev]; newBlocks[blockIndex].questions[questionIndex] = updatedQuestion; return newBlocks; });
  }, []);

  const handleRemoveQuestionFromBlock = useCallback((blockIndex: number, questionIndex: number) => {
    setExamBlocks(prevBlocks => {
      const newBlocks = [...prevBlocks];
      if (newBlocks[blockIndex].questions.length > 1) { newBlocks[blockIndex].questions.splice(questionIndex, 1); }
      else { toast({ title: "Action Denied", description: "A block must have at least one question.", variant: "destructive" }); }
      return newBlocks;
    });
  }, [toast]);

  const resetForm = useCallback(() => {
    setExamTitle(""); setExamDescription(""); setSelectedSubjectIdForFilter(null);
    setAssignedClassSlots([{ key: generateId('reset-class-slot'), selectedClassId: null }]);
    setExamBlocks([]); setAiSuggestionsEnabled(false); setAiFeedbackList([]); setAiError(null);
    if (!editingExamId && typeof window !== 'undefined') { localStorage.removeItem(LOCAL_STORAGE_KEY); }
    setEditingExamId(null); setIsLoadingExamData(false); isInitialClientLoadRef.current = true;
    if (searchParams.get('examId')) router.push('/create-exam');
  }, [editingExamId, searchParams, router]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) { toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" }); return; }
    if (!examTitle.trim()) { toast({ title: "Validation Error", description: "Exam title is required.", variant: "destructive" }); return; }
    if (!selectedSubjectIdForFilter) { toast({ title: "Validation Error", description: "Please assign a subject to this exam.", variant: "destructive" }); return; }
    const validAssignedClassIds = assignedClassSlots.map(slot => slot.selectedClassId).filter(id => id !== null) as string[];
    if (validAssignedClassIds.length === 0) { toast({ title: "Validation Error", description: "Please assign at least one class to this exam.", variant: "destructive" }); return; }
    if (examBlocks.length === 0 || examBlocks.some(b => b.questions.length === 0)) { toast({ title: "Validation Error", description: "At least one question in each block is required.", variant: "destructive" }); return; }
    setIsSaving(true);
    let calculatedTotalQuestions = 0; let calculatedTotalPoints = 0;
    examBlocks.forEach(block => { calculatedTotalQuestions += block.questions.length; block.questions.forEach(question => { calculatedTotalPoints += question.points; }); });
    const batch = writeBatch(db);
    try {
        const examDocId = editingExamId || doc(collection(db, EXAMS_COLLECTION_NAME)).id;
        const examDocRef = doc(db, EXAMS_COLLECTION_NAME, examDocId);
        const examCoreData: any = { title: examTitle, description: examDescription, updatedAt: serverTimestamp(), totalQuestions: calculatedTotalQuestions, totalPoints: calculatedTotalPoints, classIds: validAssignedClassIds, subjectId: selectedSubjectIdForFilter, };
        if (editingExamId) {
            batch.update(examDocRef, examCoreData);
            const existingBlocksRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks");
            const existingBlocksSnap = await getDocs(existingBlocksRef);
            for (const blockDocSnap of existingBlocksSnap.docs) {
                const existingQuestionsRef = collection(db, EXAMS_COLLECTION_NAME, editingExamId, "questionBlocks", blockDocSnap.id, "questions");
                const existingQuestionsSnap = await getDocs(existingQuestionsRef);
                for (const qDocSnap of existingQuestionsSnap.docs) { batch.delete(qDocSnap.ref); }
                batch.delete(blockDocSnap.ref);
            }
        } else { batch.set(examDocRef, { ...examCoreData, userId: user.uid, createdAt: serverTimestamp(), status: "Draft", }); }
        examBlocks.forEach((block, blockIndex) => {
            const blockDocRef = doc(collection(db, EXAMS_COLLECTION_NAME, examDocId, "questionBlocks"));
            const blockDataToSave: any = { clientSideBlockId: block.id, blockType: block.blockType, blockTitle: block.blockTitle || "", orderIndex: blockIndex, examId: examDocId, };
            if (block.blockType === 'pooled-choices') { blockDataToSave.choicePool = (block.choicePool || []).map(pOpt => ({...pOpt, id: pOpt.id || generateId('pool-opt-save')})); }
            batch.set(blockDocRef, blockDataToSave);
            block.questions.forEach((question, questionIndex) => {
                const questionDocRef = doc(collection(db, EXAMS_COLLECTION_NAME, examDocId, "questionBlocks", blockDocRef.id, "questions"));
                const questionData: any = { clientSideQuestionId: question.id, questionText: question.questionText, points: question.points, type: question.type, orderIndex: questionIndex, blockCollectionId: blockDocRef.id, examId: examDocId, };
                if (question.type === 'multiple-choice') questionData.options = (question as MultipleChoiceQuestion).options.map(opt => ({ ...opt, id: opt.id || generateId('option-save') }));
                else if (question.type === 'true-false') questionData.correctAnswer = (question as TrueFalseQuestion).correctAnswer;
                else if (question.type === 'matching') questionData.pairs = (question as MatchingTypeQuestion).pairs.map(pair => ({ ...pair, id: pair.id || generateId('pair-save'), responseLetter: pair.responseLetter || "" }));
                else if (question.type === 'pooled-choices') questionData.correctAnswersFromPool = (question as PooledChoicesQuestion).correctAnswersFromPool;
                batch.set(questionDocRef, questionData);
            });
        });
        await batch.commit();
        if (editingExamId) {
            toast({ title: "Exam Updated", description: `Exam "${examTitle}" updated successfully. Triggering score recalculation...` });
            try {
                const response = await fetch('/api/recalculate-scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ examId: editingExamId }), });
                const result = await response.json();
                if (response.ok) { toast({ title: "Score Recalculation", description: result.message || "Scores are being recalculated." });
                } else { toast({ title: "Score Recalculation Failed", description: result.error || "Could not trigger score recalculation.", variant: "destructive" }); }
            } catch (recalcError) { console.error("Error calling recalculate API:", recalcError); toast({ title: "Score Recalculation Error", description: "Failed to initiate score recalculation.", variant: "destructive" }); }
            router.push('/exams');
        } else { toast({ title: "Exam Saved", description: `Exam "${examTitle}" saved as Draft. Local draft cleared.` }); resetForm(); }
    } catch (e) { console.error("Error saving exam: ", e); toast({ title: "Error Saving Exam", description: "There was an issue. Please try again.", variant: "destructive" });
    } finally { setIsSaving(false); }
  }, [user, examTitle, examDescription, selectedSubjectIdForFilter, assignedClassSlots, examBlocks, editingExamId, toast, router, resetForm]);

  return {
    examTitle, setExamTitle,
    examDescription, setExamDescription,
    examBlocks,
    isInitialLoadComplete,
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
    allUserClasses,
    isLoadingUserClasses,
    totalPoints,
    filteredClassesForDropdown,
    handleSubjectFilterChange,
    handleAddClassAssignmentSlot,
    handleRemoveClassAssignmentSlot,
    handleAssignedClassChange,
    performAIAnalysis, // Exposing for manual trigger if needed
    handleAddExamBlock,
    handleChangeBlockType,
    handleBlockTitleChange,
    handleUpdateBlock,
    handleAddQuestionToBlock,
    handleUpdateQuestionInBlock,
    handleRemoveQuestionFromBlock,
    resetForm,
    handleSubmit,
  };
}
