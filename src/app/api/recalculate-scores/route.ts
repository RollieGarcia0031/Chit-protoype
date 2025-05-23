
// src/app/api/recalculate-scores/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import admin from 'firebase-admin';
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { FullExamData, ExamQuestion, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion, PooledChoicesQuestion, StudentAnswers, StudentExamScore, ExamBlock } from '@/types/exam-types';

// Ensure Firebase Admin SDK is initialized
try {
  if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      // For Vercel, use the JSON string from the environment variable
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)),
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
       // For local development using a file path
       admin.initializeApp({
        credential: admin.credential.applicationDefault(), // Checks GOOGLE_APPLICATION_CREDENTIALS env var for file path
      });
    } else {
       // Fallback for other environments if GOOGLE_APPLICATION_CREDENTIALS is set via gcloud CLI or to a file path
       // Or if running in a Google Cloud environment with Application Default Credentials
       admin.initializeApp();
    }
  }
} catch (error: any) {
  console.error('Firebase Admin Initialization Error in /api/recalculate-scores:', error.message);
  // This error will likely prevent the API route from functioning correctly.
}

const firestore = admin.firestore();

interface RecalculateRequestBody {
  examId: string;
}

function getAlphabetLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

// Scoring logic (should be identical to the one in /api/score/route.ts)
function calculateScore(fullExam: FullExamData, studentAnswers: StudentAnswers): { achievedScore: number; maxPossibleScore: number } {
  let totalAchievedScore = 0;
  let maxPossibleScore = 0;

  fullExam.examBlocks.forEach(block => {
    block.questions.forEach(question => {
      maxPossibleScore += question.points;
      const studentAnswerForQuestion = studentAnswers[question.id]; 

      if (studentAnswerForQuestion === undefined || studentAnswerForQuestion === null || 
          (typeof studentAnswerForQuestion === 'string' && studentAnswerForQuestion.trim() === "") ||
          (Array.isArray(studentAnswerForQuestion) && studentAnswerForQuestion.length === 0)
      ) {
        return;
      }
      
      const singleStudentAnswer = Array.isArray(studentAnswerForQuestion) ? studentAnswerForQuestion[0] : studentAnswerForQuestion;

      let isCorrect = false;
      switch (question.type) {
        case 'multiple-choice':
          const mcq = question as MultipleChoiceQuestion;
          const correctOption = mcq.options.find(opt => opt.isCorrect);
          if (correctOption && singleStudentAnswer === correctOption.id) {
            isCorrect = true;
          }
          break;
        case 'true-false':
          const tfq = question as TrueFalseQuestion;
          if ((tfq.correctAnswer === true && singleStudentAnswer === "true") || (tfq.correctAnswer === false && singleStudentAnswer === "false")) {
            isCorrect = true;
          }
          break;
        case 'matching':
          const matq = question as MatchingTypeQuestion;
           if (matq.pairs && matq.pairs.length > 0 && typeof singleStudentAnswer === 'string' && (matq.pairs[0].responseLetter || '').toUpperCase() === singleStudentAnswer.toUpperCase() ) {
            isCorrect = true;
          }
          break;
        case 'pooled-choices':
          const pcq = question as PooledChoicesQuestion;
          if (block.choicePool && pcq.correctAnswersFromPool && pcq.correctAnswersFromPool.length > 0 && typeof singleStudentAnswer === 'string') {
              const correctChoiceText = pcq.correctAnswersFromPool[0];
              const studentAnswerIndex = block.choicePool.findIndex((_opt, index) => getAlphabetLetter(index) === singleStudentAnswer.toUpperCase());
              if (studentAnswerIndex !== -1 && block.choicePool[studentAnswerIndex].text === correctChoiceText) {
                  isCorrect = true;
              }
          }
          break;
      }
      if (isCorrect) {
        totalAchievedScore += question.points;
      }
    });
  });
  return { achievedScore: totalAchievedScore, maxPossibleScore };
}

export async function POST(request: NextRequest) {
  if (!admin.apps.length) {
    return NextResponse.json({ error: 'Firebase Admin SDK not initialized. Check server logs.' }, { status: 500 });
  }

  try {
    const body = await request.json() as RecalculateRequestBody;
    const { examId } = body;

    if (!examId) {
      return NextResponse.json({ error: 'Missing examId' }, { status: 400 });
    }

    // 1. Fetch the updated exam data (including correct answers and points)
    const examDocRef = firestore.collection(EXAMS_COLLECTION_NAME).doc(examId);
    const examSnap = await examDocRef.get();
    if (!examSnap.exists) {
      return NextResponse.json({ error: 'Updated exam not found for recalculation' }, { status: 404 });
    }
    const examData = examSnap.data() as Omit<FullExamData, 'id' | 'examBlocks'>;
    const blocksCollectionRef = examDocRef.collection("questionBlocks");
    const blocksSnapshot = await blocksCollectionRef.orderBy("orderIndex").get();
    const fetchedBlocks: ExamBlock[] = [];
    for (const blockDoc of blocksSnapshot.docs) {
      const blockDocData = blockDoc.data();
      const questionsCollectionRef = blocksCollectionRef.doc(blockDoc.id).collection("questions");
      const questionsSnapshot = await questionsCollectionRef.orderBy("orderIndex").get();
      const fetchedQuestions: ExamQuestion[] = questionsSnapshot.docs.map(qDoc => ({ id: qDoc.id, ...qDoc.data() } as ExamQuestion));
      fetchedBlocks.push({ id: blockDoc.id, ...blockDocData, questions: fetchedQuestions } as ExamBlock);
    }
    const updatedFullExam: FullExamData = { ...examData, id: examId, examBlocks: fetchedBlocks };

    // 2. Query for all score documents related to this exam using a collection group query
    const scoresQuery = firestore.collectionGroup('scores').where('examId', '==', examId);
    const scoresSnapshot = await scoresQuery.get();

    if (scoresSnapshot.empty) {
      // Exam exists, but no student submissions were found for this examId.
      return NextResponse.json({ message: `Exam "${updatedFullExam.title}" exists, but no student submissions were found to recalculate.` }, { status: 200 });
    }

    const batch = firestore.batch();
    let recalculatedCount = 0;

    scoresSnapshot.forEach(scoreDoc => {
      const scoreData = scoreDoc.data() as StudentExamScore;
      if (scoreData.answers) { // Only recalculate if there are answers stored
        const { achievedScore, maxPossibleScore } = calculateScore(updatedFullExam, scoreData.answers);
        
        const updatedScoreFields: Partial<StudentExamScore> = { // Use Partial for update
          score: achievedScore,
          maxPossibleScore: maxPossibleScore,
          updatedAt: admin.firestore.FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
        };
        batch.update(scoreDoc.ref, updatedScoreFields);
        recalculatedCount++;
      }
    });

    await batch.commit();

    return NextResponse.json({
      message: `Successfully recalculated scores for ${recalculatedCount} submission(s).`,
      recalculatedCount,
    }, { status: 200 });

  } catch (error) {
    console.error('Error recalculating scores:', error);
    let errorMessage = 'Internal Server Error';
     if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Failed to recalculate scores.', details: errorMessage }, { status: 500 });
  }
}

