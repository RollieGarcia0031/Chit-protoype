// src/components/exam/ExamPDFDocument.tsx
'use client';

import type { ReactNode } from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { FullExamData, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion } from '@/app/(protected)/render-exam/page'; // Adjust path as needed

// Font registration (example, ensure paths are correct if uncommented)
// Font.register({
//   family: 'Helvetica', // Using standard fonts
//   fonts: [
//     { src: `/fonts/Helvetica.ttf`, fontWeight: 'normal' }, // Ensure you have these font files or use system fonts
//     { src: `/fonts/Helvetica-Bold.ttf`, fontWeight: 'bold' },
//   ],
// });

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', // Default font
    fontSize: 11,
    paddingTop: 30,
    paddingLeft: 40,
    paddingRight: 40,
    paddingBottom: 30,
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  examTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold', // Use registered bold font
    marginBottom: 5,
  },
  examDescription: {
    fontSize: 10,
    marginBottom: 10,
    color: '#444',
    fontFamily: 'Helvetica',
  },
  metadata: {
    fontSize: 9,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
    fontFamily: 'Helvetica',
  },
  block: {
    marginBottom: 15,
    paddingLeft: 10, 
  },
  blockTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold', 
    marginBottom: 8,
  },
  questionContainer: {
    marginBottom: 10,
    paddingLeft: 15, 
  },
  questionText: {
    fontSize: 11,
    marginBottom: 4,
    fontFamily: 'Helvetica',
  },
  points: {
    fontSize: 9,
    color: '#555',
    fontFamily: 'Helvetica',
  },
  optionsList: {
    marginLeft: 10, 
    marginTop: 2,
  },
  optionText: {
    fontSize: 11,
    marginBottom: 1,
    fontFamily: 'Helvetica',
  },
  matchingPairPremise: {
    fontSize: 11,
    marginBottom: 1,
    fontFamily: 'Helvetica',
  },
  matchingPairLine: {
    fontSize: 11,
    color: '#777',
    marginBottom: 3,
    fontFamily: 'Helvetica', // Ensure all text components have a font
  }
});

const getAlphabetLetter = (index: number): string => String.fromCharCode(65 + index);

const toRoman = (num: number): string => {
  if (num < 1 || num > 3999) return String(num);
  const romanNumerals: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  let n = num;
  for (const [value, symbol] of romanNumerals) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
};


interface ExamPDFDocumentProps {
  exam: FullExamData | null; // Allow null to handle cases where parent might pass it before fully ready
}

export function ExamPDFDocument({ exam }: ExamPDFDocumentProps): ReactNode {
  let currentQuestionNumber = 0;

  if (!exam || typeof exam !== 'object' || !exam.id || !Array.isArray(exam.examBlocks)) { 
    return (
      <Document>
        <Page style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.examTitle}>Error</Text>
            <Text style={styles.examDescription}>Invalid or incomplete exam data provided for PDF generation.</Text>
          </View>
        </Page>
      </Document>
    );
  }

  try {
    return (
      <Document title={String(exam.title || 'Exam Document')} author="Chit Exam Generator">
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.examTitle}>{String(exam.title || 'Untitled Exam')}</Text>
            {exam.description && <Text style={styles.examDescription}>{String(exam.description)}</Text>}
            <Text style={styles.metadata}>
              Total Questions: {exam.totalQuestions || 0} | Total Points: {exam.totalPoints || 0} | Status: {String(exam.status || 'N/A')}
            </Text>
          </View>

          {(exam.examBlocks || []).map((block, blockIndex) => {
            if (typeof block !== 'object' || block === null) return null;
            return (
              <View key={String(block.id || `block-${blockIndex}`)} style={styles.block} wrap={false}>
                <Text style={styles.blockTitle}>
                  {toRoman(blockIndex + 1)}{block.blockTitle ? `: ${String(block.blockTitle)}` : ''}
                </Text>
                {(block.questions || []).map((question) => {
                  if (typeof question !== 'object' || question === null) return null;
                  currentQuestionNumber++;
                  return (
                    <View key={String(question.id || `question-${currentQuestionNumber}`)} style={styles.questionContainer}>
                      <Text style={styles.questionText}>
                        {question.type === 'true-false' ? '____ ' : ''}
                        {currentQuestionNumber}. {String(question.questionText || '')}{' '}
                        <Text style={styles.points}>({String(question.points || 0)} pts)</Text>
                      </Text>

                      {question.type === 'multiple-choice' && (
                        <View style={styles.optionsList}>
                          {((question as MultipleChoiceQuestion).options || []).map((opt, optIndex) => {
                            if (typeof opt !== 'object' || opt === null) return null;
                            return (
                              <Text key={String(opt.id || `opt-${optIndex}-${currentQuestionNumber}`)} style={styles.optionText}>
                                {getAlphabetLetter(optIndex)}. {String(opt.text || '')}
                              </Text>
                            );
                          })}
                        </View>
                      )}

                      {question.type === 'matching' && (
                        <View style={styles.optionsList}>
                          {((question as MatchingTypeQuestion).pairs || []).map((pair, pairIndex) => {
                            if (typeof pair !== 'object' || pair === null) return null;
                            return (
                              <View key={String(pair.id || `pair-${pairIndex}-${currentQuestionNumber}`)} style={{ flexDirection: 'column', marginBottom: 2 }}>
                                <Text style={styles.matchingPairPremise}>
                                  {pairIndex + 1}. {String(pair.premise || '')}
                                </Text>
                                <Text style={styles.matchingPairLine}>
                                  {'       '}_________________________
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </Page>
      </Document>
    );
  } catch (e) {
    console.error("Error during ExamPDFDocument rendering:", e);
    // Fallback error PDF if rendering logic fails
    return (
      <Document>
        <Page style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.examTitle}>PDF Generation Error</Text>
                <Text style={styles.examDescription}>
                    An unexpected error occurred while generating the PDF. Please try again.
                    {(e instanceof Error) ? e.message : String(e)}
                </Text>
            </View>
        </Page>
      </Document>
    );
  }
}
