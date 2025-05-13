// src/components/exam/ExamPDFDocument.tsx
'use client';

import type { ReactNode } from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { FullExamData, MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion } from '@/app/(protected)/render-exam/page'; // Adjust path as needed

// Register fonts (optional, but good for consistency)
// Example:
// Font.register({
//   family: 'Roboto',
//   fonts: [
//     { src: '/fonts/Roboto-Regular.ttf' },
//     { src: '/fonts/Roboto-Bold.ttf', fontWeight: 'bold' },
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
    fontWeight: 'bold',
    marginBottom: 5,
    fontFamily: 'Helvetica-Bold',
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
  },
  block: {
    marginBottom: 15,
    paddingLeft: 10, // Indent blocks slightly
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'Helvetica-Bold',
  },
  questionContainer: {
    marginBottom: 10,
    paddingLeft: 15, // Indent questions within blocks
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
    marginLeft: 10, // Indent options
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
  exam: FullExamData;
}

export function ExamPDFDocument({ exam }: ExamPDFDocumentProps): ReactNode {
  let currentQuestionNumber = 0;

  if (!exam) { // Basic guard against null/undefined exam
    return (
      <Document>
        <Page style={styles.page}>
          <Text>Error: Exam data is not available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document title={exam.title || 'Exam'} author="Chit Exam Generator">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.examTitle}>{exam.title || 'Untitled Exam'}</Text>
          {exam.description && <Text style={styles.examDescription}>{exam.description}</Text>}
           <Text style={styles.metadata}>
            Total Questions: {exam.totalQuestions || 0} | Total Points: {exam.totalPoints || 0} | Status: {exam.status || 'N/A'}
          </Text>
        </View>

        {(exam.examBlocks || []).map((block, blockIndex) => {
          return (
            <View key={block.id || `block-${blockIndex}`} style={styles.block}>
              <Text style={styles.blockTitle}>
                {toRoman(blockIndex + 1)}{block.blockTitle ? `: ${block.blockTitle}` : ''}
              </Text>
              {(block.questions || []).map((question) => {
                currentQuestionNumber++;
                return (
                  <View key={question.id || `question-${currentQuestionNumber}`} style={styles.questionContainer}>
                    <Text style={styles.questionText}>
                      {question.type === 'true-false' ? '____ ' : ''}
                      {currentQuestionNumber}. {question.questionText || ''}{' '}
                      <Text style={styles.points}>({question.points || 0} pts)</Text>
                    </Text>

                    {question.type === 'multiple-choice' && (
                      <View style={styles.optionsList}>
                        {((question as MultipleChoiceQuestion).options || []).map((opt, optIndex) => (
                          <Text key={opt.id || `opt-${optIndex}`} style={styles.optionText}>
                            {getAlphabetLetter(optIndex)}. {opt.text || ''}
                          </Text>
                        ))}
                      </View>
                    )}

                    {question.type === 'matching' && (
                      <View style={styles.optionsList}>
                        {((question as MatchingTypeQuestion).pairs || []).map((pair, pairIndex) => (
                          <View key={pair.id || `pair-${pairIndex}`} style={{ flexDirection: 'column', marginBottom: 2 }}>
                            <Text style={styles.matchingPairPremise}>
                              {pairIndex + 1}. {pair.premise || ''}
                            </Text>
                            <Text style={styles.matchingPairLine}>
                              {'       '}_________________________
                            </Text>
                          </View>
                        ))}
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
}
