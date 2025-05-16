
import { NextResponse, type NextRequest } from 'next/server';
import admin from 'firebase-admin';
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { FullExamData, ExamQuestion, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion, PooledChoicesQuestion, ExamBlock } from '@/types/exam-types';

// Initialize Firebase Admin SDK if it hasn't been initialized yet
try {
  if (!admin.apps.length) {
    // GOOGLE_APPLICATION_CREDENTIALS environment variable should point to the serviceAccountKey.json file path
    // or contain the JSON content itself for environments like Vercel.
    // For local development, ensure serviceAccountKey.json is at the root and .env points to it.
    admin.initializeApp({
        // credential: admin.credential.applicationDefault(), // This is usually sufficient if GOOGLE_APPLICATION_CREDENTIALS is set
        // projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Optional, can be inferred
    });
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error in API route:', error);
  // If initialization fails, subsequent Firestore operations will fail.
  // We'll let errors bubble up to the main try-catch in POST for a JSON response.
}

const firestore = admin.firestore();

interface StudentAnswers {
  [questionId: string]: string | null;
}

interface ScoreRequestBody {
  examId: string;
  studentId: string;
  classId: string;
  subjectId: string;
  answers: StudentAnswers;
}

function getAlphabetLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ScoreRequestBody;
    const { examId, studentId, classId, subjectId, answers } = body;

    if (!examId || !studentId || !classId || !subjectId || !answers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch the full exam data (including correct answers) using Admin SDK
    const examDocRef = firestore.collection(EXAMS_COLLECTION_NAME).doc(examId);
    const examSnap = await examDocRef.get();

    if (!examSnap.exists) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }
    const examData = examSnap.data() as Omit<FullExamData, 'id' | 'examBlocks'>;
    const teacherUserId = examData.userId;

    if (!teacherUserId) {
      console.error(`Exam ${examId} is missing teacherUserId.`);
      return NextResponse.json({ error: 'Exam configuration error: missing teacher ID.' }, { status: 500 });
    }

    const blocksCollectionRef = examDocRef.collection("questionBlocks");
    const blocksSnapshot = await blocksCollectionRef.orderBy("orderIndex").get();

    const fetchedBlocks: ExamBlock[] = [];
    for (const blockDoc of blocksSnapshot.docs) {
      const blockData = blockDoc.data();
      const questionsCollectionRef = blocksCollectionRef.doc(blockDoc.id).collection("questions");
      const questionsSnapshot = await questionsCollectionRef.orderBy("orderIndex").get();
      const fetchedQuestions: ExamQuestion[] = questionsSnapshot.docs.map(qDoc => ({ id: qDoc.id, ...qDoc.data() } as ExamQuestion));
      fetchedBlocks.push({ id: blockDoc.id, ...blockData, questions: fetchedQuestions } as ExamBlock);
    }
    const fullExam: FullExamData = { ...examData, id: examId, examBlocks: fetchedBlocks };


    let totalAchievedScore = 0;
    let maxPossibleScore = 0;

    fullExam.examBlocks.forEach(block => {
      block.questions.forEach(question => {
        maxPossibleScore += question.points;
        const studentAnswer = answers[question.id];

        if (studentAnswer === undefined || studentAnswer === null || studentAnswer === "") {
          return; // Skip unanswered questions
        }

        let isCorrect = false;
        switch (question.type) {
          case 'multiple-choice':
            const mcq = question as MultipleChoiceQuestion;
            const correctOption = mcq.options.find(opt => opt.isCorrect);
            if (correctOption && studentAnswer === correctOption.id) {
              isCorrect = true;
            }
            break;
          case 'true-false':
            const tfq = question as TrueFalseQuestion;
            if ((tfq.correctAnswer === true && studentAnswer === "true") || (tfq.correctAnswer === false && studentAnswer === "false")) {
              isCorrect = true;
            }
            break;
          case 'matching':
            const matq = question as MatchingTypeQuestion;
            if (matq.pairs && matq.pairs.length > 0 && studentAnswer === matq.pairs[0].responseLetter) {
              isCorrect = true;
            }
            break;
          case 'pooled-choices':
            const pcq = question as PooledChoicesQuestion;
            if (block.choicePool && pcq.correctAnswersFromPool && pcq.correctAnswersFromPool.length > 0) {
                const correctChoiceText = pcq.correctAnswersFromPool[0];
                const studentAnswerIndex = block.choicePool.findIndex((_opt, index) => getAlphabetLetter(index) === studentAnswer);
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

    // Save the score
    const scoreDocRef = firestore
      .collection(SUBJECTS_COLLECTION_NAME)
      .doc(subjectId)
      .collection('classes')
      .doc(classId)
      .collection('scores')
      .doc(studentId);

    await scoreDocRef.set({
      examId: examId,
      studentId: studentId,
      score: totalAchievedScore,
      maxPossibleScore: maxPossibleScore,
      userId: teacherUserId,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      message: 'Score computed and saved successfully',
      achievedScore: totalAchievedScore,
      maxPossibleScore: maxPossibleScore
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing score submission in API route:', error);
    let errorMessage = 'Internal Server Error';
    let errorDetails = {};
    if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = { name: error.name, stack: error.stack }; // Include more details for debugging
    } else if (typeof error === 'object' && error !== null) {
        errorDetails = { ...error };
    }
    return NextResponse.json({ error: 'Failed to process score submission', details: errorMessage, debugInfo: errorDetails }, { status: 500 });
  }
}
