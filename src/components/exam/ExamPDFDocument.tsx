// src/components/exam/ExamPDFDocument.tsx
'use client'; // This might not be strictly necessary if @react-pdf/renderer handles client/server context well

import type { FullExamData } from '@/app/(protected)/render-exam/page'; // Adjust path as needed
import type { MultipleChoiceQuestion, TrueFalseQuestion, MatchingTypeQuestion } from '@/types/exam-types';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register a font (optional, but good for consistent rendering)
// Example: Using a common font like Roboto
// Make sure to have the font files (e.g., .ttf) available or use a CDN if @react-pdf/renderer supports it directly.
// For simplicity, we'll rely on default fonts if specific font registration is complex for this environment.
// Font.register({ family: 'Roboto', src: '/fonts/Roboto-Regular.ttf' }); // Example, ensure path is correct

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', // Default font
    fontSize: 10,
    paddingTop: 30,
    paddingLeft: 40,
    paddingRight: 40,
    paddingBottom: 30,
    lineHeight: 1.5,
  },
  header: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
    color: 'grey',
  },
  examInfo: {
    fontSize: 9,
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
    // textDecoration: 'underline',
  },
  questionContainer: {
    marginBottom: 10,
    marginLeft: 15, // Indent questions
  },
  questionText: {
    fontSize: 10,
    marginBottom: 3,
  },
  questionPoints: {
    fontSize: 8,
    color: '#555555',
    marginLeft: 5,
  },
  optionText: {
    fontSize: 10,
    marginLeft: 30, // Indent options
    marginBottom: 2,
  },
  matchingPairPremise: {
    fontSize: 10,
    marginLeft: 30, // Indent matching items
    marginBottom: 2,
  },
  trueFalsePrefix: {
    // For the '____'
  },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: 'grey',
    fontSize: 8,
  },
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


export function ExamPDFDocument({ exam }: { exam: FullExamData }) {
  let questionCounter = 0;

  return (
    <Document title={exam.title || "Exam Document"} author="Chit Exam Generator">
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{exam.title}</Text>
        {exam.description && <Text style={styles.description}>{exam.description}</Text>}
        <Text style={styles.examInfo}>
          Total Questions: {exam.totalQuestions} | Total Points: {exam.totalPoints} | Status: {exam.status}
        </Text>

        {exam.examBlocks.map((block, blockIndex) => (
          <View key={block.id} style={{ marginBottom: 10 }} wrap={false}>
            <Text style={styles.blockTitle}>
              {toRoman(blockIndex + 1)}{block.blockTitle ? `: ${block.blockTitle}` : ''}
            </Text>
            {block.questions.map((question) => {
              questionCounter++;
              const questionPrefix = question.type === 'true-false' ? '____ ' : '';
              return (
                <View key={question.id} style={styles.questionContainer}>
                  <Text style={styles.questionText}>
                    <Text style={styles.trueFalsePrefix}>{questionPrefix}</Text>
                    {`${questionCounter}. ${question.questionText} `}
                    <Text style={styles.questionPoints}>{`(${question.points} pts)`}</Text>
                  </Text>

                  {question.type === 'multiple-choice' && (
                    <View>
                      {(question as MultipleChoiceQuestion).options.map((option, optIndex) => (
                        <Text key={option.id} style={styles.optionText}>
                          {`${getAlphabetLetter(optIndex)}. ${option.text}`}
                        </Text>
                      ))}
                    </View>
                  )}

                  {question.type === 'matching' && (
                    <View>
                      {(question as MatchingTypeQuestion).pairs.map((pair, pairIndex) => (
                        <Text key={pair.id} style={styles.matchingPairPremise}>
                          {`${pairIndex + 1}. ${pair.premise}\t\t____________________`}
                        </Text>
                      ))}
                    </View>
                  )}
                  {/* True/False questions don't need extra rendering for options here as per current design */}
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.footer}>
          Generated by Chit Exam Platform on {new Date().toLocaleDateString()}
        </Text>
      </Page>
    </Document>
  );
}
