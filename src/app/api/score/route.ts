
import { NextResponse, type NextRequest } from 'next/server';
import admin from 'firebase-admin';
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { FullExamData, ExamQuestion, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion, PooledChoicesQuestion, StudentAnswers, ExamBlock, StudentExamScore } from '@/types/exam-types';

// Initialize Firebase Admin SDK if it hasn't been initialized yet
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
  console.error('Firebase Admin Initialization Error in /api/score:', error.message);
  // This error will likely prevent the API route from functioning correctly.
}

const firestore = admin.firestore();

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
  if (!admin.apps.length) {
    return NextResponse.json({ error: 'Firebase Admin SDK not initialized. Check server logs.' }, { status: 500 });
  }
  try {
    const body = await request.json() as ScoreRequestBody;
    const { examId, studentId, classId, subjectId, answers } = body;

    if (!examId || !studentId || !classId || !subjectId || !answers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const examDocRef = firestore.collection(EXAMS_COLLECTION_NAME).doc(examId);
    const examSnap = await examDocRef.get();

    if (!examSnap.exists) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }
    const examData = examSnap.data() as Omit<FullExamData, 'id' | 'examBlocks'>;
    const teacherUserId = examData.userId;

    if (!teacherUserId) {
      console.error(`Exam ${examId} is missing userId (exam creator ID).`);
      return NextResponse.json({ error: 'Exam configuration error: missing exam creator ID.' }, { status: 500 });
    }

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
    const fullExam: FullExamData = { ...examData, id: examId, examBlocks: fetchedBlocks };

    let totalAchievedScore = 0;
    let maxPossibleScore = 0;

    fullExam.examBlocks.forEach(block => {
      block.questions.forEach(question => {
        maxPossibleScore += question.points;
        const studentAnswerForQuestion = answers[question.id];

        if (studentAnswerForQuestion === undefined || studentAnswerForQuestion === null ||
            (typeof studentAnswerForQuestion === 'string' && studentAnswerForQuestion.trim() === "") ||
            (Array.isArray(studentAnswerForQuestion) && studentAnswerForQuestion.length === 0)
        ) {
          return;
        }

        let isCorrect = false;
        const singleStudentAnswer = Array.isArray(studentAnswerForQuestion) ? studentAnswerForQuestion[0] : studentAnswerForQuestion;

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
            if (matq.pairs && matq.pairs.length > 0 && typeof singleStudentAnswer === 'string' && singleStudentAnswer.toUpperCase() === (matq.pairs[0].responseLetter || '').toUpperCase()) {
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

    const scoreDocRef = firestore
      .collection(SUBJECTS_COLLECTION_NAME)
      .doc(subjectId)
      .collection('classes')
      .doc(classId)
      .collection('scores')
      .doc(studentId); // Use studentId as document ID for the score

    const scoreDataToSave: StudentExamScore = {
      examId: examId,
      studentId: studentId,
      score: totalAchievedScore,
      maxPossibleScore: maxPossibleScore,
      answers: answers,
      userId: teacherUserId,
      submittedAt: admin.firestore.FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
      createdAt: admin.firestore.FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp, // Will be set on create
    };
    
    // Using set with merge:true will create the document if it doesn't exist, or update it if it does.
    await scoreDocRef.set(scoreDataToSave, { merge: true });
    
    // Ensure createdAt is set if it was a new document (set with merge might not trigger this for new docs)
    const scoreSnap = await scoreDocRef.get();
    if (!scoreSnap.data()?.createdAt) {
        await scoreDocRef.update({ createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    return NextResponse.json({
      message: 'Score computed and saved successfully',
      achievedScore: totalAchievedScore,
      maxPossibleScore: maxPossibleScore
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing score submission in API route:', error);
    let errorMessage = 'Internal Server Error';
    let errorDetails: any = {};
    if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = { name: error.name, stack: error.stack?.substring(0, 500) };
    } else if (typeof error === 'object' && error !== null) {
        errorDetails = { ...error };
    }
    return NextResponse.json({
      error: 'Failed to process score submission',
      details: errorMessage,
      debugInfo: errorDetails
    }, { status: 500 });
  }
}

