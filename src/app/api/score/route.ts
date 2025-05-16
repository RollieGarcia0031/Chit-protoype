
import { NextResponse, type NextRequest } from 'next/server';
import admin from 'firebase-admin';
import { EXAMS_COLLECTION_NAME, SUBJECTS_COLLECTION_NAME } from '@/config/firebase-constants';
import type { FullExamData, ExamQuestion, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion, PooledChoicesQuestion } from '@/types/exam-types';

// Initialize Firebase Admin SDK if it hasn't been initialized yet
if (!admin.apps.length) {
  try {
    // GOOGLE_APPLICATION_CREDENTIALS environment variable should point to the serviceAccountKey.json file path
    // or contain the JSON content itself for environments like Vercel.
    admin.initializeApp(); 
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
    // If initialization fails, subsequent Firestore operations will fail.
  }
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
    const teacherUserId = examData.userId; // Assuming userId is stored on the exam document

    const blocksCollectionRef = examDocRef.collection("questionBlocks");
    const blocksSnapshot = await blocksCollectionRef.orderBy("orderIndex").get();
    
    const fetchedBlocks: FullExamData['examBlocks'] = [];
    for (const blockDoc of blocksSnapshot.docs) {
      const blockData = blockDoc.data();
      const questionsCollectionRef = blocksCollectionRef.doc(blockDoc.id).collection("questions");
      const questionsSnapshot = await questionsCollectionRef.orderBy("orderIndex").get();
      const fetchedQuestions: ExamQuestion[] = questionsSnapshot.docs.map(qDoc => ({ id: qDoc.id, ...qDoc.data() } as ExamQuestion));
      fetchedBlocks.push({ id: blockDoc.id, ...blockData, questions: fetchedQuestions } as FullExamData['examBlocks'][0]);
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
            // Student answer for MCQ is the ID of the selected option
            if (correctOption && studentAnswer === correctOption.id) {
              isCorrect = true;
            }
            break;
          case 'true-false':
            const tfq = question as TrueFalseQuestion;
            // Student answer is "true" or "false" (string)
            if ((tfq.correctAnswer === true && studentAnswer === "true") || (tfq.correctAnswer === false && studentAnswer === "false")) {
              isCorrect = true;
            }
            break;
          case 'matching':
            const matq = question as MatchingTypeQuestion;
            // Student answer for matching is the letter of the chosen response for this premise
            // And matq.pairs[0].responseLetter is the correct letter for this premise's response
            if (matq.pairs && matq.pairs.length > 0 && studentAnswer === matq.pairs[0].responseLetter) {
              isCorrect = true;
            }
            break;
          case 'pooled-choices':
            const pcq = question as PooledChoicesQuestion;
            // Student's answer is the letter (e.g., "A", "B"). We need to find what that letter corresponds to in the pool.
            if (block.choicePool && pcq.correctAnswersFromPool && pcq.correctAnswersFromPool.length > 0) {
                const correctChoiceText = pcq.correctAnswersFromPool[0]; // The actual text of the correct answer
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
      .doc(studentId); // Using studentId as document ID for the score

    await scoreDocRef.set({
      examId: examId,
      studentId: studentId, // Redundant, but good for querying this subcollection directly
      score: totalAchievedScore,
      maxPossibleScore: maxPossibleScore,
      userId: teacherUserId, // Teacher's ID
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }); // Use merge:true to create or update

    return NextResponse.json({ 
      message: 'Score computed and saved successfully', 
      achievedScore: totalAchievedScore,
      maxPossibleScore: maxPossibleScore
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing score submission:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Failed to process score submission', details: errorMessage }, { status: 500 });
  }
}
